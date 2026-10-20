-- LU Update: automatic result publication and rank release.
-- Run once in Supabase SQL Editor after student-exam-workflow.sql.
-- Every submitted result is visible to its owner immediately. Non-live tests
-- receive ranks immediately; live-test ranks are released after ends_at.

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

  -- Live results are visible immediately, but rank is withheld until the
  -- configured live test window has ended.
  if v_test.test_type = 'live' and v_test.ends_at is not null and now() < v_test.ends_at then
    update public.results set rank = null where test_id = p_test_id;
    return;
  end if;

  with ranked as (
    select r.id,
           rank() over (order by r.score desc) as calculated_rank
    from public.results r
    where r.test_id = p_test_id
      and r.published_at is not null
  )
  update public.results r
     set rank = ranked.calculated_rank
    from ranked
   where r.id = ranked.id
     and r.rank is distinct from ranked.calculated_rank;
end;
$$;

-- Students can safely trigger rank refresh for their own completed live tests
-- by opening their dashboard after the test window ends.
create or replace function public.refresh_my_result_ranks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test record;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;

  for v_test in
    select distinct t.id
      from public.tests t
      join public.results r on r.test_id = t.id
     where r.published_at is not null
       and (t.test_type <> 'live' or t.ends_at is null or now() >= t.ends_at)
  loop
    perform public.refresh_test_ranks(v_test.id);
  end loop;
end;
$$;

revoke all on function public.refresh_test_ranks(bigint) from public, anon, authenticated;
grant execute on function public.refresh_my_result_ranks() to authenticated;

-- Make every student's own submitted result visible without admin approval.
create or replace function public.set_result_publication_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.published_at := coalesce(new.published_at, now());
  return new;
end;
$$;

drop trigger if exists results_auto_publish on public.results;
create trigger results_auto_publish
before insert or update of score, max_score, test_id, student_id, published_at
on public.results
for each row execute function public.set_result_publication_defaults();

-- Update ranks automatically after any result is recorded for a non-live test.
-- For live tests this does nothing to rank until the window has elapsed.
create or replace function public.recalculate_result_ranks_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_test_ranks(new.test_id);
  return new;
end;
$$;

drop trigger if exists results_recalculate_ranks on public.results;
create trigger results_recalculate_ranks
after insert or update of score, max_score, test_id, student_id, published_at
on public.results
for each row execute function public.recalculate_result_ranks_after_change();

-- Release results already scored before this migration, without requiring an admin click.
update public.results
   set published_at = coalesce(published_at, created_at, now())
 where published_at is null;

-- Existing RLS policy already permits each student to read their own result
-- once published_at is non-null; the trigger now guarantees this automatically.
notify pgrst, 'reload schema';
