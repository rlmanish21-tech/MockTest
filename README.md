# LU Update — All India Mock Entrance Test

Starter application using GitHub Pages for the static frontend and Supabase for authentication and database services.

## Pages
- `index.html`: student-facing homepage
- `register.html` and `login.html`: separate student pages
- `dashboard.html`: student dashboard
- `admin.html` and `admin-dashboard.html`: separate owner portal

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Add the project URL and publishable/anon key to `config.js`.
4. Configure Supabase Auth for phone + password sign-in. Student login uses the registered mobile number and DOB as requested; DOB is weak as a password, so apply rate limits and consider a stronger credential flow before production.
5. Create the owner account in Supabase Auth, then promote only that trusted account to `admin` using the SQL instructions in the schema.
6. In GitHub, open Settings → Pages, select Deploy from branch → `main` → `/(root)`.

## Important
- GitHub Pages serves static files only; it cannot run PHP. Supabase is the backend service.
- Never add a Supabase secret/service-role key to browser code or this repository. Only a publishable/anon key belongs in `config.js`, and it must be paired with tested Row Level Security policies.
- The app is a starter and is not launch-ready until auth, RLS, timed exam submission, scoring, result approval and load testing are verified.
- Do not accept real exam registrations until the database policies and student/owner workflows are tested.
