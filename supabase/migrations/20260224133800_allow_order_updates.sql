-- Add UPDATE policy for blast_orders so staff can mark orders as delivered
-- Note: User must be authenticated
CREATE POLICY "Auth can update orders"
    ON public.blast_orders FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
