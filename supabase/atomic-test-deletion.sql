-- LU Update: atomic, owner-only permanent deletion of a test and its student history.
-- Run this file once in Supabase SQL Editor before using the Delete test button.
-- This function executes in one transaction: any error rolls back every delete.

create or replace function public.delete_test_completely(p_test_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;

  if not coalesce(public.is_admin(), false) then
    raise exception 'Owner access is required to delete a test.';
  end if;

  if not exists (select 1 from public.tests where id = p_test_id) then
    raise exception 'Test not found or already deleted.';
  end if;

  delete from public.results where test_id = p_test_id;

  delete from public.attempt_answers aa
  using public.attempts a
  where aa.attempt_id = a.id
    and a.test_id = p_test_id;

  delete from public.attempts where test_id = p_test_id;

  delete from public.answer_keys ak
  using public.questions q
  where ak.question_id = q.id
    and q.test_id = p_test_id;

  delete from public.questions where test_id = p_test_id;
  delete from public.test_courses where test_id = p_test_id;
  delete from public.tests where id = p_test_id;
end;
$$;

revoke all on function public.delete_test_completely(bigint) from public, anon;
grant execute on function public.delete_test_completely(bigint) to authenticated;

notify pgrst, 'reload schema';
