-- LU Update: add a subject label to each test.
-- Run this once in Supabase SQL Editor before using subject selection/filtering.
alter table public.tests add column if not exists subject text not null default 'General / Mixed';

update public.tests set subject = 'General / Mixed' where subject is null or btrim(subject) = '';
