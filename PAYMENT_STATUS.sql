-- ============================================================
-- Add payment_status column to bookings table
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'paid'));

-- Done ✓
