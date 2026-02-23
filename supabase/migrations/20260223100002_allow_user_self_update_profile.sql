-- Allow users to update their own display_name and last_login_at
DO $$
BEGIN
  -- Drop if exists to avoid conflicts
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile' AND tablename = 'blast_users') THEN
    DROP POLICY "Users can update their own profile" ON public.blast_users;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read their own profile' AND tablename = 'blast_users') THEN
    DROP POLICY "Users can read their own profile" ON public.blast_users;
  END IF;
END $$;

CREATE POLICY "Users can update their own profile"
  ON public.blast_users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can read their own profile"
  ON public.blast_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
