-- LU Update: secure answer saving through a validated RPC.
-- Run once in Supabase SQL Editor on an existing project.
-- This also supports the Mark for Review flag if its earlier migration was not applied.

alter table public.attempt_answers
  add column if not exists marked_for_review boolean not null default false;

create or replace function public.save_attempt_answer(
  p_attempt_id bigint,
  p_question_id bigint,
  p_selected_option text,
  p_marked_for_review boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.attempts%rowtype;
  v_test public.tests%rowtype;
begin
  if v_user is null then
    raise exception 'Please sign in before saving an answer.';
  end if;

  select * into v_attempt
    from public.attempts
   where id = p_attempt_id
     and student_id = v_user
   for update;

  if not found then
    raise exception 'This attempt does not belong to the signed-in student.';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'This attempt is no longer in progress. Answers cannot be changed.';
  end if;

  select * into v_test from public.tests where id = v_attempt.test_id;
  if not found then
    raise exception 'The test for this attempt could not be found.';
  end if;
  if now() >= v_attempt.started_at + make_interval(mins => v_test.duration_minutes) then
    raise exception 'The test time has expired. Your answers can no longer be changed.';
  end if;
  if v_test.test_type = 'live'
     and v_test.ends_at is not null
     and now() >= v_test.ends_at
     and v_attempt.started_at < v_test.ends_at + interval '2 hours' then
    raise exception 'The live test window has ended. Answers can no longer be changed.';
  end if;
  if not exists (
    select 1 from public.questions q
     where q.id = p_question_id and q.test_id = v_attempt.test_id
  ) then
    raise exception 'This question does not belong to the selected test.';
  end if;
  if p_selected_option is not null
     and p_selected_option not in ('A','B','C','D') then
    raise exception 'Selected option must be A, B, C, D, or empty.';
  end if;

  insert into public.attempt_answers
    (attempt_id, question_id, selected_option, marked_for_review, saved_at)
  values
    (v_attempt.id, p_question_id, p_selected_option, coalesce(p_marked_for_review, false), now())
  on conflict (attempt_id, question_id) do update
    set selected_option = excluded.selected_option,
        marked_for_review = excluded.marked_for_review,
        saved_at = now();
end;
$$;

revoke all on function public.save_attempt_answer(bigint, bigint, text, boolean) from public, anon;
grant execute on function public.save_attempt_answer(bigint, bigint, text, boolean) to authenticated;

notify pgrst, 'reload schema';
