# Layer 1: Edge Functions Architecture (SOP)

## Purpose

Supabase Edge Functions represent our deterministic execution layer for all privileged business logic, replacing direct SQL modification from the frontend app. They execute using the `service_role` key bypassing standard RLS, but strictly validating user inputs.

## The "Confirm Order" Transaction (Critical)

The most sensitive operation in the system is locking in a draft order and decrementing stock.

### Step-by-step SOP

1. **Trigger:** Frontend calls `inv_confirm_order` Edge Function with the `order_id`.
2. **Authentication:** The Edge function validates the caller's JWT implicitly via the `Authorization` header.
3. **Validation:** Checks if order exists and is in `draft` status.
4. **Transaction (PostgreSQL RPC):**
   - Execute a `BEGIN` SQL block (or call a Postgres RPC function).
   - `SELECT ... FROM public.products WHERE id = ... FOR UPDATE` (This strictly locks the row!).
   - Verify `inventory_pieces >= requested_pieces`. (Fails if oversell detected).
   - Decrement `inventory_pieces` and increment `reserved_pieces` OR finalize the deduction based on business logic.
   - Update `order.status = 'confirmed'`.
   - `COMMIT`.
5. **Return:** Returns Success + Final Price Payload to UI.

## Supporting Functions

- **Expiring Drafts Cron:** Scheduled function. Searches for `status='draft'` older than 24h. Nullifies reservations and deletes drafts.
- **Low Stock Alerter:** Scheduled function. Broadcasts alerts via Supabase Realtime when `inventory_pieces` dips below a threshold.

## Invariants

- Edge Functions MUST NOT trust client-provided totals. Price and total are recalculated server-side or sourced from unmodified snapshots.
- `service_role` keys are strictly held in Vercel (for SSR) and Supabase Edge Secrets. Never exposed to Vite.
