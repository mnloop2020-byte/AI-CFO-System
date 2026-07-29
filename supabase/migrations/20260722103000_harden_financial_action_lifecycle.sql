begin;

select pg_advisory_xact_lock(hashtext('zemam-financial-action-lifecycle-v1'));

insert into private.migration_audit (
    migration_name,
    before_counts,
    after_counts,
    checks_passed,
    applied_at
)
values (
    '20260722103000_harden_financial_action_lifecycle',
    jsonb_build_object(
        'customers', private.relation_row_count('public.customers'),
        'sales', private.relation_row_count('public.sales'),
        'expenses', private.relation_row_count('public.expenses'),
        'inventory', private.relation_row_count('public.inventory'),
        'invoices', private.relation_row_count('public.invoices'),
        'conversations', private.relation_row_count('public.conversations'),
        'messages', private.relation_row_count('public.messages'),
        'reports', private.relation_row_count('public.reports'),
        'documents', private.relation_row_count('public.documents'),
        'document_chunks', private.relation_row_count('public.document_chunks'),
        'legacy_rag_chunks', private.relation_row_count('public.rag_document_chunks_legacy_20260719'),
        'financial_actions', private.relation_row_count('public.financial_actions'),
        'financial_action_events', private.relation_row_count('public.financial_action_events')
    ),
    null,
    false,
    null
)
on conflict (migration_name) do update
set before_counts = excluded.before_counts,
    after_counts = null,
    checks_passed = false,
    applied_at = null;

alter table public.financial_actions
    add column if not exists last_note text;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'financial_actions_last_note_length_check'
          and conrelid = 'public.financial_actions'::regclass
    ) then
        alter table public.financial_actions
            add constraint financial_actions_last_note_length_check
            check (last_note is null or length(last_note) <= 4000);
    end if;
end
$$;

create or replace function private.validate_financial_action_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_id uuid := (select auth.uid());
    payload_changed boolean := false;
begin
    if tg_op = 'INSERT' then
        if (select auth.role()) <> 'service_role' then
            if caller_id is null or not private.has_permission('actions.write') then
                raise exception 'actions.write permission is required';
            end if;
            new.created_by := caller_id;
            if new.status <> 'new' then
                raise exception 'New financial actions must start with status new';
            end if;
        end if;
        new.approved_by := null;
        new.approved_at := null;
        new.approval_expires_at := null;
        new.approved_payload_hash := null;
        new.resolved_at := null;
        return new;
    end if;

    if (select auth.role()) <> 'service_role' then
        if caller_id is null or not private.has_permission('actions.write') then
            raise exception 'actions.write permission is required';
        end if;
        if new.assigned_to is distinct from old.assigned_to
           and not private.has_permission('actions.assign') then
            raise exception 'actions.assign permission is required';
        end if;
        if new.status in ('approved', 'rejected')
           and new.status is distinct from old.status
           and not private.has_permission('actions.approve') then
            raise exception 'actions.approve permission is required';
        end if;
    end if;

    if new.company_id <> old.company_id
       or new.action_type <> old.action_type
       or new.dedup_key <> old.dedup_key
       or new.source_type <> old.source_type
       or new.source_id <> old.source_id
       or new.created_by <> old.created_by then
        raise exception 'Immutable financial action identity fields cannot change';
    end if;

    payload_changed := new.proposed_action is distinct from old.proposed_action;
    if payload_changed and old.approved_payload_hash is not null then
        new.status := 'waiting_for_approval';
        new.approved_by := null;
        new.approved_at := null;
        new.approval_expires_at := null;
        new.approved_payload_hash := null;
    end if;

    if new.status is distinct from old.status then
        if not (
            (old.status = 'new' and new.status in ('in_review', 'dismissed'))
            or (old.status = 'in_review' and new.status in ('waiting_for_approval', 'in_progress', 'completed', 'dismissed'))
            or (old.status = 'waiting_for_approval' and new.status in ('approved', 'rejected', 'in_review', 'expired'))
            or (old.status = 'approved' and new.status in ('in_progress', 'rejected', 'expired'))
            or (old.status = 'rejected' and new.status in ('in_review', 'dismissed'))
            or (old.status = 'in_progress' and new.status in ('completed', 'in_review'))
            or (old.status in ('completed', 'dismissed', 'expired') and new.status = 'in_review')
        ) then
            raise exception 'Invalid financial action status transition: % -> %', old.status, new.status;
        end if;
    end if;

    if new.status = 'approved' and new.status is distinct from old.status then
        if not new.requires_approval then
            raise exception 'Actions without approval requirement cannot enter approved status';
        end if;
        new.approved_by := caller_id;
        new.approved_at := now();
        new.approval_expires_at := now() + interval '24 hours';
        new.approved_payload_hash := digest(convert_to(new.proposed_action::text, 'UTF8'), 'sha256');
    elsif new.status = 'waiting_for_approval' then
        new.approved_by := null;
        new.approved_at := null;
        new.approval_expires_at := null;
        new.approved_payload_hash := null;
    end if;

    if new.status in ('completed', 'dismissed', 'rejected', 'expired') then
        new.resolved_at := coalesce(new.resolved_at, now());
    elsif new.status is distinct from old.status then
        new.resolved_at := null;
    end if;
    return new;
