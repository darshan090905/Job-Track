# JobTrack — Personal Job Application Tracker + Job Sharing Platform

A clean, fast, and feature-rich web application for tracking job applications, sharing job opportunities with friends, and managing walk-in drives — built with React, TypeScript, Vite, Tailwind CSS, and Supabase.

---

## Features

### Personal Job Tracker
- Add and manage private job applications
- Track status: Saved → Applied → Assessment → Interview → Offer / Rejected / Withdrawn
- Store the exact resume used for each application
- Add follow-up dates, notes, salary, and job source
- Application timeline (events log)
- Search, filter, and sort applications
- Export to CSV

### Resume Management
- Upload PDF resumes to a private Supabase Storage bucket
- Manage multiple resume versions (DevOps Resume v1, v2, v3...)
- Track which resume was used for each application
- Historical resume relationships are preserved even after uploading new versions
- Archive old resumes

### Job Feed (Shared Jobs)
- Share job links publicly (Everyone), with friends only, or keep private
- Browse jobs shared by other users
- Filter by friend, company, role, location, source, and date
- Live search across all fields
- Save any shared job into your private tracker with one click
- Duplicate detection warns if you already have the job

### Walk-in Drives
- Add walk-in drives with full details (company, role, date, time, location, resume)
- Default checklist (resume printed, ID proof, etc.)
- Custom checklist items
- Share walk-ins publicly or with friends
- Save shared walk-ins into your own list
- Walk-in reminder dashboard widget (today + tomorrow)

### Email Reminders
- Add multiple notification email addresses (personal, family, backup)
- Enable/disable individual emails
- Automated walk-in reminder emails sent 1 day before the drive
- Uses Resend via Supabase Edge Functions (API key is server-side only)
- Duplicate email prevention (`reminder_sent` flag)

### Friends System
- Find users by email and send friend requests
- Accept, reject, or remove friends
- Friends-only job/walk-in visibility

### Analytics
- Status distribution pie chart
- Applications by source
- Applications over time (last 30 days)
- Resume usage statistics
- Top job roles
- Count of jobs saved from the shared feed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| Charts | Recharts |
| Date utilities | date-fns |
| Routing | React Router v6 |
| Backend / Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| File Storage | Supabase Storage (private bucket) |
| Server-side logic | Supabase Edge Functions (Deno) |
| Email | Resend |
| Deployment | Netlify / Vercel |

---

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd jobtrack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Supabase Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the Database Migration

Open your Supabase project → SQL Editor → paste and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, indexes, RLS policies, and the auto-profile trigger.

### 3. Authentication

In your Supabase project:
- **Authentication → Settings**: Enable Email/Password sign-in.
- Optionally configure the **Site URL** and **Redirect URLs** to match your deployment URL.

### 4. Storage

Create a private storage bucket for resumes:
- Go to **Storage → New bucket**
- Name: `resumes`
- Toggle **Private bucket** ON
- Click **Create**

Then add storage RLS policies so users can only access their own files:

```sql
-- Allow authenticated users to upload their own resumes
CREATE POLICY "upload_own_resumes" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to read their own resumes
CREATE POLICY "read_own_resumes" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own resumes
CREATE POLICY "delete_own_resumes" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 5. Row Level Security (RLS)

RLS is automatically configured by the migration script:

| Table | Policy |
|---|---|
| `profiles` | Users can read all profiles (for friend lookup), update only their own |
| `resumes` | Private — only owner can read/write |
| `jobs` | Owner has full access; others see based on visibility setting |
| `application_events` | Private — owner only |
| `walkin_drives` | Owner has full access; others see based on visibility |
| `walkin_checklist` | Owner only (via walkin ownership) |
| `notification_emails` | Private — owner only |
| `friend_requests` | Sender and receiver can read; only sender can create |

---

## Email Reminders — Supabase Edge Functions

### Email Provider

This project uses [Resend](https://resend.com) for transactional emails. Sign up for a free account and create an API key.

> **Never put the Resend API key in your frontend `.env` file.** It is stored as a Supabase secret.

### Setup

#### 1. Install the Supabase CLI

```bash
npm install -g supabase
supabase login
```

#### 2. Link your project

```bash
supabase link --project-ref your-project-id
```

#### 3. Set secrets

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set EMAIL_FROM="JobTrack <noreply@yourdomain.com>"
```

