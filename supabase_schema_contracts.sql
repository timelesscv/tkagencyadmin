-- =========================================================================
-- TK AGENCY CONTRACTS & APPLICANTS SCHEMA
-- Run this script inside your Supabase Project:
-- Supabase Dashboard -> SQL Editor -> New query -> Paste and click 'Run'
-- =========================================================================

-- 1. Create the unified 'applicant_contracts' table that stores ALL fields from the New Contract form
CREATE TABLE IF NOT EXISTS public.applicant_contracts (
  id UUID PRIMARY KEY,
  ref_number TEXT,
  labor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  passport_number TEXT,
  place_of_birth TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  date_of_birth TEXT,
  age TEXT,
  religion TEXT,
  marital_status TEXT,
  number_of_children TEXT,
  height TEXT,
  weight TEXT,
  coc TEXT DEFAULT 'no',
  preferred_country TEXT DEFAULT 'kuwait',
  english_proficiency TEXT,
  arabic_proficiency TEXT,
  has_previous_experience BOOLEAN DEFAULT false,
  employment_records JSONB DEFAULT '[]'::jsonb,
  competencies JSONB DEFAULT '{}'::jsonb,
  broker_name TEXT,
  broker_number TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_address TEXT,
  status TEXT DEFAULT 'available',
  office TEXT,
  face_photo TEXT,
  full_body_photo TEXT,
  passport_photo TEXT,
  is_special_case BOOLEAN DEFAULT false,
  special_case_note TEXT,
  visa_arrived_date TEXT,
  airline TEXT,
  departure_date TEXT,
  ticket_price TEXT,
  transit TEXT,
  commission_paid TEXT,
  commission_amount TEXT,
  contract_date TEXT,
  seed TEXT,
  generated_cvs JSONB DEFAULT '[]'::jsonb,
  assigned_office_cv JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) and grant read/write permissions
ALTER TABLE public.applicant_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access on applicant_contracts" ON public.applicant_contracts;
CREATE POLICY "Allow full access on applicant_contracts"
  ON public.applicant_contracts FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Enhance existing 'candidates' table with all contract, broker & deployment columns
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS labor_id TEXT,
  ADD COLUMN IF NOT EXISTS ref_number TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS issue_date TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date TEXT,
  ADD COLUMN IF NOT EXISTS number_of_children TEXT,
  ADD COLUMN IF NOT EXISTS height TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT,
  ADD COLUMN IF NOT EXISTS coc TEXT,
  ADD COLUMN IF NOT EXISTS english_proficiency TEXT,
  ADD COLUMN IF NOT EXISTS arabic_proficiency TEXT,
  ADD COLUMN IF NOT EXISTS broker_name TEXT,
  ADD COLUMN IF NOT EXISTS broker_number TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_address TEXT,
  ADD COLUMN IF NOT EXISTS office TEXT,
  ADD COLUMN IF NOT EXISTS is_special_case BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS visa_arrived_date TEXT,
  ADD COLUMN IF NOT EXISTS airline TEXT,
  ADD COLUMN IF NOT EXISTS departure_date TEXT,
  ADD COLUMN IF NOT EXISTS ticket_price TEXT,
  ADD COLUMN IF NOT EXISTS transit TEXT,
  ADD COLUMN IF NOT EXISTS commission_paid TEXT,
  ADD COLUMN IF NOT EXISTS commission_amount TEXT,
  ADD COLUMN IF NOT EXISTS employment_records JSONB,
  ADD COLUMN IF NOT EXISTS competencies JSONB,
  ADD COLUMN IF NOT EXISTS generated_cvs JSONB,
  ADD COLUMN IF NOT EXISTS assigned_office_cv JSONB;

-- 3. Enhance existing 'contracts' table with matching broker and deployment columns
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS labor_id TEXT,
  ADD COLUMN IF NOT EXISTS ref_number TEXT,
  ADD COLUMN IF NOT EXISTS broker_name TEXT,
  ADD COLUMN IF NOT EXISTS broker_number TEXT,
  ADD COLUMN IF NOT EXISTS office TEXT,
  ADD COLUMN IF NOT EXISTS visa_arrived_date TEXT,
  ADD COLUMN IF NOT EXISTS airline TEXT,
  ADD COLUMN IF NOT EXISTS departure_date TEXT,
  ADD COLUMN IF NOT EXISTS ticket_price TEXT,
  ADD COLUMN IF NOT EXISTS transit TEXT,
  ADD COLUMN IF NOT EXISTS commission_paid TEXT,
  ADD COLUMN IF NOT EXISTS commission_amount TEXT;

-- 4. Enable Supabase Realtime publication for instant cross-device updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'applicant_contracts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.applicant_contracts;
  END IF;
END $$;
