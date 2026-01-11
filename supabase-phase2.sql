-- Phase 2: Check-in/Out and Settings Migration
-- Run this in your Supabase SQL Editor

-- 1. Add type column to attendance_logs
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'check_in'; 
-- This will store 'check_in' or 'check_out'

-- 2. Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(50) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
);

-- 3. Insert default settings
INSERT INTO system_settings (key, value) 
VALUES 
  ('standard_check_in', '09:00'),
  ('standard_check_out', '17:00'),
  ('overtime_threshold', '20:00')
ON CONFLICT (key) DO NOTHING;

-- 4. Enable RLS on settings table
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 5. Allow read access to everyone (authenticated and anon)
CREATE POLICY "Allow read access to system_settings" 
ON system_settings 
FOR SELECT 
TO authenticated, anon
USING (true);

-- 6. Allow update access only to authenticated users (or everyone for now based on your auth setup)
-- Simplification: allowing all operations for now, similar to logs
CREATE POLICY "Allow all operations on system_settings" 
ON system_settings 
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);
