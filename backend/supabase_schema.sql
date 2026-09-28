-- =====================================================================
-- ARK HRMS · Supabase PostgreSQL Database Schema & Initial Seed
-- ARK Shipping Line
-- =====================================================================
-- 
-- HOW TO USE THIS SCRIPT:
-- 1. Log in to your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Open your project (or create a new free project)
-- 3. In the left navigation, click "SQL Editor"
-- 4. Click "New query", paste this entire script, and click "Run"
-- 5. Go to "Project Settings" -> "API" and copy:
--    - Project URL (e.g. https://xyzcompany.supabase.co)
--    - anon public API key (eyJhbGciOi...)
-- 6. Open ARK HRMS, log in as Admin (ID: 1 / Pass: admin123), go to
--    Settings -> paste URL and Anon Key, and click "Save & Connect"!
-- =====================================================================

-- 1. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT '123456',
    dept TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    manager_id TEXT,
    avatar TEXT DEFAULT '👨‍💼',
    joined TEXT DEFAULT '01 Jan 2024',
    annual_leave_quota INTEGER DEFAULT 18,
    used_leave_days INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    head_id TEXT,
    head_name TEXT,
    budget TEXT DEFAULT '$0',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ATTENDANCE & TIMESHEETS TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    emp_id TEXT NOT NULL,
    emp_name TEXT NOT NULL,
    action TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    total_hours TEXT DEFAULT '',
    punctuality TEXT DEFAULT 'On Time',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. LEAVES TABLE
CREATE TABLE IF NOT EXISTS public.leaves (
    id TEXT PRIMARY KEY,
    emp_id TEXT NOT NULL,
    emp_name TEXT NOT NULL,
    type TEXT NOT NULL,
    from_date TEXT NOT NULL,
    to_date TEXT NOT NULL,
    days INTEGER DEFAULT 1,
    reason TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending',
    manager_id TEXT,
    manager_name TEXT,
    manager_decision TEXT,
    manager_at TEXT,
    manager_note TEXT,
    admin_id TEXT,
    admin_name TEXT,
    admin_decision TEXT,
    admin_at TEXT,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_name TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    time TEXT NOT NULL,
    target_emp_id TEXT,
    icon TEXT DEFAULT 'fa-bell',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
-- Enable RLS on all tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Public access for employees" ON public.employees;
DROP POLICY IF EXISTS "Public access for departments" ON public.departments;
DROP POLICY IF EXISTS "Public access for attendance" ON public.attendance;
DROP POLICY IF EXISTS "Public access for leaves" ON public.leaves;
DROP POLICY IF EXISTS "Public access for audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Public access for notifications" ON public.notifications;

-- Create full read/write access policies for anon & authenticated roles
-- (Allows the GitHub Pages static front-end to query and update via Supabase Anon Key)
CREATE POLICY "Public access for employees" ON public.employees
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public access for departments" ON public.departments
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public access for attendance" ON public.attendance
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public access for leaves" ON public.leaves
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public access for audit_logs" ON public.audit_logs
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public access for notifications" ON public.notifications
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Enable Realtime (optional, can be subscribed from client)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'attendance'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance, public.leaves, public.employees;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- =====================================================================
-- SEED INITIAL DATA
-- =====================================================================

-- 1. Insert Administrator & Staff Roster
INSERT INTO public.employees (id, name, email, password, dept, role, status, manager_id, avatar, joined, annual_leave_quota, used_leave_days)
VALUES
    ('1', 'Administrator', 'admin@ark.com', 'admin123', 'HR', 'Super Administrator', 'Active', NULL, '👨‍💼', '01 Jan 2024', 25, 0),
    ('101', 'Dara Janwary', 'dara.janwary@ark.com', '123456', 'Accounts', 'Accounts Manager', 'Active', '1', '👨‍💼', '15 Jan 2024', 18, 2),
    ('102', 'Samra Farid', 'samra.farid@ark.com', '123456', 'Accounts', 'Accounts Executive', 'Active', '101', '👩‍💼', '20 Feb 2024', 18, 1),
    ('103', 'Zeeshan Rashid', 'zeeshan.rashid@ark.com', '123456', 'Accounts', 'Accounts Officer', 'Active', '101', '👨‍💻', '10 Mar 2024', 18, 0),
    ('104', 'Faraz Ud Din', 'faraz.uddin@ark.com', '123456', 'Documentation', 'Documentation Manager', 'Active', '1', '👨‍💼', '05 Jan 2024', 18, 3),
    ('105', 'Rehab Zehra', 'rehab.zehra@ark.com', '123456', 'Documentation', 'Documentation Officer', 'Active', '104', '👩‍💼', '18 Feb 2024', 18, 0),
    ('106', 'Ali Hussain', 'ali.hussain@ark.com', '123456', 'Documentation', 'Documentation Executive', 'Active', '104', '👨‍💻', '22 Mar 2024', 18, 0),
    ('107', 'Maryam Siddiqui', 'maryam.siddiqui@ark.com', '123456', 'Dispatch', 'Dispatch Manager', 'Active', '1', '👩‍💼', '12 Jan 2024', 18, 4),
    ('108', 'Shaema Hafeez', 'shaema.hafeez@ark.com', '123456', 'Dispatch', 'Dispatch Officer', 'Active', '107', '👩‍💻', '08 Feb 2024', 18, 1),
    ('109', 'Hamid', 'hamid@ark.com', '123456', 'Dispatch', 'Dispatch Executive', 'Active', '107', '👨‍💼', '15 Mar 2024', 18, 0),
    ('110', 'Iffrah Syed', 'iffrah.syed@ark.com', '123456', 'Operations', 'Operations Manager', 'Active', '1', '👩‍💼', '01 Feb 2024', 18, 1),
    ('111', 'Muhammad Hamiz', 'muhammad.hamiz@ark.com', '123456', 'Operations', 'Operations Executive', 'Active', '110', '👨‍💻', '20 Mar 2024', 18, 0),
    ('112', 'Ayesha Fatima', 'ayesha.fatima@ark.com', '123456', 'HR', 'HR Manager', 'Active', '1', '👩‍💼', '10 Jan 2024', 18, 0)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    dept = EXCLUDED.dept,
    role = EXCLUDED.role,
    manager_id = EXCLUDED.manager_id;

-- 2. Insert Departments
INSERT INTO public.departments (name, head_id, head_name, budget)
VALUES
    ('Accounts', '101', 'Dara Janwary', '$85,000'),
    ('Documentation', '104', 'Faraz Ud Din', '$60,000'),
    ('Dispatch', '107', 'Maryam Siddiqui', '$95,000'),
    ('Operations', '110', 'Iffrah Syed', '$120,000'),
    ('HR', '1', 'Administrator', '$45,000')
ON CONFLICT (name) DO NOTHING;

-- 3. Insert Initial Sample Attendance Records
INSERT INTO public.attendance (id, emp_id, emp_name, action, date, time, total_hours, punctuality, notes)
VALUES
    ('TS-SEED-1', '101', 'Dara Janwary', 'Check-in', CURRENT_DATE::text, '08:25 AM', '', 'On Time', 'Morning punch'),
    ('TS-SEED-2', '104', 'Faraz Ud Din', 'Check-in', CURRENT_DATE::text, '08:15 AM', '', 'Early Arrival', 'Morning punch'),
    ('TS-SEED-3', '107', 'Maryam Siddiqui', 'Check-in', CURRENT_DATE::text, '08:42 AM', '', 'Late Arrival', 'Traffic delay'),
    ('TS-SEED-4', '110', 'Iffrah Syed', 'Check-in', CURRENT_DATE::text, '08:28 AM', '', 'On Time', 'Morning punch')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Initial Sample Leave Requests
INSERT INTO public.leaves (id, emp_id, emp_name, type, from_date, to_date, days, reason, status, manager_id, manager_name, manager_decision, manager_at, manager_note, admin_id, admin_name, admin_decision, admin_at, admin_note)
VALUES
    ('LV-SEED-1', '102', 'Samra Farid', 'Annual Leave', CURRENT_DATE::text, (CURRENT_DATE + INTERVAL '2 days')::date::text, 2, 'Family trip planned', 'ManagerApproved', '101', 'Dara Janwary', 'Approved', CURRENT_DATE::text, 'Work delegated to Zeeshan', NULL, NULL, NULL, NULL, NULL),
    ('LV-SEED-2', '105', 'Rehab Zehra', 'Sick Leave', CURRENT_DATE::text, (CURRENT_DATE + INTERVAL '1 day')::date::text, 1, 'Medical consultation and flu recovery', 'Pending', '104', 'Faraz Ud Din', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('LV-SEED-3', '108', 'Shaema Hafeez', 'Casual Leave', CURRENT_DATE::text, (CURRENT_DATE + INTERVAL '1 day')::date::text, 1, 'Personal domestic matter', 'Approved', '107', 'Maryam Siddiqui', 'Approved', CURRENT_DATE::text, 'Approved', '1', 'Administrator', 'Approved', CURRENT_DATE::text, 'Granted by Admin')
ON CONFLICT (id) DO NOTHING;

-- Verification query
SELECT 'Supabase ARK HRMS Database initialized successfully!' AS status,
       (SELECT COUNT(*) FROM public.employees) AS total_employees,
       (SELECT COUNT(*) FROM public.departments) AS total_departments;
