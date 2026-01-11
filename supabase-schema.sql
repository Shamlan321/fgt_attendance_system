-- Supabase SQL Schema for Attendance System
-- Run this in your Supabase SQL Editor

-- Create attendance_logs table
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date VARCHAR(10) NOT NULL,
  time VARCHAR(8) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(date);
CREATE INDEX IF NOT EXISTS idx_attendance_name ON attendance_logs(name);
CREATE INDEX IF NOT EXISTS idx_attendance_name_date ON attendance_logs(name, date);

-- Enable Row Level Security (RLS)
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can customize this later)
CREATE POLICY "Allow all operations on attendance_logs" 
ON attendance_logs 
FOR ALL 
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Optional: Create a view for today's attendance
CREATE OR REPLACE VIEW todays_attendance AS
SELECT DISTINCT name, date, time, synced_at
FROM attendance_logs
WHERE date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
ORDER BY synced_at DESC;