#### 4. Deploy the Edge Function

```bash
supabase functions deploy send-walkin-reminders
```

#### 5. Schedule the function to run daily

In your Supabase project → **Database → Extensions**, enable `pg_cron`.

Then in the SQL Editor:

```sql
-- Run every day at 08:00 UTC
SELECT cron.schedule(
  'send-walkin-reminders',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project-id.supabase.co/functions/v1/send-walkin-reminders',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) AS request_id;
  $$
);
```

Replace `your-project-id` and `YOUR_ANON_KEY` with your actual values.

### How it works

1. The Edge Function runs daily at 08:00 UTC.
2. It finds all walk-in drives scheduled for **tomorrow** where:
   - `reminder_enabled = true`
   - `email_reminder = true`
   - `reminder_sent = false`
3. For each walk-in, it fetches all **enabled notification emails** for that user.
4. It sends a formatted HTML reminder email via Resend to all enabled addresses.
5. After successful sending, it sets `reminder_sent = true` to prevent duplicate emails.

---

## Environment Variables

### Frontend (`.env`)

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Server-side (Supabase Secrets — never in frontend `.env`)

```
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
```

---

## Running Locally

```bash
npm run dev
```

## Building for Production

```bash
npm run build
```

Output goes to `dist/`.

---

## Deploying

### Netlify

1. Push to GitHub.
2. Connect your repo in Netlify.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables in Netlify → Site settings → Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Vercel

1. Push to GitHub.
2. Import your project in Vercel.
3. Framework preset: **Vite**
4. Add environment variables in Vercel project settings.

---

## Project Structure

```
jobtrack/
├── src/
│   ├── components/
│   │   ├── JobModal.tsx
│   │   ├── JobDetailModal.tsx
│   │   └── WalkinModal.tsx
│   ├── pages/
│   │   ├── Auth/
│   │   ├── Dashboard/
│   │   ├── Applications/
│   │   ├── JobFeed/
│   │   ├── Walkins/
│   │   ├── Resumes/
│   │   ├── Analytics/
│   │   ├── Friends/
│   │   └── Settings/
│   ├── layouts/AppLayout.tsx
│   ├── hooks/
│   │   ├── useAuth.tsx
│   │   └── useToast.tsx
│   ├── lib/supabase.ts
│   ├── types/index.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   └── functions/send-walkin-reminders/index.ts
├── .env.example
├── package.json
└── README.md
```

---

## Troubleshooting

**"Invalid API key" on signup/login**
- Double-check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your `.env` file.

**Profile not created after signup**
- Ensure the `handle_new_user` trigger in the SQL migration was executed successfully.
- Check the `profiles` table in Supabase for your user record.

**Resume upload fails**
- Make sure the `resumes` storage bucket exists and is set to **private**.
- Check that the Storage RLS policies are applied.

**Reminder emails not sending**
- Verify `RESEND_API_KEY` is set as a Supabase secret (`supabase secrets list`).
- Confirm the `send-walkin-reminders` function is deployed (`supabase functions list`).
- Check `reminder_enabled = true` and `email_reminder = true` on the walk-in.
- Make sure at least one notification email is added and **enabled** in Settings.
- Check that `reminder_sent` is `false` (emails won't re-send if already marked as sent).

**Friends filter not working in Job Feed**
- Ensure friend requests are **accepted** (status = 'accepted') in the `friend_requests` table.

---

## Security Notes

- **RLS** is enabled on all tables — private data never leaks through shared feeds.
- Resumes are stored in a **private** Supabase Storage bucket with user-scoped signed URLs.
- `RESEND_API_KEY` is a server-side Supabase secret and is **never** exposed to the frontend.
- Application details (resume used, private notes, timeline, interview status) are **never** visible to other users, even if a job is shared publicly.

---

## License

MIT
