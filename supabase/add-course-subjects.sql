-- Run this migration in Supabase SQL Editor for an existing LU Update database.
-- Stores the subject names for each course as an array, sourced from the admin course upload's third column.
alter table public.courses
  add column if not exists subjects text[] not null default '{}';

update public.courses
set subjects = '{}'
where subjects is null;
