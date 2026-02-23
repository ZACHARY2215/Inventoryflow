# 🚀 InventoryFlow

> A comprehensive, real-time inventory management and point-of-sale system built for modern businesses — from small retailers to multi-booth distributors.

![InventoryFlow](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)

---

## 📦 Features

### 🛒 Point of Sale (POS)

- Real-time product search with category filtering
- Add products by **piece** or **case** — stock is deducted correctly either way
- Sticky cart sidebar on desktop for seamless order building
- Multiple **payment methods**: Cash, GCash, Bank Transfer, Check, Credit, Installment
- **Reference number** field auto-appears for non-cash payments
- **Installment / Loan mode** — links orders to registered customers, automatically increments their outstanding balance
- Admin-only view: shows **cost per piece**, **profit margin**, and **estimated gross profit** per sale
- Print receipt and generate PDF invoice per order

### 📊 Inventory Management

- Real-time stock tracking by **cases and pieces**
- Low-stock alerts with configurable thresholds per product
- Full inventory adjustment log with reason codes
- SKU-based product catalog with image support
- **Wholesale price** and **supplier** tracking per product (admin-only margin visibility)

### 👥 Customer Management

- Customer database with type classification (Walk-in, Reseller, Mall Booth, Other)
- **Outstanding balance tracking** for installment customers
- **Inline Pay button** — records amount, payment mode, and reference number instantly
- Full **Payment History** per customer with balance before/after trail
- Full **Order History** per customer linking to order detail pages
- CSV export of customers and payment records

### 📋 Orders

- Full order lifecycle: Draft → Confirmed → Delivered / Cancelled
- Order confirmation triggers stock deduction via Edge Function
- PDF invoice generation with Supabase Storage upload
- Searchable, filterable, paginated order list with detail view

### 👤 User Management & Authentication

- **Email + Password** and **Google OAuth** sign-in
- Self-service employee **registration request** — new staff submit their details
- **Admin approval queue** — admins approve or reject requests from User Management
- On approval: email users receive an invitation email; Google users can sign in immediately
- Role-based access: **Admin** and **Staff** with enforced RLS policies
- Display name, password change, and session settings
- Auto-logout on idle (30 min) and max session (8 hours)

### 📈 Analytics & Reporting

- Dashboard KPIs: revenue, orders, inventory value, low-stock count
- Audit log of all system actions
- CSV export and print on every data table

### 🏭 Suppliers & Returns

- Supplier database linked to the product catalog
- Wholesale cost per product for COGS tracking
- Returns management workflow

---

## 🛠 Tech Stack

| Layer              | Technology                                      |
| ------------------ | ----------------------------------------------- |
| **Frontend**       | React 19, TypeScript, Vite 6                    |
| **Styling**        | Tailwind CSS v4, custom design tokens           |
| **Backend**        | Supabase (PostgreSQL 15, Row Level Security)    |
| **Auth**           | Supabase Auth — Email/Password + Google OAuth   |
| **Edge Functions** | Deno-based Supabase Edge Functions              |
| **Storage**        | Supabase Storage (invoice PDFs, product images) |
| **Deployment**     | Vercel (frontend) + Supabase (backend)          |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone the repository

```bash
git clone https://github.com/ZACHARY2215/Inventoryflow.git
cd Inventoryflow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ Never commit your `.env` file — it is listed in `.gitignore`.

### 4. Run the dev server

```bash
npm run dev
```

---

## ☁️ Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import from GitHub
3. Framework preset: **Vite**
4. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**

After deployment, add your Vercel production URL to **Supabase → Authentication → URL Configuration → Redirect URLs**.

---

## 🔐 Google OAuth Setup

1. Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com):
   - Authorized redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`
2. Enable Google provider in **Supabase → Authentication → Providers**
3. Paste your **Client ID** and **Client Secret** → Save
4. Add your site URL (localhost + production) in **Supabase → Authentication → URL Configuration**

---

## 📁 Project Structure

```
src/
├── components/     # Reusable UI components (Pagination, PrintButton…)
├── context/        # React Context (AuthContext, ThemeContext)
├── hooks/          # Custom hooks (usePageTitle, useDebounce)
├── lib/            # Supabase client, utility functions
├── pages/          # Page components (POS, Orders, Products, Customers…)
supabase/
├── functions/      # Edge Functions (Deno TypeScript)
├── migrations/     # SQL migration files
```

---

## 📄 License

Private — all rights reserved. For internal business use only.

---

_Built for BLAST Enterprises_
