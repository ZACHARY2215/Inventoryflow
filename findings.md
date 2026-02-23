# Findings

## Research

- **Supabase Edge Functions & Transaction Locking:** To prevent overselling inventory, there are two primary approaches:
  1. **RPC Stored Procedures (Recommended for complex logic):** Write PostgreSQL PL/pgSQL functions that handle stock checking, decrements, and order creation in a single transaction. This respects RLS, locks rows properly via `SELECT FOR UPDATE`, and handles full atomic isolation.
  2. **Direct SQL Transactions in Edge Functions:** Establish a Postgres connection inside the edge logic and use explicit SQL starting with `BEGIN`, then `SELECT FOR UPDATE`. Keep transactions very short (<100ms) to avoid server-side lock contention. All inventory checks must run server-side.

## Discoveries (Phase 1)

- **North Star:** Secure, auditable internal web system for orders, inventory, invoices. Prevents forgery, uses RBAC + immutable audit trails.
- **Source of Truth:** Supabase Postgres. Forms the single authoritative ledger, replacing paper.
- **Delivery Payload:** Vercel frontend, Supabase Backend, PDF invoices in private buckets.
- **Integrations:** Supabase (Auth, Postgres, Storage, Realtime, Edge Functions), Vercel. Optional: Resend, GitHub.
- **Design System:** InventoryFlow Brand Guidelines established. Primary color is Teal (`#059669`), fonts are Inter and JetBrains Mono. Organized around an 8px layout grid and 12-column desktop structure. UI ensures high accessibility and professional clarity.

## Constraints

- **Security:** Strict separation between client-side auth (`anon` key + RLS) and privileged logic (`service_role` in Edge Functions).
- **Data Integrity:** No negative inventory, no editing confirmed orders, no deletion of financial records.
- **Data Canon:** Inventory MUST be handled exclusively in _pieces_. Cases are parsed as `pieces = cases * pieces_per_case_snapshot`.
- **Pricing:** Price changes must be logged and orders use a strict snapshot to remain historically accurate.
