-- Ensure blast_customers has is_active column (may not exist yet)
ALTER TABLE public.blast_customers
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
