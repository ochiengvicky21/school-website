# Supabase launch setup

The site now uses Supabase for its public content, staff authentication, enquiries and cross-device updates. Public admissions, contact, visit and newsletter forms are protected by Cloudflare Turnstile and submit through an Edge Function. Staff replies are sent by email through Resend.

The frontend is static, so the Supabase project, domain, staff accounts, Turnstile widget and mail sender must be configured before launch. The school website does not contain or need a service-role key.

## 1. Create the Supabase project and database

1. Create a Supabase project and save its database password in a password manager.
2. Open **SQL Editor**, paste and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Confirm the `site_settings` row and sample `site_content` rows were created.
4. In **Project Settings → API**, copy the Project URL and the **publishable** key (or legacy `anon` key). Do not use a secret/service-role key in the browser.
5. Add those two public values to [`js/supabase-config.js`](./js/supabase-config.js).
6. To enable the uploads manager, public downloads, staff profiles and editable page sections, also run [`supabase/cms.sql`](./supabase/cms.sql) in SQL Editor. This creates the public asset bucket, its role-checked upload policies and the CMS metadata tables.

## 2. Create and assign staff accounts

1. In **Authentication → Providers → Email**, keep public sign-ups disabled. Set the production site URL and allowed redirect URLs for the deployed domain.
2. In **Authentication → Users**, invite staff accounts. Do not share one staff login between employees.
3. After an invite is accepted, run a role assignment in SQL Editor. Replace the email and role:

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin'
   from auth.users
   where lower(email) = lower('school-admin@example.org')
   on conflict (user_id) do update set role = excluded.role;
   ```

Available roles:

| Role | Access |
|---|---|
| `admin` | All dashboard sections, settings, all inbox categories, backup restore, and deletion |
| `editor` | Publish, edit and unpublish news, events and notices; upload and replace site media and page sections |
| `admissions` | View/reply to admission and campus-visit enquiries |
| `communications` | Publish public content and view/reply to contact, newsletter and visit messages |

Roles are assigned through the Supabase SQL Editor by an administrator. The application does not allow users to grant themselves roles. Row-level security in Postgres remains the authorization boundary; hiding dashboard sections is only a usability measure.

Administrators and editors can use **Website media & sections** to add and replace PDFs, Word documents and page-targeted photos (maximum 10 MB), manage public staff profiles and create custom text sections for supported pages. Uploaded files become public immediately; only administrators can delete stored files or sections. The `public-site` storage bucket is intentionally public for visitor downloads and images: never upload private records, student documents, or personal data to it.

## 3. Turn on protected public forms

1. Create a Cloudflare Turnstile widget for `melaninesacademy.vercel.app` (and a separate local-development hostname if needed).
2. Set its public site key in `turnstileSiteKey` in [`js/supabase-config.js`](./js/supabase-config.js).
3. Create a Supabase Edge Function secret for the matching private Turnstile secret. Never put this value in the website files.
4. Set `TURNSTILE_HOSTNAME` to the exact hostname used by the public website, without `https://` or a trailing slash.
5. Public form submissions are intentionally denied direct table inserts. They are saved by the `submit-public-message` Edge Function only after Turnstile verification.

Without the public Turnstile site key and the matching server-side secret/hostname configuration, the website keeps the public forms disabled and tells families to contact the school directly. Do not remove Turnstile or enable direct anonymous inserts to make a form appear active.

## 4. Configure school email and deploy Edge Functions

Verify a sender domain with Resend, including its DNS records, before sending real email. Set these **server-side Supabase Edge Function secrets** (never in `js/supabase-config.js`):

- `PUBLIC_SITE_ORIGIN` — exact public origin: `https://melaninesacademy.vercel.app`
- `TURNSTILE_SECRET_KEY` and `TURNSTILE_HOSTNAME` (`melaninesacademy.vercel.app`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `SCHOOL_FROM_EMAIL` — a verified sender, e.g. `School Office <office@example.org>` is not needed here; use only `office@example.org`
- `SCHOOL_INBOX_EMAIL` — where new admissions and contact notifications should arrive
- `SCHOOL_REPLY_TO` — optional staff reply address
- `SCHOOL_NAME` — optional display name override

The functions use the service-role key only inside Supabase to insert verified enquiries and record sent replies. Replies also verify the caller's Supabase session and database role before selecting an allowed recipient.

Install the Supabase CLI, authenticate, link the project, then deploy both functions with JWT verification enabled:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set --project-ref YOUR_PROJECT_REF --env-file .env.supabase
npx supabase functions deploy submit-public-message --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-public-reply --project-ref YOUR_PROJECT_REF
```

Create `.env.supabase` locally with the secret values above, keep it out of source control, and delete it securely after setting the remote secrets. The Supabase project URL and public anon/publishable key in `js/supabase-config.js` are designed to be public; the service-role and email-provider keys are not.

New enquiries are stored in the shared database, appear in authorized staff inboxes, and trigger an email notification when Resend is configured. Staff replies go to the family's submitted email address. A message is marked handled after the email provider confirms delivery.

## 5. Deploy and verify

Host the static website on HTTPS (for example, Cloudflare Pages, Netlify, or a static web host). Configure the same origin in Supabase Auth, `PUBLIC_SITE_ORIGIN`, and the Cloudflare Turnstile hostname. Deploy all HTML, CSS, JS, images, the admission PDF, and `supabase-config.js`.

Before announcing the site:

1. Sign in at `/admin.html` with an invited `admin` account.
2. Upload a test document, photo and staff profile; verify the public Downloads, Gallery and Staff pages update.
3. Add a custom page section and verify it appears on the selected public page.
4. Publish a test notice and verify it appears on the public homepage on another device.
5. Submit an admission enquiry and a contact message using valid Turnstile checks.
6. Confirm each message appears only to staff with the corresponding role and arrives at `SCHOOL_INBOX_EMAIL`.
7. Send a test staff reply and confirm it is delivered to the submitter.
8. Test an unassigned account: it must not enter the dashboard. Test each non-admin role against both an allowed and a denied inbox/content category.
9. Review Supabase **Database → Policies** and function logs; never disable RLS to make a failed request work.

For production, also configure database backups/retention, Supabase Auth email delivery, a privacy notice and an appropriate data-retention policy for student and guardian enquiries.
