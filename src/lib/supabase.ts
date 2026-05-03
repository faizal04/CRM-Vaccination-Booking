import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Types ────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  role: 'user' | 'admin'
  created_at: string
}

export type FamilyMember = {
  id: string
  user_id: string
  name: string
  age: number | null
  relation: string | null
  created_at: string
}

export type Booking = {
  id: string
  user_id: string | null
  patient_name: string
  age: string | null
  booked_by: string | null
  relation: string | null
  phone: string | null
  email: string | null
  vaccine: string
  date: string
  location: string | null
  address: string | null
  notes: string | null
  status: 'pending' | 'done' | 'missed'
  payment_status: 'pending' | 'paid'
  submitted_at: string
  created_at: string
}
