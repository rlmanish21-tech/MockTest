-- LU Update: enable one test to be assigned to multiple courses.
-- Run this once in Supabase SQL Editor for the existing project.
create table if not exists public.test_courses (
  test_id bigint not null references public.tests(id) on delete cascade,
  course_id bigint not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (test_id, course_id)
);

alter table public.test_courses enable row level security;
drop policy if exists test_courses_admin_all on public.test_courses;
create policy test_courses_admin_all
  on public.test_courses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Preserve the existing single course association for older tests.
insert into public.test_courses (test_id, course_id)
select id, course_id
from public.tests
where course_id is not null
on conflict (test_id, course_id) do nothing;