end;
$$;

create or replace function private.audit_financial_action_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.financial_action_events (
        company_id, action_id, event_type, from_status, to_status,
        actor_id, note, metadata
    )
    values (
        new.company_id,
        new.id,
        case
            when tg_op = 'INSERT' then 'created'
            when new.status is distinct from old.status then 'status_changed'
            when new.assigned_to is distinct from old.assigned_to then 'assigned'
            when new.proposed_action is distinct from old.proposed_action then 'draft_updated'
            else 'updated'
        end,
        case when tg_op = 'UPDATE' then old.status else null end,
        new.status,
        (select auth.uid()),
        case
            when tg_op = 'INSERT' then new.last_note
            when new.last_note is distinct from old.last_note then new.last_note
            else null
        end,
        jsonb_build_object(
            'assigned_to', new.assigned_to,
            'due_date', new.due_date,
            'requires_approval', new.requires_approval,
            'proposed_action', new.proposed_action,
            'approved_payload_hash', case
                when new.approved_payload_hash is null then null
                else encode(new.approved_payload_hash, 'hex')
            end
        )
    );
    return new;
end;
$$;

update private.migration_audit
set after_counts = jsonb_build_object(
        'customers', private.relation_row_count('public.customers'),
        'sales', private.relation_row_count('public.sales'),
        'expenses', private.relation_row_count('public.expenses'),
        'inventory', private.relation_row_count('public.inventory'),
        'invoices', private.relation_row_count('public.invoices'),
        'conversations', private.relation_row_count('public.conversations'),
        'messages', private.relation_row_count('public.messages'),
        'reports', private.relation_row_count('public.reports'),
        'documents', private.relation_row_count('public.documents'),
        'document_chunks', private.relation_row_count('public.document_chunks'),
        'legacy_rag_chunks', private.relation_row_count('public.rag_document_chunks_legacy_20260719'),
        'financial_actions', private.relation_row_count('public.financial_actions'),
        'financial_action_events', private.relation_row_count('public.financial_action_events')
    ),
    checks_passed = before_counts = jsonb_build_object(
        'customers', private.relation_row_count('public.customers'),
        'sales', private.relation_row_count('public.sales'),
        'expenses', private.relation_row_count('public.expenses'),
        'inventory', private.relation_row_count('public.inventory'),
        'invoices', private.relation_row_count('public.invoices'),
        'conversations', private.relation_row_count('public.conversations'),
        'messages', private.relation_row_count('public.messages'),
        'reports', private.relation_row_count('public.reports'),
        'documents', private.relation_row_count('public.documents'),
        'document_chunks', private.relation_row_count('public.document_chunks'),
        'legacy_rag_chunks', private.relation_row_count('public.rag_document_chunks_legacy_20260719'),
        'financial_actions', private.relation_row_count('public.financial_actions'),
        'financial_action_events', private.relation_row_count('public.financial_action_events')
    ),
    applied_at = now()
where migration_name = '20260722103000_harden_financial_action_lifecycle';

do $$
begin
    if not (select checks_passed from private.migration_audit where migration_name = '20260722103000_harden_financial_action_lifecycle') then
        raise exception 'Protected row counts changed during action lifecycle migration';
    end if;
end
$$;

commit;
