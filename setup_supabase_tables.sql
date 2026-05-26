-- Supabase Database Schema Setup Script
-- Run these statements in your Supabase SQL Editor to prepare your database for Day 1 & Day 2 features.

-- 1. Create user_profiles table (singleton pattern for user profile context)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  name text,
  degree text,
  college text,
  cgpa text,
  skills text,
  target_role text,
  linkedin text,
  github text,
  projects text,
  tone text DEFAULT 'confident, builder, not desperate',
  profile_modes jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Migration statements to add columns if table already exists
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_modes jsonb DEFAULT '{}'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_contacts jsonb DEFAULT '[]'::jsonb;

-- 2. Create emails table to log sent/failed attempts
CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text,
  hr_name text,
  hr_email text,
  subject text,
  body text,
  status text DEFAULT 'sent', -- 'sent', 'failed', 'replied'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Create events table to track timeline activities
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- e.g., 'sent', 'failed', 'reply_received'
  company text,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()),
  details jsonb DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (optional - default is open for anonymous access if keys allow)
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
