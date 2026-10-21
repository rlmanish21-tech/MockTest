-- Live tests become available as practice two hours after their scheduled end.
-- Run this migration in Supabase SQL Editor (or with Supabase CLI migrations).

create or replace function public.start_test_attempt(p_test_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_test public.tests%rowtype;
  v_attempt public.attempts%rowtype;
  v_count integer;
  v_keys integer;
begin
  if v_user is null then
    raise exception 'Please sign in before attempting a test.';
  end if;

  select * into v_test
  from public.tests
  where id = p_test_id and status = 'published';

  if not found then
    raise exception 'This test is not published or is no longer available.';
  end if;

  if v_test.test_type = 'live' then
    if v_test.starts_at is not null and now() < v_test.starts_at then
      raise exception 'This live test has not started yet.';
    end if;
    if v_test.ends_at is not null
       and now() >= v_test.ends_at
       and now() < v_test.ends_at + interval '2 hours' then
      raise exception 'This live test has ended. It will be available in Practice two hours after the end time.';
    end if;
  end if;

  select * into v_attempt
  from public.attempts
  where test_id = p_test_id
    and student_id = v_user
    and status = 'in_progress'
  order by started_at desc
  limit 1;

  if found then
    return jsonb_build_object('attempt_id', v_attempt.id, 'resumed', true);
  end if;

  select count(*) into v_count
  from public.questions
  where test_id = p_test_id;

  if v_count <> v_test.question_count or v_count = 0 then
    raise exception 'This test is not ready: expected % questions, found %.',
      v_test.question_count, v_count;
  end if;

  select count(*) into v_keys
  from public.answer_keys k
  join public.questions q on q.id = k.question_id
  where q.test_id = p_test_id;

  if v_keys <> v_count then
    raise exception 'This test is not ready because one or more correct answers are missing.';
  end if;

  insert into public.attempts(test_id, student_id)
  values (p_test_id, v_user)
  returning * into v_attempt;

  return jsonb_build_object('attempt_id', v_attempt.id, 'resumed', false);
end;
$$;

grant execute on function public.start_test_attempt(bigint) to authenticated;

-- The WITH CHECK condition must match USING. Otherwise INSERT/UPSERT requests
-- for post-grace practice attempts are rejected by row-level security.
drop policy if exists answers_write_own_attempt on public.attempt_answers;
create policy answers_write_own_attempt
  on public.attempt_answers
  for all to authenticated
  using (
    exists (
      select 1
      from public.attempts a
      join public.tests t on t.id = a.test_id
      where a.id = attempt_id
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
        and now() < a.started_at + make_interval(mins => t.duration_minutes)
        and (
          t.test_type <> 'live'
          or t.ends_at is null
          or now() < t.ends_at
          or a.started_at >= t.ends_at + interval '2 hours'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.attempts a
      join public.tests t on t.id = a.test_id
      where a.id = attempt_id
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
        and now() < a.started_at + make_interval(mins => t.duration_minutes)
        and (
          t.test_type <> 'live'
          or t.ends_at is null
          or now() < t.ends_at
          or a.started_at >= t.ends_at + interval '2 hours'
        )
    )
  );

notify pgrst, 'reload schema';
