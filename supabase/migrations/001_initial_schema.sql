-- ============================================================
-- JobTrack — Supabase Database Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESUMES
-- ============================================================
CREATE TABLE IF NOT EXISTS resumes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  description TEXT,
  file_path TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  location TEXT,
  job_url TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','applied','assessment','interview','offer','rejected','withdrawn')),
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  salary TEXT,
  notes TEXT,
  applied_date DATE,
  follow_up_date DATE,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('everyone','friends','private')),
  source_shared_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_visibility ON jobs(visibility);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- ============================================================
-- APPLICATION EVENTS (Timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS application_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_job_id ON application_events(job_id);

-- ============================================================
-- WALKIN DRIVES
-- ============================================================
CREATE TABLE IF NOT EXISTS walkin_drives (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  address TEXT,
  registration_url TEXT,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  contact_details TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','completed','cancelled')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('everyone','friends','private')),
  reminder_enabled BOOLEAN DEFAULT TRUE,
  reminder_days_before INTEGER DEFAULT 1,
  email_reminder BOOLEAN DEFAULT FALSE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  source_shared_walkin_id UUID REFERENCES walkin_drives(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_walkins_user_id ON walkin_drives(user_id);
CREATE INDEX IF NOT EXISTS idx_walkins_date ON walkin_drives(date);
CREATE INDEX IF NOT EXISTS idx_walkins_visibility ON walkin_drives(visibility);

-- ============================================================
-- WALKIN CHECKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS walkin_checklist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  walkin_id UUID REFERENCES walkin_drives(id) ON DELETE CASCADE NOT NULL,
  item TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- NOTIFICATION EMAILS
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_emails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FRIEND REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_user_id, receiver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_sender ON friend_requests(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_friends_receiver ON friend_requests(receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friend_requests(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkin_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkin_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id OR TRUE);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- RESUMES (private)
DROP POLICY IF EXISTS "resumes_own" ON resumes;
DROP POLICY IF EXISTS "resumes_insert" ON resumes;
CREATE POLICY "resumes_own" ON resumes USING (auth.uid() = user_id);
CREATE POLICY "resumes_insert" ON resumes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- JOBS (private + shared visibility)
DROP POLICY IF EXISTS "jobs_own_all" ON jobs;
DROP POLICY IF EXISTS "jobs_insert_own" ON jobs;
DROP POLICY IF EXISTS "jobs_select_everyone" ON jobs;
DROP POLICY IF EXISTS "jobs_select_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON jobs;

CREATE POLICY "jobs_select_policy" ON jobs FOR SELECT USING (
  auth.uid() = user_id 
  OR visibility = 'everyone'
  OR (
    visibility = 'friends' 
    AND EXISTS (
      SELECT 1 FROM friend_requests fr 
      WHERE fr.status = 'accepted' 
      AND (
        (fr.sender_user_id = auth.uid() AND fr.receiver_user_id = jobs.user_id)
        OR (fr.receiver_user_id = auth.uid() AND fr.sender_user_id = jobs.user_id)
      )
    )
  )
);
CREATE POLICY "jobs_insert_policy" ON jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jobs_update_policy" ON jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "jobs_delete_policy" ON jobs FOR DELETE USING (auth.uid() = user_id);

-- APPLICATION EVENTS (private - only owner)
DROP POLICY IF EXISTS "events_own" ON application_events;
DROP POLICY IF EXISTS "events_insert" ON application_events;
CREATE POLICY "events_own" ON application_events USING (auth.uid() = user_id);
CREATE POLICY "events_insert" ON application_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- WALKIN DRIVES
DROP POLICY IF EXISTS "walkins_own" ON walkin_drives;
DROP POLICY IF EXISTS "walkins_insert_own" ON walkin_drives;
DROP POLICY IF EXISTS "walkins_select_shared" ON walkin_drives;
DROP POLICY IF EXISTS "walkins_select_policy" ON walkin_drives;
DROP POLICY IF EXISTS "walkins_insert_policy" ON walkin_drives;
DROP POLICY IF EXISTS "walkins_update_policy" ON walkin_drives;
DROP POLICY IF EXISTS "walkins_delete_policy" ON walkin_drives;

CREATE POLICY "walkins_select_policy" ON walkin_drives FOR SELECT USING (
  auth.uid() = user_id 
  OR visibility = 'everyone'
  OR (
    visibility = 'friends' 
    AND EXISTS (
      SELECT 1 FROM friend_requests fr 
      WHERE fr.status = 'accepted' 
      AND (
        (fr.sender_user_id = auth.uid() AND fr.receiver_user_id = walkin_drives.user_id)
        OR (fr.receiver_user_id = auth.uid() AND fr.sender_user_id = walkin_drives.user_id)
      )
    )
  )
);
CREATE POLICY "walkins_insert_policy" ON walkin_drives FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "walkins_update_policy" ON walkin_drives FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "walkins_delete_policy" ON walkin_drives FOR DELETE USING (auth.uid() = user_id);

-- WALKIN CHECKLIST
DROP POLICY IF EXISTS "checklist_own" ON walkin_checklist;
DROP POLICY IF EXISTS "checklist_insert" ON walkin_checklist;
DROP POLICY IF EXISTS "checklist_update" ON walkin_checklist;
CREATE POLICY "checklist_own" ON walkin_checklist USING (
  EXISTS (SELECT 1 FROM walkin_drives wd WHERE wd.id = walkin_checklist.walkin_id AND wd.user_id = auth.uid())
);
CREATE POLICY "checklist_insert" ON walkin_checklist FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM walkin_drives wd WHERE wd.id = walkin_id AND wd.user_id = auth.uid())
);
CREATE POLICY "checklist_update" ON walkin_checklist FOR UPDATE USING (
  EXISTS (SELECT 1 FROM walkin_drives wd WHERE wd.id = walkin_checklist.walkin_id AND wd.user_id = auth.uid())
);

-- NOTIFICATION EMAILS
DROP POLICY IF EXISTS "notif_emails_own" ON notification_emails;
DROP POLICY IF EXISTS "notif_emails_insert" ON notification_emails;
CREATE POLICY "notif_emails_own" ON notification_emails USING (auth.uid() = user_id);
CREATE POLICY "notif_emails_insert" ON notification_emails FOR INSERT WITH CHECK (auth.uid() = user_id);

-- FRIEND REQUESTS
DROP POLICY IF EXISTS "friends_own" ON friend_requests;
DROP POLICY IF EXISTS "friends_insert" ON friend_requests;
DROP POLICY IF EXISTS "friends_update" ON friend_requests;
CREATE POLICY "friends_own" ON friend_requests USING (
  auth.uid() = sender_user_id OR auth.uid() = receiver_user_id
);
CREATE POLICY "friends_insert" ON friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_user_id);
CREATE POLICY "friends_update" ON friend_requests FOR UPDATE USING (
  auth.uid() = receiver_user_id OR auth.uid() = sender_user_id
);

-- ============================================================
-- STORAGE BUCKET & POLICIES
-- ============================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "resumes_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_delete" ON storage.objects;

CREATE POLICY "resumes_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "resumes_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "resumes_storage_update" ON storage.objects FOR UPDATE USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "resumes_storage_delete" ON storage.objects FOR DELETE USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User'),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    email = COALESCE(EXCLUDED.email, public.profiles.email);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
