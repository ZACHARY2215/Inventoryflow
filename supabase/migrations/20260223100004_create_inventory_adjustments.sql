-- Inventory Adjustments table
-- Tracks all stock changes with before/after quantities, reason, and user
CREATE TABLE IF NOT EXISTS public.blast_inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.blast_products(id),
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('damaged', 'expired', 'theft', 'return', 'correction', 'restock', 'sale', 'transfer', 'other')),
  quantity_change INTEGER NOT NULL, -- positive = add, negative = remove
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  batch_reference TEXT, -- optional batch/lot reference
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT, -- denormalized for easy display
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blast_inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Admin/staff can read all adjustments
CREATE POLICY "Authenticated users can read adjustments"
  ON public.blast_inventory_adjustments
  FOR SELECT TO authenticated USING (true);

-- Only admins can insert adjustments
CREATE POLICY "Admins can insert adjustments"
  ON public.blast_inventory_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.blast_users WHERE id = auth.uid() AND role = 'admin'));

-- Index for fast lookups
CREATE INDEX idx_adjustments_product ON public.blast_inventory_adjustments(product_id);
CREATE INDEX idx_adjustments_type ON public.blast_inventory_adjustments(adjustment_type);
CREATE INDEX idx_adjustments_created ON public.blast_inventory_adjustments(created_at DESC);
