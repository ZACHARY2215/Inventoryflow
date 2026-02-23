# Task Plan

## Goals

- Build a secure, auditable, internal web system for order entry, inventory management, and invoicing.

## Phases & Checklists

### Phase 1: Blueprint

- [x] Answer Discovery Questions
- [x] Define JSON Data Schema in `gemini.md`
- [x] Research helpful resources (e.g., Supabase Edge Function examples, Next.js/Vite best practices)
- [x] Approve Blueprint

### Phase 2: Link

- [x] Verify API connections and `.env` credentials (Vercel + Supabase) **-> Success**
- [x] Build minimal handshake scripts in `tools/` (Created `verify_supabase.js` and verified)

### Phase 3: Architect

- [x] Write SOPs in Layer 1 (`architecture/`) for RBAC, Transactions, and Auditing.
- [x] Develop Supabase Database Schema + RLS + Triggers (Deployed strictly to `blast` schema).
- [x] Define navigation/routing logic for Vercel Frontend (App Layer 2).
- [x] Implement Edge Function: `inv_confirm_order` (calls `blast_confirm_order_transaction` RPC)
- [x] Implement Edge Function: `inv_clear_drafts` (CRON purge of 24h+ expired drafts)
- [x] Implement Edge Function: `inv_admin_restock` (calls `blast_admin_restock_transaction` RPC)
- [x] Implement Edge Function: `inv_generate_invoice` (PDF via pdf-lib, uploads to Storage, signed URL)
- [x] Implement Edge Function: `inv_deliver_order` (calls `blast_deliver_order_transaction` RPC)
- [x] Implement Edge Function: `inv_cancel_order` (calls `blast_cancel_order_transaction` RPC, restores stock)
- [x] Implement Edge Function: `inv_process_return` (admin approve/reject, restores resellable stock)
- [x] Fix Edge Function auth: redeployed all with `verify_jwt: false` + removed manual Authorization headers from frontend
- [x] Create Postgres RPC: `blast_deliver_order_transaction`
- [x] Create Postgres RPC: `blast_cancel_order_transaction`
- [x] Create Postgres RPC: `blast_process_return_transaction`
- [x] Create DB tables: `blast_customers` (with RLS + indexes)
- [x] Create DB tables: `blast_suppliers` (with RLS + indexes)

### Phase 4: Stylize — Frontend Pages

- [x] Foundation: Tailwind v4, path aliases, `cn()` utility, Supabase client, React Query, Sonner
- [x] App Shell: Collapsible sidebar, top bar, breadcrumbs, mobile hamburger, user profile
- [x] Auth: `AuthContext` (profile, role, isAdmin), `ProtectedRoute`, `AdminRoute`
- [x] Routing: All 15+ routes in `App.tsx` with `AppShell` wrapping
- [x] Login page (split layout, branding + form)
- [x] Dashboard (KPI cards, sales bar chart, top products pie chart, recent orders, quick actions)
- [x] Products (CRUD, search, sort, stock status, modal form, admin-only actions)
- [x] Inventory (stats, filter tabs, case+piece display, admin restock)
- [x] Orders list (search, status filter tabs with counts, sortable table)
- [x] Order Detail (status timeline, confirm/deliver/cancel/invoice actions via Edge Functions)
- [x] POS (product grid, case/piece buttons, sticky cart, confirm/draft flow)
- [x] Customers (CRUD, type filtering, credit limits, search, modal form)
- [x] Suppliers (card grid, CRUD modal, contact/warehouse details)
- [x] Payments (revenue stats, order payment table, search)
- [x] Invoices (list, search, PDF download links)
- [x] Returns (status filters, admin approve/reject via Edge Function)
- [x] Analytics (KPI cards, monthly revenue chart, status pie, top products bar)
- [x] Audit Logs (entity/action filters, expandable before/after JSON diff)
- [x] User Management (user table, role badges, toggle role)
- [x] Notifications (read/unread filter, priority styling, mark-all-read)
- [x] Settings (account info, role, system version)
- [x] Custom dialog UIs (restock modal, invoice dialog, confirm/deliver/cancel dialogs)
- [x] POS enhancements: editable qty input, customer name, payment method, discount (percent/fixed)
- [x] DB migration: added `customer_name`, `payment_method`, `discount_type`, `discount_value` to `blast_orders`
- [ ] User review and feedback

### Phase 5: Trigger

- [ ] Cloud transfer & Setup execution triggers (Cron jobs / Webhooks for expired drafts, low stock notifications)
- [ ] Finalize Maintenance Log in `gemini.md`.
