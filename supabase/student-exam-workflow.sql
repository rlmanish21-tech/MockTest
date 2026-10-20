-- LU Update student exam workflow. Run once in Supabase SQL Editor.
-- Allows a student to reattempt a test while retaining each attempt's history.
alter table public.attempts drop constraint if exists attempts_test_id_student_id_key;
create index if not exists attempts_student_test_started_idx
  on public.attempts(student_id, test_id, started_at desc);

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
  if v_user is null then raise exception 'Please sign in before attempting a test.'; end if;
  select * into v_test from public.tests where id=p_test_id and status='published';
  if not found then raise exception 'This test is not published or is no longer available.'; end if;
  if v_test.test_type='live' then
    if v_test.starts_at is not null and now()<v_test.starts_at then raise exception 'This live test has not started yet.'; end if;
    if v_test.ends_at is not null and now()>=v_test.ends_at then raise exception 'This live test has ended.'; end if;
  end if;
  select * into v_attempt from public.attempts
    where test_id=p_test_id and student_id=v_user and status='in_progress'
    order by started_at desc limit 1;
  if found then return jsonb_build_object('attempt_id',v_attempt.id,'resumed',true); end if;
  select count(*) into v_count from public.questions where test_id=p_test_id;
  if v_count<>v_test.question_count or v_count=0 then raise exception 'This test is not ready: expected % questions, found %.',v_test.question_count,v_count; end if;
  select count(*) into v_keys from public.answer_keys k join public.questions q on q.id=k.question_id where q.test_id=p_test_id;
  if v_keys<>v_count then raise exception 'This test is not ready because one or more correct answers are missing.'; end if;
  insert into public.attempts(test_id,student_id) values(p_test_id,v_user) returning * into v_attempt;
  return jsonb_build_object('attempt_id',v_attempt.id,'resumed',false);
end;
$$;
grant execute on function public.start_test_attempt(bigint) to authenticated;

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
begin
  if v_user is null then raise exception 'Please sign in first.'; end if;
  select * into v_attempt from public.attempts
   where id=p_attempt_id and student_id=v_user for update;
  if not found then raise exception 'Attempt not found for this account.'; end if;
  select * into v_test from public.tests where id=v_attempt.test_id;
  if v_attempt.status='in_progress' then
    select coalesce(sum(case
      when aa.selected_option is null then 0
      when upper(aa.selected_option)=upper(k.correct_option) then q.marks
      else -q.negative_marks end),0),
      coalesce(sum(q.marks),0)
      into v_score,v_max
    from public.questions q
    left join public.answer_keys k on k.question_id=q.id
    left join public.attempt_answers aa on aa.question_id=q.id and aa.attempt_id=v_attempt.id
    where q.test_id=v_attempt.test_id;

    update public.attempts set status='evaluated',submitted_at=now(),score=v_score,max_score=v_max where id=v_attempt.id;
    insert into public.results(test_id,student_id,score,max_score,rank,published_at)
      values(v_attempt.test_id,v_user,v_score,v_max,null,null)
      on conflict(test_id,student_id) do update set score=excluded.score,max_score=excluded.max_score,rank=null,published_at=null,created_at=now();
  else
    v_score:=coalesce(v_attempt.score,0); v_max:=coalesce(v_attempt.max_score,0);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id',q.id,'question_order',q.question_order,'question_text',q.question_text,
    'option_a',q.option_a,'option_b',q.option_b,'option_c',q.option_c,'option_d',q.option_d,
    'selected_option',aa.selected_option,'correct_option',k.correct_option,'marks',q.marks,
    'negative_marks',q.negative_marks,
    'earned',case when aa.selected_option is null then 0 when upper(aa.selected_option)=upper(k.correct_option) then q.marks else -q.negative_marks end
  ) order by q.question_order),'[]'::jsonb)
  into v_analysis
  from public.questions q
  join public.answer_keys k on k.question_id=q.id
  left join public.attempt_answers aa on aa.question_id=q.id and aa.attempt_id=v_attempt.id
  where q.test_id=v_attempt.test_id;

  return jsonb_build_object('attempt_id',v_attempt.id,'test_id',v_attempt.test_id,'score',v_score,'max_score',v_max,'submitted_at',coalesce(v_attempt.submitted_at,now()),'analysis',v_analysis);
end;
$$;
grant execute on function public.submit_test_attempt(bigint) to authenticated;

create or replace function public.get_attempt_analysis(p_attempt_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.attempts%rowtype;
begin
  if v_user is null then raise exception 'Please sign in first.'; end if;
  select * into v_attempt from public.attempts
   where id=p_attempt_id and student_id=v_user and status in ('submitted','evaluated');
  if not found then raise exception 'Analysis is available only for your submitted attempt.'; end if;
  return public.submit_test_attempt(p_attempt_id);
end;
$$;
grant execute on function public.get_attempt_analysis(bigint) to authenticated;

-- Stop answer edits once the attempt timer or live-test window has ended,
-- even if a student keeps the exam tab open or changes the browser clock.
drop policy if exists answers_write_own_attempt on public.attempt_answers;
create policy answers_write_own_attempt
  on public.attempt_answers
  for all to authenticated
  using (
    exists (
      select 1 from public.attempts a
      join public.tests t on t.id=a.test_id
      where a.id=attempt_id
        and a.student_id=auth.uid()
        and a.status='in_progress'
        and now() < a.started_at + make_interval(mins => t.duration_minutes)
        and (t.test_type <> 'live' or t.ends_at is null or now() < t.ends_at)
    )
  )
  with check (
    exists (
      select 1 from public.attempts a
      join public.tests t on t.id=a.test_id
      where a.id=attempt_id
        and a.student_id=auth.uid()
        and a.status='in_progress'
        and now() < a.started_at + make_interval(mins => t.duration_minutes)
        and (t.test_type <> 'live' or t.ends_at is null or now() < t.ends_at)
    )
  );

-- Refresh Supabase/PostgREST's function schema cache after applying this migration.
notify pgrst, 'reload schema';
