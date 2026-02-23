# Layer 1: Database Schema Architecture (SOP)

## Purpose

Establishes the foundational data models and strict Row-Level Security (RLS) rules that govern data access for the internal inventory system. Built on Supabase PostgreSQL.

## Core Entities

- **users:** Maps 1:1 with `auth.users`. Defines the `role` enum (`admin`, `staff`).
- **products:** Canonical inventory tracker. All quantities measured strictly in _pieces_.
- **orders:** Holds draft/confirmed/delivered/cancelled orders.
- **order_items:** Takes snapshots of `pieces_per_case` and `unit_price_piece` to freeze prices. Calculates computed totals automatically.
- **invoices:** Read-only references to PDFs safely stored in a private bucket.
- **returns & return_items:** Formal flows for stock returns, differentiating `resellable`, `damaged`, and `expired`.
- **audit_logs:** The immutable append-only ledger for ALL critical actions via automated SQL triggers.

## RLS & Security Rules

- **Authentication:** All tables require a valid JWT (`authenticated` role) to even `SELECT`.
- **Reads:** Employees have global read access to products, orders, returns, and invoices to fulfill workloads.
- **Writes:**
  - Staff may ONLY `INSERT`, `UPDATE`, or `DELETE` Orders and OrderItems where `status = 'draft'` AND their `user_id` matches the actor's `auth.uid()`.
  - Operations to **CONFIRM** orders, manipulate inventory (`inventory_pieces`), or change prices are handled strictly through **Layer 3 Edge Functions** (running as `service_role`).

## Database Modifiers

All Tables contain standard `created_at` and `updated_at` (managed via triggers).
All DML changes (`INSERT`, `UPDATE`, `DELETE`) hit `generic_audit_trigger` automatically.
