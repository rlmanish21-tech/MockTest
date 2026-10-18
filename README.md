# LU Update — All India Mock Entrance Test

Frontend starter using **GitHub Pages** and **Supabase**. Student pages and the owner workspace are separate.

## Current pages
- `index.html`: public student homepage (no owner portal link)
- `register.html`: one-time student registration
- `login.html`: returning student login
- `dashboard.html`: student dashboard and published test list
- `admin.html`: separate owner login
- `admin-dashboard.html`: owner course/test management and result review starter
- `supabase/schema.sql`: database tables and Row Level Security (RLS) policies
- `question-template.csv`: sample CSV question format

## 1. Configure Supabase
1. Create a Supabase project.
2. In SQL Editor, run `supabase/schema.sql`.
3. In Project Settings → API, copy the Project URL and **publishable/anon key** into `config.js`.
4. In Authentication settings, configure Phone sign-in and password sign-in. To follow the requested no-OTP registration, phone confirmation must be disabled; test this carefully before using real student data.
5. Add the GitHub Pages URL to Supabase Authentication → URL Configuration / allowed redirect URLs.

### Create the owner account
1. Create the owner login in Supabase Authentication (email + password).
2. Copy that user's UUID from Authentication → Users.
3. In SQL Editor, create a profile for that UUID using the owner's actual details. Example (replace every placeholder and use a unique real mobile number):

```sql
insert into public.profiles
(id, full_name, mobile, date_of_birth, stream, course_name, state, city, qualification, marketing_consent, role)
values
('OWNER-AUTH-USER-UUID', 'Owner Name', 'OWNER_MOBILE_10_DIGITS', '1990-01-01',
 'Commerce', 'Administration', 'Uttar Pradesh', 'Lucknow', 'Other', false, 'admin')
on conflict (id) do update set role = 'admin';
```

Do not share owner credentials. Use the SQL Editor only from your own trusted Supabase project.

## 2. Configure GitHub Pages
A GitHub Actions workflow is included at `.github/workflows/pages.yml`.
1. Open this repository's **Settings → Pages**.
2. Set the build/deployment source to **GitHub Actions**.
3. Open the **Actions** tab and wait for the Pages deployment workflow to finish.
4. Your site URL will be shown in the workflow deployment result and Settings → Pages.

Every push to `main` triggers a deployment.

## Security and launch limitations
- GitHub Pages hosts static files only; Supabase provides authentication and database services. PHP does not run on GitHub Pages.
- Only the Supabase publishable/anon key may be used in `config.js`. **Never commit a service-role/secret key.**
- Student login currently uses mobile number + date of birth as requested. DOB is a weak password; enable rate limits and reconsider this before storing sensitive information.
- RLS and authentication settings must be tested in the actual Supabase project.
- This is an early working scaffold, not a production exam system. The complete timed exam runner, server-authoritative answer submission/scoring, question import workflow, rank calculation, robust result approval and 2,000+ concurrent-user load testing are not finished/verified. Do not use it for real high-stakes tests until these are implemented and tested.
