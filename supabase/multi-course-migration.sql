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

-- Allow the owner to permanently remove a test and its dependent records.
-- Deleting a test also deletes attempts, saved answers (via attempts), and results.
alter table public.attempts drop constraint if exists attempts_test_id_fkey;
alter table public.attempts add constraint attempts_test_id_fkey
  foreign key (test_id) references public.tests(id) on delete cascade;
alter table public.results drop constraint if exists results_test_id_fkey;
alter table public.results add constraint results_test_id_fkey
  foreign key (test_id) references public.tests(id) on delete cascade;
