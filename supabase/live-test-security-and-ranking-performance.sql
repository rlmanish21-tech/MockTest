-- LU Update security/performance hardening.
-- Run this migration in Supabase SQL Editor after the existing exam/ranking migrations.
-- Live-test ranks are calculated automatically about 10-11 minutes after ends_at.

-- 1) Do not expose question text for a published live test before starts_at.
--    Students may read questions for non-live published tests, after a live test
--    starts, or when they own an active attempt for that test. Admins retain access.
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='questions' and cmd in ('SELECT','ALL')
  loop
    execute format('drop policy if exists %I on public.questions', p.policyname);
  end loop;
end $$;

alter table public.questions enable row level security;

create policy questions_admin_manage
on public.questions
for all
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy questions_read_when_available
on public.questions
for select
to authenticated
using (
  exists (
    select 1
    from public.tests t
    where t.id = questions.test_id
      and t.status = 'published'
      and (
        t.test_type is distinct from 'live'
        or (t.starts_at is not null and now() >= t.starts_at)
        or exists (
          select 1
          from public.attempts a
          where a.test_id = t.id
            and a.student_id = auth.uid()
            and a.status = 'in_progress'
        )
      )
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- 2) Remove the per-result ranking trigger. A submission must not rank the
--    entire live test while hundreds/thousands of students are submitting.
drop trigger if exists results_recalculate_ranks on public.results;

create table if not exists public.result_rank_refresh_state (
  test_id bigint primary key references public.tests(id) on delete cascade,
  refreshed_at timestamptz not null default '-infinity'::timestamptz
);
revoke all on public.result_rank_refresh_state from public, anon, authenticated;

create or replace function public.refresh_test_ranks(p_test_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test public.tests%rowtype;
begin
  select * into v_test from public.tests where id = p_test_id;
  if not found then return; end if;

  -- Live-test ranks remain untouched until 10 minutes after ends_at.
  -- A missing ends_at fails closed: ranks are not calculated.
  if v_test.test_type = 'live'
     and (v_test.ends_at is null or now() < v_test.ends_at + interval '10 minutes') then
    return;
  end if;

  with ranked as (
    select r.id, rank() over (order by r.score desc) as calculated_rank
    from public.results r
    where r.test_id = p_test_id and r.published_at is not null
  )
  update public.results r
     set rank = ranked.calculated_rank
    from ranked
   where r.id = ranked.id
     and r.rank is distinct from ranked.calculated_rank;
end;
$$;

-- Automatic worker target: cron calls this once a minute. It only processes
-- live tests whose submission window ended at least 10 minutes ago and whose
-- rank refresh has not already been completed for this ending time.
create or replace function public.refresh_ended_live_test_ranks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test record;
begin
  for v_test in
    select t.id, t.ends_at
    from public.tests t
    where t.test_type = 'live'
      and t.ends_at is not null
      and now() >= t.ends_at + interval '10 minutes'
      and not exists (
        select 1
        from public.result_rank_refresh_state s
        where s.test_id = t.id
          and s.refreshed_at >= t.ends_at + interval '10 minutes'
      )
    order by t.ends_at, t.id
  loop
    -- Serialize the scheduled worker against dashboard refreshes.
    if pg_try_advisory_xact_lock(72103, hashtext(v_test.id::text)) then
      perform public.refresh_test_ranks(v_test.id);
      insert into public.result_rank_refresh_state(test_id, refreshed_at)
      values(v_test.id, now())
      on conflict(test_id) do update set refreshed_at = excluded.refreshed_at;
    end if;
  end loop;
end;
$$;

create or replace function public.refresh_my_result_ranks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test record;
  v_refreshed timestamptz;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;

  -- Only inspect tests where this student has a published result.
  -- Live-test ranks are unavailable until 10 minutes after ends_at.
  for v_test in
    select distinct t.id
    from public.tests t
    join public.results r on r.test_id = t.id
    where r.student_id = auth.uid()
      and r.published_at is not null
      and (
        t.test_type is distinct from 'live'
        or (t.ends_at is not null and now() >= t.ends_at + interval '10 minutes')
      )
  loop
    if pg_try_advisory_xact_lock(72103, hashtext(v_test.id::text)) then
      select s.refreshed_at into v_refreshed
      from public.result_rank_refresh_state s
      where s.test_id = v_test.id;

      if v_refreshed is null or v_refreshed < now() - interval '30 seconds' then
        perform public.refresh_test_ranks(v_test.id);
        insert into public.result_rank_refresh_state(test_id, refreshed_at)
        values(v_test.id, now())
        on conflict(test_id) do update set refreshed_at = excluded.refreshed_at;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.refresh_test_ranks(bigint) from public, anon, authenticated;
revoke all on function public.refresh_ended_live_test_ranks() from public, anon, authenticated;
grant execute on function public.refresh_my_result_ranks() to authenticated;

-- Supabase supports pg_cron. The job runs once per minute, so ranks are released
-- between 10 and approximately 11 minutes after ends_at. Re-running this
-- migration replaces the named job rather than creating duplicate workers.
create extension if not exists pg_cron;

do $$
declare
  v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'lu-update-refresh-live-ranks'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'lu-update-refresh-live-ranks',
    '* * * * *',
    'select public.refresh_ended_live_test_ranks();'
  );
end $$;

notify pgrst, 'reload schema';
