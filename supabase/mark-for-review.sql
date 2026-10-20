-- LU Update: persist question-level "Mark for review" flags.
-- Run once in Supabase SQL Editor.
alter table public.attempt_answers
  add column if not exists marked_for_review boolean not null default false;

notify pgrst, 'reload schema';
