# ARK HRMS · ARK Shipping Line

A **modular Vue 3 HRMS** (Human Resource Management System) for ARK Shipping Line — built as a zero-build static web app deployable directly on **GitHub Pages**.

---

## 🔹 Features

- **Role-Based Portals** — Admin & Employee dashboards with granular access
- **Live Attendance** — Shift punch-in/out, breaks, real-time NJ timezone clock
- **Leave Workflow** — Employee → Manager → Admin multi-level approval pipeline
- **Chart.js Analytics** — Presence, punctuality, department headcount, leave types
- **Supabase Backend** — PostgreSQL with Row Level Security (anon access for GitHub Pages)
- **Offline Fallback** — Full functionality with localStorage if credentials not set
- **Dark Mode** — Glassmorphism glassmorphism UI, Plus Jakarta Sans typography

---

## 🚀 Getting Started — Supabase Setup

### Step 1 — Create a Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project** → give it a name (e.g. `ark-hrms`)
3. Choose a free region, set a database password, click **Create Project**
4. Wait ~2 minutes for the project to provision

---

### Step 2 — Run the SQL Schema

1. In the left sidebar, click **SQL Editor**
2. Click **New Query**
3. Open [`backend/supabase_schema.sql`](./backend/supabase_schema.sql) from this repo
4. **Copy** the entire file contents and **paste** into the SQL editor
5. Click **Run** (▶)

You should see at the bottom:
```
status: Supabase ARK HRMS Database initialized successfully!
total_employees: 13
total_departments: 5
```

---

### Step 3 — Copy Your API Credentials

1. In Supabase dashboard → go to **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** — looks like `https://xyzcompany.supabase.co`
   - **anon public** key — starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### Step 4 — Paste Credentials into ARK HRMS

1. Open the app and **log in as Admin** (ID: `1` / Password: `admin123`)
2. Click **Settings** in the top navigation bar
3. Under **Supabase Database Connection**:
   - Paste the **Project URL** in the first field
   - Paste the **Anon Key** in the second field
4. Click **Save & Connect**
5. Wait for the connection test — you'll see a ✅ toast and the badge turns **Connected**
6. Data syncs automatically from Supabase!

---

## 📁 Project Structure

```
ark_hrms/
├── index.html              # Vue 3 SPA shell & all templates
├── assets/
│   ├── css/style.css       # Glassmorphism tokens, loaders, animations
│   ├── js/
│   │   ├── config.js       # CONFIG constants, seed employees, avatar list
│   │   ├── api.js          # SupabaseService — all DB operations
│   │   ├── charts.js       # ChartManager — Chart.js lifecycle & themes
│   │   └── app.js          # Vue 3 reactive controller (setup())
│   └── img/ark-logo.svg    # Vector logo asset
├── backend/
│   ├── supabase_schema.sql # ⭐ Run this in Supabase SQL Editor
│   └── Code.gs             # Legacy Google Apps Script (archived)
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Pages automatic deployment
```

---

## 🔑 Default Login Credentials

| Role          | Employee ID | Password   |
|---------------|-------------|------------|
| Administrator | `1`         | `admin123` |
| Dara Janwary  | `101`       | `123456`   |
| Samra Farid   | `102`       | `123456`   |
| Maryam Siddiqui| `107`      | `123456`   |
| Iffrah Syed   | `110`       | `123456`   |

---

## 🌍 Deploying on GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set Source to **GitHub Actions**
4. The `.github/workflows/deploy.yml` will automatically deploy on every push to `main`
5. Your app will be live at `https://<username>.github.io/<repo-name>/`

---

## 🗃️ Database Tables

| Table        | Description                                    |
|--------------|------------------------------------------------|
| `employees`  | Staff roster, roles, hierarchy, leave quotas   |
| `departments`| Department metadata, heads, budgets            |
| `attendance` | Punch-in/out records, punctuality, shift hours |
| `leaves`     | Leave requests with multi-level approval trail |
| `audit_logs` | Admin action audit trail                       |
| `notifications` | In-app notification messages               |

---

## ⚡ Tech Stack

- **Vue 3** (CDN, no build step) — `unpkg.com/vue@3`
- **Supabase JS v2** (CDN) — `cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- **Chart.js 4** (CDN) — `cdn.jsdelivr.net/npm/chart.js@4`
- **Tailwind CSS** (CDN) — utility classes for layout
- **Font Awesome 6** (CDN) — icons
- **Plus Jakarta Sans** (Google Fonts) — typography

---

## 🔒 Security Note

The Supabase **anon key** is designed to be public — it is safe to expose in a client-side app. Data access is controlled by **Row Level Security (RLS)** policies defined in the SQL schema. For production, consider adding auth-based policies to restrict data per-user.
