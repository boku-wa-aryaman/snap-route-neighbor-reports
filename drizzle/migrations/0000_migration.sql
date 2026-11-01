
-- Roles
create type public.app_role as enum ('admin','official','citizen');
create type public.report_status as enum ('open','in_progress','resolved','escalated','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.actor_role(_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when _user_id is null then 'system'
    when public.has_role(_user_id,'admin') then 'admin'
    when public.has_role(_user_id,'official') then 'official'
    else 'citizen' end
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- Signup: profile + roles (team admins seeded by email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), new.email);
  insert into public.user_roles(user_id, role) values (new.id, 'citizen');
  if lower(new.email) in ('aryamangupta012@gmail.com','mohanrejul@gmail.com') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Departments (real system config: types of local authority, resolved to the reporter's locality)
create table public.departments (
  id text primary key,
  name text not null,
  handles text[] not null,
  description text not null
);
grant select on public.departments to anon, authenticated;
grant all on public.departments to service_role;
alter table public.departments enable row level security;
create policy "departments public" on public.departments for select to anon, authenticated using (true);
insert into public.departments(id,name,handles,description) values
 ('municipal','Municipal Corporation / Local Body','{garbage,streetlight,road_damage,other}','Urban local body for the area: sanitation, solid waste, street lighting, local roads.'),
 ('pwd','Public Works Department (PWD)','{road_damage}','State PWD: arterial roads, flyovers and bridges.'),
 ('water','Water Supply & Sewerage Board','{water_leak,waterlogging}','Water supply pipelines, sewer lines and drainage.'),
 ('pcb','State Pollution Control Board','{pollution}','Air, water and industrial pollution.'),
 ('police','Local Police (noise)','{noise}','Noise nuisance complaints.');

-- Reports
create sequence public.ticket_seq start 1001;
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null unique default ('CP-' || nextval('public.ticket_seq')),
  reporter_id uuid not null,
  is_anonymous boolean not null default false,
  category text not null default 'other',
  description text,
  ai_summary text,
  ai_json jsonb,
  ai_confidence numeric,
  severity int not null default 1 check (severity between 1 and 5),
  severity_reasons text[] not null default '{}',
  severity_override int,
  severity_override_reason text,
  department_id text references public.departments(id),
  lat double precision not null,
  lon double precision not null,
  area_name text,
  city text,
  live_context jsonb,
  photo_url text,
  status report_status not null default 'open',
  needs_review boolean not null default false,
  review_reason text,
  duplicate_of uuid references public.reports(id),
  report_count int not null default 1,
  sla_deadline timestamptz,
  drafted_complaint text,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.reports(created_at desc);
create index on public.reports(category, lat, lon);
grant select on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "own or staff read" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  type text not null,
  note text,
  after_photo_url text,
  actor_role text not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.report_events to authenticated;
grant all on public.report_events to service_role;
alter table public.report_events enable row level security;
create policy "admin read events" on public.report_events for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- Append-only audit log
create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  ticket_id text,
  before jsonb,
  after jsonb,
  reason text
);
grant select on public.audit_log to authenticated;
grant select, insert on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin read audit" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_no_update before update or delete on public.audit_log for each row execute function public.audit_immutable();
create trigger audit_no_truncate before truncate on public.audit_log for each statement execute function public.audit_immutable();

-- Audit trigger on reports. Action and reason passed via transaction-local settings.
create or replace function public.audit_reports() returns trigger language plpgsql security definer set search_path = public as $$
declare
  _actor uuid := coalesce(nullif(current_setting('app.actor_id', true),'')::uuid, auth.uid());
  _action text := nullif(current_setting('app.audit_action', true),'');
  _reason text := nullif(current_setting('app.audit_reason', true),'');
begin
  if tg_op = 'INSERT' then
    insert into audit_log(actor_id, actor_role, action, entity_type, entity_id, ticket_id, before, after, reason)
    values (coalesce(_actor, new.reporter_id), actor_role(coalesce(_actor, new.reporter_id)), 'create', 'report', new.id::text, new.ticket_id, null,
            to_jsonb(new) - 'reporter_id', null);
  else
    new.updated_at := now();
    insert into audit_log(actor_id, actor_role, action, entity_type, entity_id, ticket_id, before, after, reason)
    values (_actor, actor_role(_actor), coalesce(_action,'edit'), 'report', new.id::text, new.ticket_id,
            to_jsonb(old) - 'reporter_id', to_jsonb(new) - 'reporter_id', _reason);
  end if;
  return new;
end $$;
create trigger reports_audit_ins after insert on public.reports for each row execute function public.audit_reports();
create trigger reports_audit_upd before update on public.reports for each row execute function public.audit_reports();

