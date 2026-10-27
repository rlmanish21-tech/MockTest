-- LU Update: support table-based questions and include table data in result analysis.
-- Run this file once in Supabase SQL Editor before importing table-based questions.
alter table public.questions add column if not exists table_data text;

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
    'question_id',q.id,'question_order',q.question_order,'question_text',q.question_text,'table_data',q.table_data,
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

notify pgrst, 'reload schema';
