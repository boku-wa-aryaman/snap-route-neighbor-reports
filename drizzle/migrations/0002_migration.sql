create or replace function public.increment_report_count(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.audit_action', 'duplicate_linked', true);
  update reports set report_count = report_count + 1 where id = _id;
end $$;
revoke execute on function public.increment_report_count from anon, authenticated, public;
grant execute on function public.increment_report_count to service_role;