-- Public view: no reporter identity
create view public.public_reports with (security_invoker = false) as
  select r.id, r.ticket_id, r.category, r.description, r.ai_summary, r.ai_confidence,
         coalesce(r.severity_override, r.severity) as severity, r.severity_reasons, r.severity_override is not null as severity_overridden,
         r.department_id, d.name as department_name, r.lat, r.lon, r.area_name, r.city, r.live_context, r.photo_url,
         r.status, r.needs_review, r.review_reason, r.duplicate_of, r.report_count, r.sla_deadline, r.drafted_complaint,
         r.created_at, r.updated_at,
         case when r.is_anonymous then null else p.display_name end as reporter_name
  from public.reports r
  left join public.departments d on d.id = r.department_id
  left join public.profiles p on p.id = r.reporter_id
  where r.deleted_at is null;
grant select on public.public_reports to anon, authenticated;

create view public.public_events with (security_invoker = false) as
  select e.id, e.report_id, e.type, e.note, e.after_photo_url, e.actor_role, e.created_at
  from public.report_events e join public.reports r on r.id = e.report_id where r.deleted_at is null;
grant select on public.public_events to anon, authenticated;

create view public.public_changes with (security_invoker = false) as
  select id, created_at, action, actor_role, ticket_id from public.audit_log order by id desc limit 200;
grant select on public.public_changes to anon, authenticated;

-- Staff actions
create or replace function public.set_report_status(_report_id uuid, _status report_status, _note text default null, _after_photo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _role text := actor_role(auth.uid());
begin
  if _role not in ('admin','official') then raise exception 'Forbidden'; end if;
  if _role = 'official' and _status not in ('in_progress','resolved') then raise exception 'Officials can only mark In Progress or Resolved'; end if;
  perform set_config('app.audit_action', case when _status='resolved' then 'mark_done' else 'status_change' end, true);
  perform set_config('app.audit_reason', coalesce(_note,''), true);
  update reports set status = _status where id = _report_id and deleted_at is null;
  if not found then raise exception 'Report not found'; end if;
  insert into report_events(report_id, type, note, after_photo_url, actor_role, actor_id)
  values (_report_id, 'status:' || _status, _note, _after_photo, _role, auth.uid());
end $$;

create or replace function public.admin_update_report(_report_id uuid, _patch jsonb, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  if _patch ? 'severity_override' and coalesce(trim(_reason),'') = '' then raise exception 'Reason required for severity override'; end if;
  perform set_config('app.audit_action', 'edit', true);
  perform set_config('app.audit_reason', coalesce(_reason,''), true);
  update reports set
    category = coalesce(_patch->>'category', category),
    department_id = coalesce(_patch->>'department_id', department_id),
    status = coalesce((_patch->>'status')::report_status, status),
    area_name = coalesce(_patch->>'area_name', area_name),
    lat = coalesce((_patch->>'lat')::float8, lat),
    lon = coalesce((_patch->>'lon')::float8, lon),
    needs_review = coalesce((_patch->>'needs_review')::boolean, needs_review),
    severity_override = case when _patch ? 'severity_override' then nullif(_patch->>'severity_override','')::int else severity_override end,
    severity_override_reason = case when _patch ? 'severity_override' then _reason else severity_override_reason end
  where id = _report_id;
end $$;

create or replace function public.admin_soft_delete(_report_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'Reason required'; end if;
  perform set_config('app.audit_action', 'delete', true);
  perform set_config('app.audit_reason', _reason, true);
  update reports set deleted_at = now(), deleted_reason = _reason where id = _report_id;
end $$;

create or replace function public.admin_restore(_report_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  perform set_config('app.audit_action', 'restore', true);
  perform set_config('app.audit_reason', coalesce(_reason,''), true);
  update reports set deleted_at = null, deleted_reason = null where id = _report_id;
end $$;

create or replace function public.admin_set_role(_user_id uuid, _role app_role, _grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  if _grant then insert into user_roles(user_id, role) values (_user_id, _role) on conflict do nothing;
  else delete from user_roles where user_id = _user_id and role = _role; end if;
  insert into audit_log(actor_id, actor_role, action, entity_type, entity_id, after)
  values (auth.uid(), 'admin', case when _grant then 'role_grant' else 'role_revoke' end, 'user', _user_id::text, jsonb_build_object('role', _role));
end $$;

revoke execute on function public.set_report_status, public.admin_update_report, public.admin_soft_delete, public.admin_restore, public.admin_set_role from anon, public;
grant execute on function public.set_report_status, public.admin_update_report, public.admin_soft_delete, public.admin_restore, public.admin_set_role to authenticated;
