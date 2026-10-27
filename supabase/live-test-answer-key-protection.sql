-- LU Update: prevent live-test answer-key disclosure through direct RPC calls.
-- Run this migration AFTER student-exam-workflow.sql and table-and-statement-questions.sql.
-- During an open live test, submission may return the score, but it must not return
-- question-by-question analysis, correct options, or answer-derived details.
-- Once ends_at has passed, the same RPC returns the full analysis.
-- A live test with no ends_at fails closed: its answer analysis remains unavailable.

create or replace function public.submit_test_attempt(p_attempt_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.attempts%rowtype;
  v_test public.tests%rowtype;
  v_score numeric(10,2);
  v_max numeric(10,2);
  v_analysis jsonb;
  v_analysis_available boolean := true;
begin
  if v_user is null then
    raise exception 'Please sign in first.';
  end if;

  select * into v_attempt
  from public.attempts
  where id = p_attempt_id
    and student_id = v_user
  for update;

  if not found then
    raise exception 'Attempt not found for this account.';
  end if;

  select * into v_test
  from public.tests
  where id = v_attempt.test_id;

  if not found then
    raise exception 'Test for this attempt was not found.';
  end if;

  if v_attempt.status = 'in_progress' then
    select
      coalesce(sum(case
        when aa.selected_option is null then 0
        when upper(aa.selected_option) = upper(k.correct_option) then q.marks
        else -q.negative_marks
      end), 0),
      coalesce(sum(q.marks), 0)
    into v_score, v_max
    from public.questions q
    left join public.answer_keys k on k.question_id = q.id
    left join public.attempt_answers aa
      on aa.question_id = q.id
     and aa.attempt_id = v_attempt.id
    where q.test_id = v_attempt.test_id;

    update public.attempts
       set status = 'evaluated',
           submitted_at = now(),
           score = v_score,
           max_score = v_max
     where id = v_attempt.id;

    insert into public.results(test_id, student_id, score, max_score, rank, published_at)
    values (v_attempt.test_id, v_user, v_score, v_max, null, null)
    on conflict (test_id, student_id) do update
      set score = excluded.score,
          max_score = excluded.max_score,
          rank = null,
          published_at = null,
          created_at = now();
  else
    v_score := coalesce(v_attempt.score, 0);
    v_max := coalesce(v_attempt.max_score, 0);
  end if;

  -- SECURITY BOUNDARY: do not disclose any answer-level analysis before the
  -- scheduled end of a live test, regardless of how the RPC was invoked.
  -- Missing ends_at is treated as still open (fail closed).
  if v_test.test_type = 'live'
     and (v_test.ends_at is null or statement_timestamp() < v_test.ends_at) then
    v_analysis_available := false;
    v_analysis := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'question_order', q.question_order,
      'question_text', q.question_text,
      'table_data', q.table_data,
      'option_a', q.option_a,
      'option_b', q.option_b,
      'option_c', q.option_c,
      'option_d', q.option_d,
      'selected_option', aa.selected_option,
      'correct_option', k.correct_option,
      'question_time_seconds', coalesce(aa.question_time_seconds, 0),
      'marks', q.marks,
      'negative_marks', q.negative_marks,
      'earned', case
        when aa.selected_option is null then 0
        when upper(aa.selected_option) = upper(k.correct_option) then q.marks
        else -q.negative_marks
      end
    ) order by q.question_order), '[]'::jsonb)
    into v_analysis
    from public.questions q
    join public.answer_keys k on k.question_id = q.id
    left join public.attempt_answers aa
      on aa.question_id = q.id
     and aa.attempt_id = v_attempt.id
    where q.test_id = v_attempt.test_id;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'test_id', v_attempt.test_id,
    'score', v_score,
    'max_score', v_max,
    'submitted_at', coalesce(v_attempt.submitted_at, now()),
    'analysis_available', v_analysis_available,
    'analysis_message', case
      when v_analysis_available then null
      else 'Your score is available, but answer-by-answer analysis will be released after the live test window ends.'
    end,
    'analysis', v_analysis
  );
end;
$$;

-- 1) Prevent direct PostgREST/table reads of the answer key as well.
-- SECURITY DEFINER exam functions can still read answer_keys, but students cannot
-- query the table directly. Admins retain management access.
do $
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'answer_keys'
  loop
    execute format('drop policy if exists %I on public.answer_keys', p.policyname);
  end loop;
end $;

alter table public.answer_keys enable row level security;

drop policy if exists answer_keys_admin_manage on public.answer_keys;
create policy answer_keys_admin_manage
on public.answer_keys
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Do not leave the SECURITY DEFINER RPC executable by anonymous/public roles.
revoke all on function public.submit_test_attempt(bigint) from public, anon;
grant execute on function public.submit_test_attempt(bigint) to authenticated;

-- get_attempt_analysis delegates to submit_test_attempt, so it inherits the
-- same server-side gate. Keep it callable only by authenticated users.
revoke all on function public.get_attempt_analysis(bigint) from public, anon;
grant execute on function public.get_attempt_analysis(bigint) to authenticated;

notify pgrst, 'reload schema';
