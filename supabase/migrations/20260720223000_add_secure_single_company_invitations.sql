begin;

-- Secure, one-time invitations for the current Single Company deployment.
-- Raw invitation tokens are never stored. The application submits only a
-- SHA-256 hex digest to Supabase Auth during sign-up.

select pg_advisory_xact_lock(hashtext('zemam-secure-company-invitations-v1'));

do $$
begin
    if (select count(*) from public.companies) <> 1 then
        raise exception 'Secure invitations require exactly one company';
    end if;

    if exists (select 1 from public.company_invitations) then
        raise exception 'Existing invitations require manual review before adding one-time token hashes';
    end if;
end
$$;

alter table public.company_invitations
    add column if not exists token_hash text,
    add column if not exists token_used_at timestamptz,
    add column if not exists revoked_at timestamptz;

alter table public.company_invitations
    alter column token_hash set not null;

do $$
begin
    alter table public.company_invitations
        drop constraint if exists company_invitations_status_check;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.company_invitations'::regclass
          and conname = 'company_invitations_status_check'
    ) then
        alter table public.company_invitations
            add constraint company_invitations_status_check
            check (status in ('pending', 'claimed', 'accepted', 'revoked', 'expired'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.company_invitations'::regclass
          and conname = 'company_invitations_token_hash_check'
    ) then
        alter table public.company_invitations
            add constraint company_invitations_token_hash_check
            check (token_hash ~ '^[0-9a-f]{64}$');
    end if;
end
$$;

create unique index if not exists company_invitations_token_hash_unique
    on public.company_invitations (token_hash);

create index if not exists company_invitations_auth_user_index
    on public.company_invitations (auth_user_id)
    where auth_user_id is not null;

-- Validate the invitation before auth.users accepts a new user. The supplied
-- digest is removed from user metadata before the auth row is persisted.
create or replace function private.enforce_single_company_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    owner_exists boolean;
    configured_email text;
    supplied_token_hash text;
    invitation_row public.company_invitations%rowtype;
begin
    perform pg_advisory_xact_lock(hashtext('zemam-auth-user-admission'));

    select exists (
        select 1 from public.company_members where role = 'owner'
    ) into owner_exists;

    if not owner_exists then
        select owner_email
        into configured_email
        from private.bootstrap_control
        where singleton_key
          and consumed_at is null;

        if configured_email is null
           or lower(coalesce(new.email, '')) <> configured_email
           or new.invited_at is not null then
            raise exception 'Owner bootstrap registration is not authorized';
        end if;

        return new;
    end if;

    supplied_token_hash := lower(
        coalesce(new.raw_user_meta_data ->> 'invitation_token_hash', '')
    );

    if supplied_token_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'Public registration is closed; a valid invitation token is required';
    end if;

    perform pg_advisory_xact_lock(
        hashtext('zemam-company-invitation:' || supplied_token_hash)
    );

    select invitation.*
    into invitation_row
    from public.company_invitations as invitation
    where invitation.token_hash = supplied_token_hash
      and lower(invitation.email) = lower(coalesce(new.email, ''))
      and invitation.status = 'pending'
      and invitation.token_used_at is null
      and invitation.expires_at > now()
    for update;

    if invitation_row.id is null then
        raise exception 'Invitation is invalid, expired, used, or belongs to another email';
    end if;

    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
            'company_invitation_id', invitation_row.id::text
        );
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
        - 'invitation_token_hash';

    return new;
end;
$$;

-- Claim the token as soon as the Auth user is created, then create membership
-- only after email confirmation. INSERT also handles projects with autoconfirm.
create or replace function private.attach_invited_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    invitation_id uuid;
    invitation_row public.company_invitations%rowtype;
begin
    invitation_id := nullif(
        coalesce(new.raw_app_meta_data ->> 'company_invitation_id', ''),
        ''
    )::uuid;

    if invitation_id is null then
        return new;
    end if;

    perform pg_advisory_xact_lock(
        hashtext('zemam-company-invitation:' || invitation_id::text)
    );

    if tg_op = 'INSERT' then
        select invitation.*
        into invitation_row
        from public.company_invitations as invitation
        where invitation.id = invitation_id
          and lower(invitation.email) = lower(coalesce(new.email, ''))
          and invitation.status = 'pending'
          and invitation.token_used_at is null
          and invitation.expires_at > now()
        for update;

        if invitation_row.id is null then
            raise exception 'Invitation cannot be claimed';
        end if;

        update public.company_invitations
        set
            status = 'claimed',
            token_used_at = now(),
            auth_user_id = new.id,
            updated_at = now()
        where id = invitation_row.id;
    else
        select invitation.*
        into invitation_row
        from public.company_invitations as invitation
        where invitation.id = invitation_id
          and invitation.auth_user_id = new.id
          and lower(invitation.email) = lower(coalesce(new.email, ''))
          and invitation.status = 'claimed'
        for update;

        if invitation_row.id is null then
            return new;
        end if;
    end if;

    if new.email_confirmed_at is null then
        return new;
    end if;

    insert into public.company_members (
        company_id,
        user_id,
        role,
        is_default
    )
    values (
        invitation_row.company_id,
        new.id,
        invitation_row.role,
        true
    )
    on conflict (user_id) do nothing;

    update public.company_invitations
    set
        status = 'accepted',
        accepted_at = now(),
        updated_at = now()
    where id = invitation_row.id
      and status = 'claimed';

    return new;
end;
$$;

drop trigger if exists enforce_single_company_auth_signup on auth.users;
create trigger enforce_single_company_auth_signup
before insert on auth.users
for each row execute function private.enforce_single_company_auth_signup();

drop trigger if exists attach_invited_user on auth.users;
create trigger attach_invited_user
after insert or update of email_confirmed_at on auth.users
for each row execute function private.attach_invited_user();

-- Invitation creation remains owner/admin only through the central permission
-- matrix. Owner invitations are intentionally disallowed.
drop policy if exists company_invitations_insert on public.company_invitations;
create policy company_invitations_insert
on public.company_invitations
for insert
to authenticated
with check (
    company_id = (select private.current_company_id())
    and invited_by = (select auth.uid())
    and role in ('admin', 'accountant', 'viewer')
    and status = 'pending'
    and token_used_at is null
    and expires_at > now()
    and (select private.has_permission('members.invite'))
);

drop policy if exists company_invitations_update on public.company_invitations;
create policy company_invitations_update
on public.company_invitations
for update
to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('members.invite'))
)
with check (
    company_id = (select private.current_company_id())
    and role in ('admin', 'accountant', 'viewer')
    and (select private.has_permission('members.invite'))
);

comment on column public.company_invitations.token_hash is
    'Lowercase SHA-256 hex digest of the one-time invitation token; raw token is never stored.';
comment on column public.company_invitations.token_used_at is
    'Set when an Auth user successfully claims the invitation token.';

commit;
