begin;

create or replace function private.is_privileged_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (
            select
                member.role not in ('owner', 'admin')
                or (select auth.jwt() ->> 'aal') = 'aal2'
            from public.company_members as member
            where member.user_id = (select auth.uid())
            limit 1
        ),
        false
    );
$$;

revoke all on function private.is_privileged_mfa_satisfied() from public;
grant execute on function private.is_privileged_mfa_satisfied()
to authenticated, service_role;

do $$
declare
    protected_table record;
begin
    for protected_table in
        select namespace.nspname as schema_name, relation.relname as table_name
        from pg_class as relation
        join pg_namespace as namespace on namespace.oid = relation.relnamespace
        where relation.relkind = 'r'
          and relation.relrowsecurity
          and namespace.nspname = 'public'
    loop
        execute format(
            'drop policy if exists require_privileged_mfa on %I.%I',
            protected_table.schema_name,
            protected_table.table_name
        );
        execute format(
            'create policy require_privileged_mfa on %I.%I '
            'as restrictive for all to authenticated '
            'using ((select private.is_privileged_mfa_satisfied())) '
            'with check ((select private.is_privileged_mfa_satisfied()))',
            protected_table.schema_name,
            protected_table.table_name
        );
    end loop;
end
$$;

drop policy if exists require_privileged_mfa on storage.objects;
create policy require_privileged_mfa
on storage.objects
as restrictive
for all
to authenticated
using ((select private.is_privileged_mfa_satisfied()))
with check ((select private.is_privileged_mfa_satisfied()));

comment on function private.is_privileged_mfa_satisfied() is
'Allows non-privileged members at AAL1 and requires AAL2 for owner/admin.';

commit;
