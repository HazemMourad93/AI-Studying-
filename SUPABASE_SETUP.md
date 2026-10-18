# Supabase cross-browser sync for the THL AI Interviewer study dashboard

The **33-day GitHub Pages dashboard** can store progress, optional resources and theme for each signed-in user.

## Setup (one time)

1. Create/select a Supabase project: https://supabase.com/dashboard/projects
2. In **SQL Editor**, run [supabase-schema.sql](./supabase-schema.sql). This creates private user-owned tables with RLS enabled.
3. Under **Authentication → Providers → Email**, enable email OTP/magic links.
4. Under **Authentication → URL Configuration**, set your Site URL and add this redirect URL:
   `https://hazemmourad93.github.io/AI-Studying-/`
5. In **Project Connect / Settings → API Keys**, copy the Project URL (`https://....supabase.co`) and **publishable** API key (`sb_publishable_...`). Edit [supabase-config.js](./supabase-config.js) with those two **public** values only. Do **NOT** use a secret/service_role key.
6. Open the published website, enter your email in **Cloud sync**, click **Email me a sign-in link**, follow the email, and wait for the page to show **Synced**.
7. Sign in with the **same email** from a second browser, and press **Sync now** if needed.

## Existing progress safety

- Existing checked tasks remain saved under the original browser key (`thl_ai_interviewer_7day_v2`).
- On first successful sign-in, local-only task state is uploaded to the user's cloud record **only for IDs not already stored in the cloud**. Cloud state already saved for an item wins, unless there is an explicit unsynced local action.
- The static site's **Download backup** button exports all current checked values, optional-resource checks and theme. **Restore backup** merges checked items without erasing existing completions.
- Offline edits are kept locally and queued for upload on the next connection/login. If the cloud is unreachable, the site must **not** claim changes are synced.
- Cloud sync is an extra feature. Without URL/key/schema/Auth setup, site works with localStorage/backup only.

## Security and deployment

Supabase publishable keys can be present in public client-side source **when** RLS is properly enabled and tested. They are not authentication secrets. Keep service-role and secret keys entirely off GitHub Pages. Do not store private candidate/interview data in these tables: only checklist IDs, booleans and the site's light/dark preference.

The site remains hosted on **GitHub Pages**. Its database and authentication live in Supabase.
