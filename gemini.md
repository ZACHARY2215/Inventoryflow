# Project Constitution

## Data Schemas

### Input / Output Shape (Payload)

```json
{
  "Users": {
    "id": "uuid",
    "email": "string",
    "role": "enum(admin, staff)",
    "created_at": "timestamp"
  },
  "Products": {
    "id": "uuid",
    "sku": "string",
    "name": "string",
    "description": "string",
    "unit_price_piece": "decimal",
    "pieces_per_case": "integer",
    "inventory_pieces": "integer",
    "reserved_pieces": "integer",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "Orders": {
    "id": "uuid",
    "order_number": "string (ORD-YYYY-NNNNN)",
    "user_id": "uuid",
    "status": "enum(draft, confirmed, delivered, cancelled)",
    "total_amount": "decimal",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "delivery_notes": "string",
    "delivered_at": "timestamp"
  },
  "OrderItems": {
    "id": "uuid",
    "order_id": "uuid",
    "product_id": "uuid",
    "cases_ordered": "integer",
    "pieces_per_case_snapshot": "integer",
    "computed_pieces": "integer",
    "unit_price_piece_snapshot": "decimal",
    "total_price": "decimal"
  },
  "Invoices": {
    "id": "uuid",
    "invoice_number": "string (INV-YYYY-NNNNN)",
    "order_id": "uuid",
    "pdf_url": "string (Supabase Storage URL)",
    "created_at": "timestamp"
  },
  "Returns": {
    "id": "uuid",
    "return_number": "string (RET-YYYY-NNNNN)",
    "order_id": "uuid",
    "user_id": "uuid",
    "status": "enum(pending, approved, rejected)",
    "reason": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "ReturnItems": {
    "id": "uuid",
    "return_id": "uuid",
    "order_item_id": "uuid",
    "pieces_returned": "integer",
    "condition": "enum(resellable, damaged, expired)"
  },
  "AuditLogs": {
    "id": "uuid",
    "user_id": "uuid",
    "action": "string",
    "entity_type": "string",
    "entity_id": "uuid",
    "old_data": "jsonb",
    "new_data": "jsonb",
    "created_at": "timestamp",
    "ip_address": "string"
  }
}
```

## Behavioral Rules

### 1. Authentication & Sessions

- Enforce RBAC at UI route guarding (UX) and Supabase RLS (real security).
- Session timeout: 8 hours (Auto logout on inactivity).
- Rate-limit login attempts.

### 2. Inventory & Ordering Rules

- **Non-negotiable:** Canonical inventory is pieces only.
- Case ordering rule: `order_line.computed_pieces = cases * pieces_per_case_snapshot`
- Draft orders reserve stock and auto-expire after 24h, releasing reservations.
- Confirmed orders must be transactional (re-check availability, deduct stock, write audit logs).
- Prevent oversell via SQL transaction + locking strategy inside Edge Function.
- Delivered orders record timestamp + delivery notes + actor.
- Cancellations allowed only before confirmation, release reserved stock, require a reason.

### 3. Returns Rules

- Employees request returns; Admin must approve/reject.
- Add back inventory for "resellable" only (drop damaged/expired).
- Returns must reference an original order and not exceed ordered quantity.

### 4. Pricing & Invoice Rules

- Price changes require reason, audit log, and optional effective date.
- Orders/invoices must use snapshotted pricing.
- One invoice per order. PDF stored privately via Supabase Storage, accessed via signed URL.

### 5. Audit / Non-repudiation Rules

- Audit log is append-only. No “edit audit entries.”
- Log critical actions: state changes, inventory adjustments, returns, price updates, user changes, invoicing.
- Record actor user id + timestamps, IP/user-agent.

### 6. Formatting Requirements

- IDs: `ORD-YYYY-NNNNN`, `INV-YYYY-NNNNN`, `RET-YYYY-NNNNN`.
- Currency: PHP (₱) with correct decimal handling.

### 7. Strict "Do Not" Rules

- **DO NOT** rely on frontend-only checks for security.
- **DO NOT** expose `service_role` key client-side.
- **DO NOT** allow negative inventory.
- **DO NOT** allow editing confirmed orders (workflows only).
- **DO NOT** allow deleting financial records (use soft-delete + audit, or restrict to admin + log).

### 8. Visual & UI Rules (Stylization)

- **Colors:** Primary Teal gradient (`#059669`). Success Green (`#16A34A`), Warning Amber (`#D97706`), Error Red (`#DC2626`). Neutral Grays (`#111827` to `#F9FAFB`).
- **Typography:** Primary font is Inter (Weights: 400, 500, 600, 700). Monospace font is JetBrains Mono.
- **Spacing & Layout:** Base unit is 8px. Desktop grid is 12 columns.
- **Design Principles:** Professional yet approachable. Clarity first. Minimize clicks. Fast, subtle animations (150-300ms).
- **Components:** Cards use white background with 1px gray border and subtle shadow. Buttons should have 6px radius.
- **Accessibility:** WCAG 2.1 AA Compliance. Ensure 4.5:1 contrast, logical tab orders, and proper focus states.

## Architectural Invariants

1. **Data-First Rule**: Code only begins once "Payload" (Schema) is confirmed.
2. **Deterministic Logic**: Front-ends call Edge Functions for complex or privileged logic using `service_role`.
3. **Layer Separation**:
   - `architecture/` (Layer 1): SOPs and tech doc.
   - Navigation (Layer 2): Routing.
   - `tools/` (Layer 3): Scripts/Edge Functions.

## Maintenance Log

- Initial Schema and Rules formulated during Discovery (Phase 1).
