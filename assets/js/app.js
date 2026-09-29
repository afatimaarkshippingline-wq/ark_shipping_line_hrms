/**
 * ARK HRMS · Vue 3 Application Controller
 * ARK Shipping Line
 */

const { createApp, ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } = Vue;

const app = createApp({
    setup() {
        // Theme & Backend Settings
        const isDarkMode = ref(localStorage.getItem('ark_dark_mode') === 'true');

        // Supabase Credentials
        const supabaseUrl = ref(localStorage.getItem('ark_supabase_url') || CONFIG.DEFAULT_SUPABASE_URL);
        const supabaseKey = ref(localStorage.getItem('ark_supabase_key') || CONFIG.DEFAULT_SUPABASE_ANON_KEY);
        const supabaseConnected = ref(false); // true = tested OK, false = local mode

        // Clocks & Date
        const njClock = reactive({ time: '--:--:-- --', date: '--' });
        let clockTimer = null;

        // Current Session & Role
        const currentUser = ref(null);
        const currentRole = computed(() => currentUser.value ? currentUser.value.role : 'guest');
        const adminTab = ref('overview');
        const empTab = ref('overview');
        const showNotifDropdown = ref(false);

        // Helper to remove duplicate IDs and exact duplicate submissions
        function sanitizeLeavesList(list) {
            if (!Array.isArray(list)) return [];
            const seenIds = new Set();
            const seenLeaves = new Set();
            const result = [];
            for (const item of list) {
                if (!item || !item.id) continue;
                const idStr = String(item.id);
                if (seenIds.has(idStr)) continue;
                seenIds.add(idStr);

                // Deduplicate identical submissions for same employee: same empId, type, from, to
                const contentKey = `${String(item.empId)}|${item.type}|${item.from}|${item.to}`;
                if (seenLeaves.has(contentKey)) continue;
                seenLeaves.add(contentKey);

                result.push({ ...item, empId: String(item.empId) });
            }
            return result;
        }

        function safeParseJSON(key, fallback) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : fallback;
            } catch (e) {
                console.warn(`[SafeParse] Failed to parse key "${key}":`, e);
                return fallback;
            }
        }

        // Clear timesheets, leaves, and weekly checkins test cache unconditionally for fresh client handover
        localStorage.removeItem('ark_timesheets');
        localStorage.removeItem('ark_leaves');
        localStorage.removeItem('ark_emp_weekly_checkins');
        localStorage.removeItem('ark_performance_ratings');
        localStorage.removeItem('ark_audit_logs');
        localStorage.removeItem('ark_notifications');

        // Core Collections with Local Storage Cache (Fresh start default for client delivery)
        const employees = ref(safeParseJSON('ark_employees', null) || (typeof INITIAL_EMPLOYEES !== 'undefined' ? INITIAL_EMPLOYEES.map(e => ({ ...e, leaveQuotas: { annual: 14, sick: 7, casual: 5 } })) : []));
        const leaves = ref([]);
        const timesheets = ref([]);
        const departments = ref(safeParseJSON('ark_departments', null) || ['Accounts', 'Documentation', 'Dispatch', 'Operations', 'HR']);
        const notifications = ref(safeParseJSON('ark_notifications', []));

        // Employee Shift Session & Punch Log
        const employeeAttendanceState = ref('out');
        const shiftSession = reactive(safeParseJSON('ark_emp_shift', null) || {
            checkInTime: '', checkOutTime: '', breakMinutes: 0, workingMinutes: 0, workingSeconds: 0, breakSeconds: 0, isCompleted: false, punctuality: 'On Time'
        });
        const punchLog = reactive(safeParseJSON('ark_emp_punch_log', null) || {});
        const mockWeeklyCheckIns = ref(safeParseJSON('ark_emp_weekly_checkins', []));

        // Live shift ticker & submission lock
        const isSubmittingLeave = ref(false);
        const liveNow = ref(Date.now());
        const selectedRosterMonth = ref('2026-09');
        const selectedRosterEmpId = ref('my');
        const rosterViewMode = ref('monthly'); // 'daily' | 'weekly' | 'monthly'

        const availableMonths = [
            { value: '2026-09', label: 'September 2026' },
            { value: '2026-10', label: 'October 2026' },
            { value: '2026-08', label: 'August 2026' },
            { value: '2026-07', label: 'July 2026' },
            { value: '2026-06', label: 'June 2026' },
            { value: '2026-05', label: 'May 2026' },
            { value: '2026-04', label: 'April 2026' },
            { value: '2026-03', label: 'March 2026' },
            { value: '2026-02', label: 'February 2026' },
            { value: '2026-01', label: 'January 2026' }
        ];

        // UI Feedback
        const toast = reactive({ visible: false, message: '', type: 'success', title: 'Notice', icon: 'fa-solid fa-circle-check' });
        const loading = reactive({ visible: false, message: 'Processing...' });
        const skeletonLoading = reactive({ employees: false, timesheets: false, leaves: false });
        let toastTimeout = null;

        // Daily Inspirational Quote (Free Quotes API with resilient fallback)
        const dailyQuote = reactive({
            text: 'Excellence is not an act, but a habit. We are what we repeatedly do.',
            author: 'Aristotle',
            category: 'Excellence',
            loading: false
        });

        const FALLBACK_QUOTES = [
            { text: "Excellence is not an act, but a habit. We are what we repeatedly do.", author: "Aristotle", category: "Excellence" },
            { text: "Smooth seas do not make skillful sailors. Navigate every challenge with courage.", author: "Franklin D. Roosevelt", category: "Leadership" },
            { text: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "Motivation" },
            { text: "Teamwork begins by building trust. And the only way to do that is to overcome our need for invulnerability.", author: "Patrick Lencioni", category: "Teamwork" },
            { text: "To reach a port we must set sail – Sail, not tie at anchor; Sail, not drift.", author: "Oliver Wendell Holmes", category: "Maritime" },
            { text: "Quality is not an act, it is a habit. Precision in every shipment, honor in every commitment.", author: "ARK Shipping Creed", category: "Values" },
            { text: "The future depends on what you do today. Dedication turns small efforts into grand voyages.", author: "Mahatma Gandhi", category: "Inspiration" },
            { text: "Individually, we are one drop. Together, we are an ocean.", author: "Ryunosuke Satoro", category: "Collaboration" },
            { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier", category: "Consistency" },
            { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn", category: "Discipline" },
            { text: "It is not the ship so much as the skillful sailing that assures the prosperous voyage.", author: "George William Curtis", category: "Maritime" },
            { text: "Opportunities don't happen, you create them through hard work and integrity.", author: "Chris Grosser", category: "Opportunity" }
        ];

        async function fetchDailyQuote(forceFresh = false) {
            dailyQuote.loading = true;
            try {
                const res = await fetch('https://dummyjson.com/quotes/random?_=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.quote) {
                        dailyQuote.text = data.quote;
                        dailyQuote.author = data.author || 'Inspirational';
                        dailyQuote.category = 'Daily Wisdom';
                        dailyQuote.loading = false;
                        return;
                    }
                }
            } catch (e) {}
            const picked = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
            dailyQuote.text = picked.text;
            dailyQuote.author = picked.author;
            dailyQuote.category = picked.category;
            dailyQuote.loading = false;
        }

        // Scoped User Shift & Attendance State Management
        function resetShiftSession() {
            shiftSession.checkInTime = '';
            shiftSession.checkOutTime = '';
            shiftSession.breakMinutes = 0;
            shiftSession.workingMinutes = 0;
            shiftSession.workingSeconds = 0;
            shiftSession.breakSeconds = 0;
            shiftSession.isCompleted = false;
            shiftSession.punctuality = 'On Time';
            employeeAttendanceState.value = 'out';
            Object.keys(punchLog).forEach(k => delete punchLog[k]);
        }

        function initEmployeeWeeklyCheckins(empKey) {
            mockWeeklyCheckIns.value = [];
            localStorage.setItem('ark_emp_weekly_checkins_' + empKey, JSON.stringify([]));
        }

        function loadUserShiftState(empId) {
            if (!empId) {
                resetShiftSession();
                return;
            }
            const empKey = String(empId);
            const savedShift = localStorage.getItem('ark_emp_shift_' + empKey);
            const savedPunch = localStorage.getItem('ark_emp_punch_log_' + empKey);

            if (savedShift) {
                try {
                    Object.assign(shiftSession, JSON.parse(savedShift));
                } catch (e) { resetShiftSession(); }
            } else {
                resetShiftSession();
            }

            if (savedPunch) {
                try {
                    const parsed = JSON.parse(savedPunch);
                    Object.keys(punchLog).forEach(k => delete punchLog[k]);
                    Object.assign(punchLog, parsed);
                } catch (e) {
                    Object.keys(punchLog).forEach(k => delete punchLog[k]);
                }
            } else {
                Object.keys(punchLog).forEach(k => delete punchLog[k]);
            }

            // Sync attendance state from today's timesheet entries if any
            const todayNJ = getNJDateString();
            const todayLogs = timesheets.value.filter(t => String(t.empId) === empKey && (t.date === todayNJ || String(t.date).includes(todayNJ)));
            if (todayLogs.length > 0) {
                const latest = todayLogs[0];
                if (latest.action === 'Check In' || latest.action === 'Return Back') {
                    employeeAttendanceState.value = 'working';
                } else if (latest.action === 'Break') {
                    employeeAttendanceState.value = 'break';
                } else if (latest.action === 'Step Away') {
                    employeeAttendanceState.value = 'away';
                } else if (latest.action === 'Check Out') {
                    employeeAttendanceState.value = 'checkedOut';
                }
            } else if (!shiftSession.checkInTime) {
                employeeAttendanceState.value = 'out';
            }

            // Scoped weekly checkins (start fresh/empty)
            mockWeeklyCheckIns.value = [];
            localStorage.setItem('ark_emp_weekly_checkins_' + empKey, JSON.stringify([]));
        }

        // Modals State
        const modals = reactive({
            employee: false,
            applyLeave: false,
            department: false,
            avatar: false,
            editProfile: false,
            viewProfile: false,
            password: false,
            announcement: false,
            adminLeave: false,
            evalPopup: false
        });

        // Form Models
        const loginForm = reactive({ empId: '', password: '', showPassword: false });
        const empForm = reactive({
            id: '', name: '', email: '', dept: 'Accounts', role: '', status: 'Active', managerId: '', password: '', avatar: '👨‍💼',
            leaveQuotaAnnual: 14, leaveQuotaSick: 7, leaveQuotaCasual: 5
        });
        const leaveForm = reactive({ type: 'Annual Leave', from: '', to: '', reason: '' });
        const adminLeaveForm = reactive({ empId: '', type: 'Annual Leave', from: '', to: '', reason: '', status: 'Approved' });
        const deptForm = reactive({ name: '', headId: '', headName: '', budget: '' });
        const profileForm = reactive({ name: '', email: '', role: '' });
        const viewedEmployeeId = ref(null);

        // Filter Models
        const empFilter = reactive({ search: '', dept: 'All', status: 'All' });
        const leaveFilterStatus = ref('All');

        // State Persistence & Reactive Watchers
        function persistState() {
            try {
                localStorage.setItem('ark_employees', JSON.stringify(employees.value));
                localStorage.setItem('ark_leaves', JSON.stringify(sanitizeLeavesList(leaves.value)));
                localStorage.setItem('ark_timesheets', JSON.stringify(timesheets.value));
                localStorage.setItem('ark_departments', JSON.stringify(departments.value));
                localStorage.setItem('ark_notifications', JSON.stringify(notifications.value));
            } catch (e) {}
        }

        watch(employees, () => persistState(), { deep: true });
        watch(leaves, () => persistState(), { deep: true });
        watch(timesheets, () => persistState(), { deep: true });
        watch(departments, () => persistState(), { deep: true });
        watch(notifications, () => persistState(), { deep: true });

        function showToast(message, type = 'success', title = '') {
            if (toastTimeout) clearTimeout(toastTimeout);
            toast.message = message;
            toast.type = type;
            toast.title = title || (type === 'error' ? 'Attention' : type === 'info' ? 'Notification' : 'Notice');
            toast.icon = type === 'error' ? 'fa-solid fa-triangle-exclamation' : type === 'info' ? 'fa-solid fa-circle-info' : 'fa-solid fa-circle-check';
            toast.visible = true;
            toastTimeout = setTimeout(() => { toast.visible = false; }, 3800);
        }

        function showLoading(msg = 'Processing...') {
            loading.message = msg;
            loading.visible = true;
        }

        function hideLoading() {
            loading.visible = false;
        }

        // NJ Clocks & Timezone Utilities
        // ─── Time Helpers ────────────────────────────────────────────────────
        function pad2(n) { return String(Math.floor(n)).padStart(2, '0'); }

        function formatSecondsHms(totalSec) {
            const s = Math.max(0, Math.floor(totalSec));
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            return `${h}h ${pad2(m)}m ${pad2(sec)}s`;
        }

        function formatSecondsPretty(totalSec) {
            const s = Math.max(0, Math.floor(totalSec));
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            if (h > 0) return `${h}h ${pad2(m)}m`;
            return `${m}m ${pad2(s % 60)}s`;
        }

        function updateClocks() {
            const now = new Date();
            liveNow.value = Date.now();
            njClock.time = now.toLocaleTimeString('en-US', { timeZone: CONFIG.NJ_TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            njClock.date = now.toLocaleDateString('en-US', { timeZone: CONFIG.NJ_TIMEZONE, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        }

        function getNJDateString() {
            const d = new Date(new Date().toLocaleString("en-US", { timeZone: CONFIG.NJ_TIMEZONE }));
            const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }

        function getNJTimeString() {
            return new Date().toLocaleTimeString('en-US', { timeZone: CONFIG.NJ_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: true });
        }

        function computePunctuality() {
            const now = new Date(new Date().toLocaleString("en-US", { timeZone: CONFIG.NJ_TIMEZONE }));
            const h = now.getHours(), m = now.getMinutes();
            if (h < CONFIG.LATE_ARRIVAL_CUTOFF_HOUR) return 'Early Arrival';
            if (h === CONFIG.LATE_ARRIVAL_CUTOFF_HOUR && m <= CONFIG.LATE_ARRIVAL_CUTOFF_MINUTE) return 'On Time';
            return 'Late Arrival';
        }

        function toggleDarkMode() {
            isDarkMode.value = !isDarkMode.value;
            localStorage.setItem('ark_dark_mode', String(isDarkMode.value));
            document.documentElement.classList.toggle('dark', isDarkMode.value);
            document.documentElement.classList.toggle('light', !isDarkMode.value);
            nextTick(() => { renderAllCharts(); });
        }

        // Supabase Sync (replaces Google Sheets syncAll)
        async function syncFromSupabase(silent = false) {
            if (!SupabaseService.isConfigured()) return false;
            try {
                if (!silent) showLoading('Syncing with Supabase...');
                const result = await SupabaseService.syncAll(
                    currentUser.value ? currentUser.value.id : '',
                    currentRole.value
                );
                if (!result || !result.success || result.local) {
                    hideLoading();
                    return false;
                }
                const d = result.data;

                if (Array.isArray(d.employees) && d.employees.length) {
                    // Preserve local passwords for any rows not yet in Supabase
                    const passMap = {};
                    employees.value.forEach(e => { if (e.password) passMap[String(e.id)] = e.password; });
                    INITIAL_EMPLOYEES.forEach(e => { passMap[String(e.id)] = e.password; });
                    employees.value = d.employees.map(e => ({
                        ...e,
                        id: String(e.id),
                        password: e.password || passMap[String(e.id)] || '123456',
                        managerId: e.managerId ? String(e.managerId) : ''
                    }));
                }

                if (Array.isArray(d.leaves)) {
                    const remoteLeaves = d.leaves
                        .filter(l => !String(l.id).startsWith('LV-SEED-'))
                        .map(l => ({ ...l, empId: String(l.empId) }));
                    const remoteIds = new Set(remoteLeaves.map(l => String(l.id)));
                    const localOnly = leaves.value.filter(l => String(l.id).startsWith('LV-LOCAL-') && !remoteIds.has(String(l.id)));
                    leaves.value = sanitizeLeavesList([...localOnly, ...remoteLeaves]);
                }

                if (Array.isArray(d.attendance)) {
                    const remoteTs = d.attendance
                        .filter(a => !String(a.id).startsWith('TS-SEED-'))
                        .map(a => ({
                            id: a.id, empId: String(a.empId), empName: a.empName || '',
                            action: a.action || '', time: a.time || '', date: a.date || '',
                            totalHours: a.totalHours || '', punctuality: a.punctuality || 'On Time'
                        }));
                    const remoteIds = new Set(remoteTs.map(t => String(t.id)));
                    const localOnly = timesheets.value.filter(t => String(t.id).startsWith('TS-LOCAL-') && !remoteIds.has(String(t.id)));
                    const merged = [...localOnly, ...remoteTs];
                    const seen = new Set();
                    const cleanTs = [];
                    for (const t of merged) {
                        const k = String(t.id);
                        if (!seen.has(k)) {
                            seen.add(k);
                            cleanTs.push(t);
                        }
                    }
                    timesheets.value = cleanTs;
                }

                if (Array.isArray(d.departments) && d.departments.length) {
                    departments.value = d.departments;
                }

                supabaseConnected.value = true;
                persistState();
                hideLoading();
                if (!silent) showToast('Synced with Supabase ☁️', 'success');
                nextTick(() => { renderAllCharts(); });
                return true;
            } catch (err) {
                hideLoading();
                console.warn('[syncFromSupabase] failed:', err);
                return false;
            }
        }

        // Authentication Methods
        async function handleLogin() {
            const empId = String(loginForm.empId || '').trim();
            const password = String(loginForm.password || '');
            showLoading('Authenticating...');

            // 1. Try Supabase first
            if (SupabaseService.isConfigured()) {
                try {
                    const result = await SupabaseService.login(empId, password);
                    if (result && result.success && result.data && result.data.user) {
                        currentUser.value = result.data.user;
                        localStorage.setItem('ark_session', JSON.stringify(currentUser.value));
                        hideLoading();
                        onLoginSuccess();
                        return;
                    }
                    if (result && !result.local) {
                        hideLoading();
                        showToast(result.error || 'Invalid credentials', 'error');
                        return;
                    }
                } catch (e) { /* fall through to local */ }
            }

            // 2. Offline / local fallback
            if (empId === ADMIN_ACCOUNT.id && password === ADMIN_ACCOUNT.password) {
                currentUser.value = { ...ADMIN_ACCOUNT };
            } else {
                const matched = employees.value.find(emp => String(emp.id).toLowerCase() === empId.toLowerCase());
                if (matched && String(matched.password || '123456') === password) {
                    currentUser.value = {
                        id: matched.id, name: matched.name, email: matched.email, role: 'employee',
                        dept: matched.dept, designation: matched.role, avatar: matched.avatar || '👨‍💼', managerId: matched.managerId || ''
                    };
                }
            }

            hideLoading();
            if (!currentUser.value) {
                showToast('Invalid Employee ID or password', 'error');
                return;
            }

            localStorage.setItem('ark_session', JSON.stringify(currentUser.value));
            onLoginSuccess();
        }

        async function onLoginSuccess() {
            // Fresh tab start
            adminTab.value = 'overview';
            empTab.value = 'overview';
            viewedEmployeeId.value = null;
            showNotifDropdown.value = false;
            loginForm.empId = '';
            loginForm.password = '';

            // Load user-scoped shift, punch, and weekly state
            loadUserShiftState(currentUser.value ? currentUser.value.id : null);
            showToast(`Welcome back, ${currentUser.value.name}!`, 'success');

            // Turn on skeletons while fetching fresh live data
            skeletonLoading.employees = true;
            skeletonLoading.timesheets = true;
            skeletonLoading.leaves = true;

            try {
                await syncFromSupabase(true);
            } finally {
                skeletonLoading.employees = false;
                skeletonLoading.timesheets = false;
                skeletonLoading.leaves = false;
            }

            fetchDailyQuote();
            nextTick(() => {
                if (currentRole.value === 'admin') renderAllCharts();
            });
        }

        function logout() {
            currentUser.value = null;
            adminTab.value = 'overview';
            empTab.value = 'overview';
            viewedEmployeeId.value = null;
            showNotifDropdown.value = false;
            modals.employee = false;
            modals.applyLeave = false;
            modals.department = false;
            modals.avatar = false;
            modals.editProfile = false;
            modals.viewProfile = false;
            resetShiftSession();
            loginForm.empId = '';
            loginForm.password = '';
            localStorage.removeItem('ark_session');
            sessionStorage.clear();
            showToast('Signed out successfully', 'info');
        }

        // Navigation
        function switchAdminNav(sec) {
            adminTab.value = sec;
            nextTick(() => {
                if (sec === 'overview') {
                    ChartManager.renderWeeklyTrend('chart-admin-weekly-trend', timesheets.value, employees.value, isDarkMode.value);
                    ChartManager.renderPresenceDonut('chart-admin-presence-donut', employees.value, isDarkMode.value);
                    ChartManager.renderDeptHeadcount('chart-dept-headcount', departmentList.value, employees.value, isDarkMode.value);
                    ChartManager.renderLeaveTypes('chart-leave-types', 'leave-type-legend', leaves.value, isDarkMode.value);
                } else if (sec === 'attendance') {
                    ChartManager.renderAttPunctuality('chart-att-punctuality', 'donut-att-ontime', timesheets.value, isDarkMode.value);
                    ChartManager.renderAttHours('chart-att-hours', timesheets.value, isDarkMode.value);
                } else if (sec === 'reports') {
                    ChartManager.renderMonthlyAttendance('chart-monthly-attendance', timesheets.value, employees.value, isDarkMode.value);
                }
            });
        }

        function switchEmpTab(tab) {
            empTab.value = tab;
        }

        // Computed Properties
        const departmentList = computed(() => {
            const depts = new Set([...employees.value.map(e => e.dept).filter(Boolean), 'Accounts', 'Documentation', 'Dispatch', 'Operations', 'HR']);
            return Array.from(depts);
        });

        const departmentOverview = computed(() => {
            const iconMap = { 'Accounts': 'fa-calculator', 'Documentation': 'fa-file-lines', 'Dispatch': 'fa-truck', 'Operations': 'fa-gears', 'HR': 'fa-users-gear' };
            return departmentList.value.map(name => {
                const sheetDept = departments.value.find(d => d.name === name);
                const headEmp = employees.value.find(e => e.dept === name && String(e.role || '').toLowerCase().includes('manager')) || employees.value.find(e => e.dept === name);
                const count = employees.value.filter(e => e.dept === name).length;
                return {
                    name,
                    icon: iconMap[name] || 'fa-building',
                    staffCount: count,
                    leadName: (sheetDept && sheetDept.headName) || (headEmp ? headEmp.name : '—'),
                    budget: (sheetDept && sheetDept.budget) || '—'
                };
            });
        });

        const filteredEmployees = computed(() => {
            const q = (empFilter.search || '').toLowerCase();
            const d = empFilter.dept;
            const s = empFilter.status;
            return (employees.value || INITIAL_EMPLOYEES || []).filter(e => {
                const mq = e.name.toLowerCase().includes(q) || String(e.id).toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
                return mq && (d === 'All' || e.dept === d) && (s === 'All' || e.status === s);
            });
        });

        function canAdminDecideLeave(lv) {
            if (!lv) return false;
            if (lv.status === 'Approved' || lv.status === 'Rejected') return false;
            // 1. Manager has already approved -> goes to Admin for final decision
            if (lv.status === 'ManagerApproved') return true;
            // 2. Pending AND applicant is a Manager (or reports directly to Admin) -> Direct Admin decision
            if (lv.status === 'Pending') {
                const applicantIsMgr = isManager(lv.empId);
                const reportingMgr = getEmployeeManager(lv.empId);
                if (applicantIsMgr || !reportingMgr) {
                    return true;
                }
            }
            return false;
        }

        const adminPendingLeavesCount = computed(() => {
            const list = (leaves.value || INITIAL_LEAVES || []).filter(l => canAdminDecideLeave(l));
            const seen = new Set();
            for (const l of list) {
                seen.add(String(l.empId));
            }
            return seen.size;
        });

        // Overview widget: exactly 1 pending leave per employee
        const pendingLeavesOverview = computed(() => {
            const list = (leaves.value || INITIAL_LEAVES || []).filter(l => l.status === 'Pending' || l.status === 'ManagerApproved');
            // Prioritize leaves ready for admin decision, then most recent date
            list.sort((a, b) => {
                const aAdmin = canAdminDecideLeave(a) ? 1 : 0;
                const bAdmin = canAdminDecideLeave(b) ? 1 : 0;
                if (bAdmin !== aAdmin) return bAdmin - aAdmin;
                const timeA = new Date(a.createdAt || a.from || 0).getTime();
                const timeB = new Date(b.createdAt || b.from || 0).getTime();
                return timeB - timeA;
            });
            const seen = new Set();
            const result = [];
            for (const l of list) {
                const empKey = String(l.empId);
                if (!seen.has(empKey)) {
                    seen.add(empKey);
                    result.push(l);
                }
            }
            return result.slice(0, 5);
        });

        // Leaves & Approvals Queue Table: exactly 1 leave per employee
        const filteredAdminLeaves = computed(() => {
            let pool = (leaves.value || INITIAL_LEAVES || []);
            if (leaveFilterStatus.value !== 'All') {
                pool = pool.filter(l => l.status === leaveFilterStatus.value);
            }
            // Sort to prioritize pending admin approvals first, then manager approvals, then most recent date
            const sorted = [...pool].sort((a, b) => {
                const getWeight = (l) => {
                    if (canAdminDecideLeave(l)) return 4;
                    if (l.status === 'ManagerApproved') return 3;
                    if (l.status === 'Pending') return 2;
                    return 1;
                };
                const diff = getWeight(b) - getWeight(a);
                if (diff !== 0) return diff;
                const timeA = new Date(a.createdAt || a.from || 0).getTime();
                const timeB = new Date(b.createdAt || b.from || 0).getTime();
                return timeB - timeA;
            });

            // Ensure only 1 leave per employee is shown in the approval queue
            const seenEmp = new Set();
            const result = [];
            for (const lv of sorted) {
                const empKey = String(lv.empId);
                if (!seenEmp.has(empKey)) {
                    seenEmp.add(empKey);
                    result.push(lv);
                }
            }
            return result;
        });

        // Unique employee counts for Leaves tab stats
        const adminStatsAwaitingAdmin = computed(() => {
            const seen = new Set();
            (leaves.value || INITIAL_LEAVES || []).filter(l => canAdminDecideLeave(l)).forEach(l => seen.add(String(l.empId)));
            return seen.size;
        });

        const adminStatsAwaitingMgr = computed(() => {
            const seen = new Set();
            (leaves.value || INITIAL_LEAVES || []).filter(l => l.status === 'Pending' && !canAdminDecideLeave(l)).forEach(l => seen.add(String(l.empId)));
            return seen.size;
        });

        const adminStatsApproved = computed(() => {
            const seen = new Set();
            (leaves.value || INITIAL_LEAVES || []).filter(l => l.status === 'Approved').forEach(l => seen.add(String(l.empId)));
            return seen.size;
        });

        const adminStatsRejected = computed(() => {
            const seen = new Set();
            (leaves.value || INITIAL_LEAVES || []).filter(l => l.status === 'Rejected').forEach(l => seen.add(String(l.empId)));
            return seen.size;
        });

        const mySubmittedLeaves = computed(() => {
            if (!currentUser.value) return [];
            return (leaves.value || INITIAL_LEAVES || []).filter(l => String(l.empId) === String(currentUser.value.id));
        });

        const isUserManager = computed(() => {
            try {
                if (!currentUser.value) return false;
                const r = (currentUser.value.designation || currentUser.value.role || '').toLowerCase();
                if (r.includes('manager') || r.includes('lead') || r.includes('supervisor') || r.includes('head')) return true;
                return isManager(currentUser.value.id);
            } catch (e) {
                return false;
            }
        });

        const userSubordinates = computed(() => {
            try {
                if (!currentUser.value) return [];
                const myId = String(currentUser.value.id);
                const emps = employees.value || INITIAL_EMPLOYEES || [];
                const myEmp = emps.find(e => e && String(e.id) === myId);
                const myDept = myEmp?.dept || currentUser.value.dept;
                return emps.filter(e => {
                    if (!e) return false;
                    if (String(e.id) === myId) return false;
                    if (String(e.managerId) === myId) return true;
                    if (isUserManager.value && e.dept === myDept && !isManager(e.id)) return true;
                    return false;
                });
            } catch (e) {
                return [];
            }
        });

        const userReportingManager = computed(() => {
            if (!currentUser.value) return { name: 'Super Administrator', role: 'Executive', dept: 'Executive', avatar: '👨‍💼', email: 'admin@ark.com' };
            const m = currentUser.value.managerId ? (employees.value || INITIAL_EMPLOYEES || []).find(e => String(e.id) === String(currentUser.value.managerId)) : null;
            if (m) return { name: m.name, role: m.role || 'Manager', dept: m.dept || 'Executive', avatar: m.avatar || '👨‍💼', email: m.email };
            return { name: 'Super Administrator', role: 'Super Administrator', dept: 'Executive / HR', avatar: '👨‍💼', email: 'admin@ark.com' };
        });

        const managerSubordinateLeaves = computed(() => {
            try {
                if (!currentUser.value || !isUserManager.value) return [];
                const myId = String(currentUser.value.id);
                const myEmp = (employees.value || INITIAL_EMPLOYEES || []).find(e => String(e.id) === myId);
                const myDept = myEmp?.dept || currentUser.value.dept;
                const subIds = new Set((userSubordinates.value || []).map(s => String(s.id)));

                const raw = (leaves.value || INITIAL_LEAVES || []).filter(l => {
                    if (!l) return false;
                    // Never show manager's own leave requests in subordinate queue
                    if (String(l.empId) === myId) return false;
                    // Direct match by managerId
                    if (String(l.managerId) === myId) return true;
                    // Subordinate direct id match
                    if (subIds.has(String(l.empId))) return true;
                    // Manager name match
                    if (currentUser.value.name && l.managerName && l.managerName.toLowerCase() === currentUser.value.name.toLowerCase()) return true;
                    // Match by employee record in current employees list
                    const applicant = (employees.value || INITIAL_EMPLOYEES || []).find(e => String(e.id) === String(l.empId));
                    if (applicant) {
                        if (String(applicant.managerId) === myId) return true;
                        if (applicant.dept === myDept && !isManager(applicant.id) && (!l.managerId || String(l.managerId) === '1' || String(l.managerId) === myId)) {
                            return true;
                        }
                    }
                    return false;
                });

                // 1 leave per subordinate (Pending prioritized, then latest date)
                raw.sort((a, b) => {
                    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                    if (b.status === 'Pending' && a.status !== 'Pending') return 1;
                    const timeA = new Date(a.createdAt || a.from || 0).getTime();
                    const timeB = new Date(b.createdAt || b.from || 0).getTime();
                    return timeB - timeA;
                });
                const seen = new Set();
                const result = [];
                for (const l of raw) {
                    const empKey = String(l.empId);
                    if (!seen.has(empKey)) {
                        seen.add(empKey);
                        result.push(l);
                    }
                }
                return result;
            } catch (e) {
                return [];
            }
        });

        const managerSubordinatePendingCount = computed(() => {
            try {
                const list = managerSubordinateLeaves.value;
                if (!Array.isArray(list)) return 0;
                return list.filter(l => l && l.status === 'Pending').length;
            } catch (e) {
                return 0;
            }
        });

        const userNotifications = computed(() => {
            try {
                if (!currentUser.value) return [];
                const list = notifications.value;
                if (!Array.isArray(list)) return [];
                return list.filter(n => n && (!n.targetEmpId || String(n.targetEmpId) === String(currentUser.value.id) || currentUser.value.role === 'admin'));
            } catch (e) {
                return [];
            }
        });

        function addNotification(text, targetEmpId = null, icon = 'fa-bell') {
            const notif = {
                id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                text, time: getNJTimeString() + ' · ' + getNJDateString(),
                targetEmpId, icon, read: false
            };
            notifications.value.unshift(notif);
            try { localStorage.setItem('ark_notifications', JSON.stringify(notifications.value)); } catch (e) {}
        }

        function clearNotifications() {
            notifications.value = [];
            try { localStorage.setItem('ark_notifications', JSON.stringify([])); } catch (e) {}
            showToast('Notifications cleared', 'info');
        }

        function isManager(empId) {
            if (!empId) return false;
            if (String(empId) === '1') return true;
            const emps = employees.value || INITIAL_EMPLOYEES || [];
            const emp = emps.find(e => e && String(e.id) === String(empId));
            if (emp) {
                const r = (emp.role || emp.designation || '').toLowerCase();
                if (r.includes('manager') || r.includes('lead') || r.includes('supervisor') || r.includes('head')) return true;
            }
            return emps.some(e => e && String(e.managerId) === String(empId));
        }

        function getEmployeeManager(empId) {
            const emps = employees.value || INITIAL_EMPLOYEES || [];
            const emp = emps.find(e => e && String(e.id) === String(empId));
            if (!emp || !emp.managerId || String(emp.managerId) === '1' || String(emp.managerId) === String(empId)) return null;
            return emps.find(e => e && String(e.id) === String(emp.managerId)) || null;
        }

        function getEmployeeManagerName(managerId) {
            if (!managerId || String(managerId) === '1') return 'Super Administrator / None';
            const m = employees.value.find(e => String(e.id) === String(managerId));
            return m ? m.name : 'Super Administrator';
        }

        function getBadgeClasses(status) {
            switch (status) {
                case 'Active': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
                case 'Away': return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
                case 'On Leave': return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800';
                case 'Inactive': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700';
                default: return 'bg-blue-50 text-blue-700';
            }
        }

        function formatDateNice(dateStr) {
            if (!dateStr) return '—';
            let s = String(dateStr).trim();
            if (s.includes('T')) s = s.split('T')[0];
            const parts = s.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
                const year = parts[0], monthIdx = parseInt(parts[1], 10) - 1, day = parts[2];
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                if (monthIdx >= 0 && monthIdx < 12) return `${day} ${months[monthIdx]} ${year}`;
            }
            return s;
        }

        function getLeaveAuditBadge(lv) {
            if (!lv) return '';
            const isApplicantManager = isManager(lv.empId);
            if (lv.status === 'Pending') {
                if (isApplicantManager) {
                    return `<span class="text-amber-600 font-bold" title="Direct Admin Decision Required">⌛ Pending Admin Approval (Direct)</span>`;
                }
                const mgrName = lv.managerName || (employees.value.find(e => String(e.id) === String(lv.managerId))?.name) || 'Manager';
                return `<span class="text-amber-600 font-bold" title="1st Level: Awaiting Manager Approval">⌛ 1st Level: Pending Manager (${mgrName})</span>`;
            }
            if (lv.status === 'ManagerApproved') {
                const mgrName = lv.managerName || 'Manager';
                return `<span class="text-blue-600 font-bold" title="Approved by Manager, Awaiting Admin">✓ Manager (${mgrName}) Approved · ⌛ 2nd Level: Pending Admin</span>`;
            }
            if (lv.status === 'Approved') {
                const admName = lv.adminName || 'Admin';
                const mgrName = lv.managerName;
                const note = lv.adminNote ? ` (Note: ${lv.adminNote})` : '';
                if (isApplicantManager) {
                    return `<span class="text-emerald-600 font-bold" title="Approved by Admin">✓ Approved by Admin (${admName})${note}</span>`;
                }
                return `<span class="text-emerald-600 font-bold" title="Fully Approved">✓✓ Approved (Mgr: ${mgrName || '✓'} → Admin: ${admName})${note}</span>`;
            }
            if (lv.status === 'Rejected') {
                const decider = lv.adminDecision === 'Rejected' ? `Admin (${lv.adminName || 'Admin'})` : `Manager (${lv.managerName || 'Manager'})`;
                const note = lv.adminNote || lv.managerNote ? ` — Note: ${lv.adminNote || lv.managerNote}` : '';
                return `<span class="text-rose-600 font-bold" title="Rejected">✗ Rejected by ${decider}${note}</span>`;
            }
            return `<span class="text-slate-400 font-bold">${lv.status}</span>`;
        }

        // Employee Management
        function openAddEmployeeModal() {
            empForm.id = '';
            empForm.name = '';
            empForm.email = '';
            empForm.dept = departmentList.value[0] || 'Accounts';
            empForm.role = '';
            empForm.status = 'Active';
            empForm.managerId = '';
            empForm.password = '';
            empForm.avatar = '👨‍💼';
            empForm.leaveQuotaAnnual = 14;
            empForm.leaveQuotaSick = 7;
            empForm.leaveQuotaCasual = 5;
            modals.employee = true;
        }

        function editEmployee(id) {
            const emp = employees.value.find(e => String(e.id) === String(id));
            if (!emp) return;
            empForm.id = emp.id;
            empForm.name = emp.name;
            empForm.email = emp.email;
            empForm.dept = emp.dept;
            empForm.role = emp.role || '';
            empForm.status = emp.status;
            empForm.managerId = emp.managerId || '';
            empForm.password = '';
            empForm.avatar = emp.avatar || '👨‍💼';
            empForm.leaveQuotaAnnual = emp.leaveQuotas?.annual ?? 14;
            empForm.leaveQuotaSick = emp.leaveQuotas?.sick ?? 7;
            empForm.leaveQuotaCasual = emp.leaveQuotas?.casual ?? 5;
            modals.employee = true;
        }

        async function saveEmployeeSubmit() {
            showLoading('Saving Employee...');
            try {
                const editId = empForm.id;
                const employeePayload = {
                    id: editId || undefined,
                    name: empForm.name.trim(),
                    email: empForm.email.trim(),
                    dept: empForm.dept,
                    role: empForm.role.trim(),
                    status: empForm.status,
                    managerId: empForm.managerId || '',
                    password: empForm.password || undefined,
                    avatar: empForm.avatar || '👨‍💼',
                    leaveQuotas: {
                        annual: Number(empForm.leaveQuotaAnnual) || 0,
                        sick: Number(empForm.leaveQuotaSick) || 0,
                        casual: Number(empForm.leaveQuotaCasual) || 0
                    }
                };

                // Optimistic local update
                if (editId) {
                    const target = employees.value.find(e => String(e.id) === String(editId));
                    if (target) Object.assign(target, employeePayload);
                } else {
                    const newId = String(100 + employees.value.length + 1);
                    employees.value.push({
                        id: newId, ...employeePayload, password: employeePayload.password || '123456',
                        joined: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    });
                    employeePayload.id = newId;
                }
                persistState();

                // Persist to Supabase (background, no-throw)
                SupabaseService.saveEmployee(employeePayload).catch(() => {});

                modals.employee = false;
                showToast(editId ? `Updated ${empForm.name}` : `Added ${empForm.name}`, 'success');
            } finally {
                hideLoading();
            }
        }

        async function deleteEmployeePrompt(id) {
            const emp = employees.value.find(e => String(e.id) === String(id));
            if (!emp || !confirm(`Remove ${emp.name}?`)) return;
            employees.value = employees.value.filter(e => String(e.id) !== String(id));
            persistState();
            SupabaseService.deleteEmployee(id).catch(() => {});
            showToast(`${emp.name} removed`, 'info');
        }

        function openEmployeeProfileModal(id) {
            viewedEmployeeId.value = id;
            modals.viewProfile = true;
        }

        const viewedEmployee = computed(() => {
            return employees.value.find(e => String(e.id) === String(viewedEmployeeId.value));
        });

        const viewedEmployeeTimesheets = computed(() => {
            if (!viewedEmployeeId.value) return [];
            return (timesheets.value || INITIAL_TIMESHEETS || []).filter(t => String(t.empId) === String(viewedEmployeeId.value));
        });

        const viewedEmployeeLeaves = computed(() => {
            if (!viewedEmployeeId.value) return [];
            return (leaves.value || INITIAL_LEAVES || []).filter(l => String(l.empId) === String(viewedEmployeeId.value));
        });

        function openAvatarPicker() { modals.avatar = true; }
        const customAvatarUrl = ref('');

        function setCustomAvatarUrl() {
            const url = String(customAvatarUrl.value || '').trim();
            if (!url) {
                showToast('Please enter a valid image URL or path', 'error');
                return;
            }
            selectAvatar(url);
            customAvatarUrl.value = '';
        }

        function isAvatarImage(av) {
            if (!av) return false;
            const s = String(av).trim();
            return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('assets/') || s.startsWith('/') || s.startsWith('data:');
        }

        function selectAvatar(av) {
            if (currentUser.value) {
                currentUser.value.avatar = av;
                localStorage.setItem('ark_session', JSON.stringify(currentUser.value));
                const emp = employees.value.find(e => String(e.id) === String(currentUser.value.id));
                if (emp) { emp.avatar = av; persistState(); }
            }
            modals.avatar = false;
            showToast('Avatar updated!', 'success');
        }

        function openEditProfileModal() {
            profileForm.name = currentUser.value.name;
            profileForm.email = currentUser.value.email;
            profileForm.role = currentUser.value.designation || '';
            modals.editProfile = true;
        }

        function saveProfileInfo() {
            currentUser.value.name = profileForm.name.trim();
            currentUser.value.email = profileForm.email.trim();
            currentUser.value.designation = profileForm.role.trim();
            const me = employees.value.find(e => String(e.id) === String(currentUser.value.id));
            if (me) { me.name = currentUser.value.name; me.email = currentUser.value.email; me.role = currentUser.value.designation; }
            persistState();
            localStorage.setItem('ark_session', JSON.stringify(currentUser.value));
            modals.editProfile = false;
            showToast('Profile updated', 'success');
        }

        // ── Change Password & Announcements State & Methods ─────────────────
        const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
        const announcementForm = reactive({ title: '', message: '', priority: 'Normal' });
        const announcementsList = ref(safeParseJSON('ark_announcements', null) || [
            { id: 'AN-1', title: 'Welcome to ARK HRMS Enterprise', message: 'All employees are requested to maintain punctuality and record shift hours in NJ Time.', date: '2026-09-01', priority: 'High', author: 'Administrator' }
        ]);
        watch(announcementsList, () => localStorage.setItem('ark_announcements', JSON.stringify(announcementsList.value)), { deep: true });

        function openChangePasswordModal() {
            passwordForm.oldPassword = '';
            passwordForm.newPassword = '';
            passwordForm.confirmPassword = '';
            modals.password = true;
        }

        function submitChangePassword() {
            if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
                showToast('Please fill in all password fields', 'error');
                return;
            }
            if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                showToast('New passwords do not match', 'error');
                return;
            }
            if (passwordForm.newPassword.length < 6) {
                showToast('New password must be at least 6 characters long', 'error');
                return;
            }
            const emp = employees.value.find(e => String(e.id) === String(currentUser.value.id));
            if (!emp) {
                showToast('User session error', 'error');
                return;
            }
            const currentPass = emp.password || (String(emp.id) === '1' ? 'admin123' : '123456');
            if (passwordForm.oldPassword !== currentPass) {
                showToast('Incorrect old password', 'error');
                return;
            }
            emp.password = passwordForm.newPassword;
            persistState();
            modals.password = false;
            showToast('Password updated successfully!', 'success');
        }

        function openAnnouncementsModal() {
            modals.announcement = true;
        }

        function postAnnouncement() {
            if (!announcementForm.title || !announcementForm.message) {
                showToast('Please enter both title and message', 'error');
                return;
            }
            const newAnn = {
                id: 'AN-' + Date.now(),
                title: announcementForm.title.trim(),
                message: announcementForm.message.trim(),
                priority: announcementForm.priority,
                date: new Date().toISOString().slice(0, 10),
                author: currentUser.value ? currentUser.value.name : 'Administrator'
            };
            announcementsList.value.unshift(newAnn);
            announcementForm.title = '';
            announcementForm.message = '';
            announcementForm.priority = 'Normal';
            showToast('Announcement posted successfully!', 'success');
        }

        function deleteAnnouncement(id) {
            announcementsList.value = announcementsList.value.filter(a => a.id !== id);
            showToast('Announcement removed', 'info');
        }

        function openAddDepartmentModal() {
            deptForm.name = '';
            deptForm.headId = '';
            deptForm.headName = '';
            deptForm.budget = '';
            modals.department = true;
        }

        async function saveDepartmentSubmit() {
            if (!deptForm.name) { showToast('Department name required', 'error'); return; }
            departments.value.push({
                name: deptForm.name.trim(),
                headId: deptForm.headId.trim(),
                headName: deptForm.headName.trim(),
                budget: deptForm.budget.trim()
            });
            persistState();
            SupabaseService.saveDepartment({ ...deptForm }).catch(() => {});
            modals.department = false;
            showToast(`Department "${deptForm.name}" created`, 'success');
        }

        // Leave Decision Processing
        async function adminFinalDecide(leaveId, decision) {
            const leave = leaves.value.find(l => String(l.id) === String(leaveId));
            if (!leave) return;
            const note = decision === 'Rejected' ? (prompt('Rejection reason (optional):', '') || '') : '';
            showLoading(`Processing Admin ${decision}...`);
            try {
                leave.status = decision;
                leave.adminDecision = decision;
                leave.adminName = currentUser.value ? currentUser.value.name : 'Admin';
                leave.adminId = currentUser.value ? String(currentUser.value.id) : '1';
                leave.adminNote = note;
                leave.adminAt = new Date().toISOString();

                if (decision === 'Approved') {
                    const emp = employees.value.find(e => String(e.id) === String(leave.empId));
                    if (emp) {
                        emp.status = 'On Leave';
                        emp.usedLeaveDays = Number(emp.usedLeaveDays || 0) + Number(leave.days || 0);
                    }
                }

                // Synchronize any duplicate sibling leaves for this employee
                leaves.value.forEach(other => {
                    if (String(other.id) !== String(leaveId) && String(other.empId) === String(leave.empId) && other.from === leave.from && other.to === leave.to) {
                        other.status = decision;
                        other.adminDecision = decision;
                        other.adminNote = note;
                        other.adminName = leave.adminName;
                        other.adminId = leave.adminId;
                        other.adminAt = leave.adminAt;
                    }
                });

                persistState();

                addNotification(`Your ${leave.type} request was ${decision} by Admin.${note ? ' Note: ' + note : ''}`, leave.empId, decision === 'Approved' ? 'fa-circle-check' : 'fa-circle-xmark');
                if (leave.managerId && String(leave.managerId) !== '1' && String(leave.managerId) !== String(leave.empId)) {
                    addNotification(`Admin ${decision} leave for team member ${leave.empName}.${note ? ' Note: ' + note : ''}`, leave.managerId, 'fa-bell');
                }

                SupabaseService.adminDecideLeave(leaveId, decision, currentUser.value ? currentUser.value.id : '1', currentUser.value ? currentUser.value.name : 'Admin', note, getNJDateString()).catch(() => {});
                showToast(`Leave ${decision} for ${leave.empName}`, decision === 'Approved' ? 'success' : 'info');
            } finally {
                hideLoading();
            }
        }

        async function managerDecideLeave(leaveId, decision) {
            const leave = leaves.value.find(l => String(l.id) === String(leaveId));
            if (!leave) return;
            const note = decision === 'Rejected' ? (prompt('Rejection reason (optional):', '') || '') : '';
            showLoading(`Processing Manager ${decision}...`);
            try {
                leave.status = decision === 'Approved' ? 'ManagerApproved' : 'Rejected';
                leave.managerDecision = decision;
                leave.managerName = currentUser.value ? currentUser.value.name : 'Manager';
                leave.managerId = currentUser.value ? String(currentUser.value.id) : leave.managerId;
                leave.managerNote = note;
                leave.managerAt = new Date().toISOString();

                // Synchronize any duplicate sibling leaves for this employee
                leaves.value.forEach(other => {
                    if (String(other.id) !== String(leaveId) && String(other.empId) === String(leave.empId) && other.from === leave.from && other.to === leave.to) {
                        other.status = leave.status;
                        other.managerDecision = decision;
                        other.managerNote = note;
                        other.managerName = leave.managerName;
                        other.managerId = leave.managerId;
                        other.managerAt = leave.managerAt;
                    }
                });

                persistState();

                const mgrName = currentUser.value ? currentUser.value.name : 'Manager';
                if (decision === 'Approved') {
                    addNotification(`Your ${leave.type} request was Approved by Manager (${mgrName}). Awaiting Admin final approval.${note ? ' Note: ' + note : ''}`, leave.empId, 'fa-circle-check');
                    addNotification(`Manager ${mgrName} approved leave for ${leave.empName}. Action Required: Admin final approval.`, '1', 'fa-clipboard-check');
                    showToast(`Leave approved for ${leave.empName}! Sent to Admin for final approval.`, 'success');
                } else {
                    addNotification(`Your ${leave.type} request was Rejected by Manager (${mgrName}).${note ? ' Note: ' + note : ''}`, leave.empId, 'fa-circle-xmark');
                    showToast(`Leave rejected for ${leave.empName}`, 'info');
                }

                SupabaseService.managerDecideLeave(leaveId, decision, currentUser.value ? currentUser.value.id : leave.managerId, currentUser.value ? currentUser.value.name : mgrName, note, getNJDateString()).catch(() => {});
            } finally {
                hideLoading();
            }
        }

        function openApplyLeaveModal() {
            leaveForm.type = 'Annual Leave';
            leaveForm.from = '';
            leaveForm.to = '';
            leaveForm.reason = '';
            modals.applyLeave = true;
        }

        async function submitApplyLeave() {
            // ── Double-submission guard ──
            if (isSubmittingLeave.value) return;
            isSubmittingLeave.value = true;

            const { type, from, to, reason } = leaveForm;
            if (!from || !to) { showToast('Please select start and end dates', 'error'); isSubmittingLeave.value = false; return; }
            if (new Date(from) > new Date(to)) { showToast('Start date cannot be after end date', 'error'); isSubmittingLeave.value = false; return; }

            const myExisting = leaves.value.filter(l => String(l.empId) === String(currentUser.value.id) && l.status !== 'Rejected');
            const overlap = myExisting.some(l => (from <= l.to && to >= l.from));
            if (overlap) { showToast('You already have an active leave request covering these dates!', 'error'); isSubmittingLeave.value = false; return; }

            showLoading('Submitting Leave Request...');
            try {
                const d1 = new Date(from), d2 = new Date(to);
                const days = Math.ceil(Math.abs(d2 - d1) / 86400000) + 1;

                const myEmp = employees.value.find(e => String(e.id) === String(currentUser.value.id)) || currentUser.value;
                const applicantIsManager = isManager(currentUser.value.id);

                let targetMgrId = myEmp.managerId ? String(myEmp.managerId) : '';
                if (applicantIsManager) {
                    targetMgrId = '1';
                } else if (!targetMgrId || targetMgrId === '1') {
                    const deptMgr = employees.value.find(e => e.dept === myEmp.dept && isManager(e.id) && String(e.id) !== String(currentUser.value.id));
                    if (deptMgr) {
                        targetMgrId = String(deptMgr.id);
                    } else {
                        targetMgrId = '1';
                    }
                }

                const managerEmp = employees.value.find(m => String(m.id) === targetMgrId);
                const targetMgrName = managerEmp ? managerEmp.name : (targetMgrId === '1' ? 'Administrator' : 'Manager');

                const newReq = {
                    id: `LV-LOCAL-${Date.now()}`,
                    empId: String(currentUser.value.id),
                    empName: currentUser.value.name,
                    type, from, to, days,
                    reason: reason.trim(),
                    status: 'Pending',
                    managerId: targetMgrId,
                    managerName: targetMgrName,
                    managerDecision: applicantIsManager ? 'N/A (Direct Admin Review)' : '',
                    createdAt: new Date().toISOString()
                };

                // Persist to Supabase (background)
                SupabaseService.applyLeave(newReq).catch(() => {});

                leaves.value.unshift(newReq);
                persistState();

                if (applicantIsManager || targetMgrId === '1') {
                    addNotification(`Manager Leave: ${currentUser.value.name} applied for ${type} (${days} days). Admin approval required.`, '1', 'fa-plane-departure');
                    showToast('Leave request submitted directly to Admin for approval!', 'success');
                } else {
                    addNotification(`${currentUser.value.name} requested ${type} (${days} days). 1st Level Manager approval required.`, targetMgrId, 'fa-plane-departure');
                    addNotification(`Leave Request: ${currentUser.value.name} applied for ${type} (${days} days) · Awaiting Manager (${targetMgrName}).`, '1', 'fa-clock');
                    showToast(`Leave request submitted! Awaiting Manager (${targetMgrName}) approval.`, 'success');
                }

                modals.applyLeave = false;
            } finally {
                hideLoading();
                isSubmittingLeave.value = false;
            }
        }

        // ── Admin Direct Leave Assignment ────────────────────────────────────
        function openAdminAddLeaveModal() {
            adminLeaveForm.empId = employees.value[0] ? String(employees.value[0].id) : '';
            adminLeaveForm.type = 'Annual Leave';
            adminLeaveForm.from = getNJDateString();
            adminLeaveForm.to = getNJDateString();
            adminLeaveForm.reason = '';
            adminLeaveForm.status = 'Approved';
            modals.adminLeave = true;
        }

        async function submitAdminAddLeave() {
            const { empId, type, from, to, reason, status } = adminLeaveForm;
            if (!empId) { showToast('Please select an employee', 'error'); return; }
            if (!from || !to) { showToast('Please select start and end dates', 'error'); return; }
            if (new Date(from) > new Date(to)) { showToast('Start date cannot be after end date', 'error'); return; }

            const emp = employees.value.find(e => String(e.id) === String(empId));
            if (!emp) { showToast('Employee not found', 'error'); return; }

            showLoading('Assigning Employee Leave...');
            try {
                const d1 = new Date(from), d2 = new Date(to);
                const days = Math.ceil(Math.abs(d2 - d1) / 86400000) + 1;

                const newReq = {
                    id: `LV-ADM-${Date.now()}`,
                    empId: String(emp.id),
                    empName: emp.name,
                    type, from, to, days,
                    reason: reason.trim() || 'Assigned by HR/Admin',
                    status,
                    managerId: emp.managerId || '1',
                    managerName: getEmployeeManagerName(emp.id),
                    managerDecision: status === 'Approved' ? 'Approved' : '',
                    managerAt: new Date().toISOString(),
                    managerNote: 'Created by Admin',
                    adminId: currentUser.value ? String(currentUser.value.id) : '1',
                    adminName: currentUser.value ? currentUser.value.name : 'Administrator',
                    adminDecision: status === 'Approved' ? 'Approved' : status,
                    adminAt: new Date().toISOString(),
                    adminNote: 'Created by Admin',
                    createdAt: new Date().toISOString()
                };

                leaves.value.unshift(newReq);
                if (status === 'Approved') {
                    emp.status = 'On Leave';
                    emp.usedLeaveDays = Number(emp.usedLeaveDays || 0) + days;
                }
                persistState();
                modals.adminLeave = false;
                showToast(`Leave assigned for ${emp.name}!`, 'success');
            } finally {
                hideLoading();
            }
        }

        function clearTestRecords() {
            if (confirm("Clear all attendance timesheets, leave applications, notifications, and test logs? Employees and departments will be kept intact for fresh client delivery.")) {
                timesheets.value = [];
                leaves.value = [];
                notifications.value = [];
                mockWeeklyCheckIns.value = [];
                localStorage.removeItem('ark_timesheets');
                localStorage.removeItem('ark_leaves');
                localStorage.removeItem('ark_notifications');
                localStorage.removeItem('ark_emp_weekly_checkins');
                persistState();
                showToast('All dummy test records cleared! System is 100% fresh.', 'success');
            }
        }

        // Punch & Shift Tracking
        const isUserOnApprovedLeave = computed(() => {
            if (!currentUser.value) return false;
            const todayNJ = getNJDateString();
            const me = employees.value.find(e => String(e.id) === String(currentUser.value.id));
            if (me && me.status === 'On Leave') return true;
            return leaves.value.some(l => String(l.empId) === String(currentUser.value.id) && l.status === 'Approved' && todayNJ >= l.from && todayNJ <= l.to);
        });

        function isPunchDisabled(action) {
            if (isUserOnApprovedLeave.value) return true;
            const st = employeeAttendanceState.value;
            if (action === 'Check In') return st !== 'out';
            if (action === 'Break') return st !== 'working';
            if (action === 'Step Away') return st !== 'working';
            if (action === 'Return Back') return st !== 'break' && st !== 'away';
            if (action === 'Check Out') return st === 'out' || st === 'checkedOut';
            return true;
        }

        const empActionHint = computed(() => {
            if (isUserOnApprovedLeave.value) return 'You are currently on Approved Leave. Shift punches are paused.';
            switch (employeeAttendanceState.value) {
                case 'out': return 'Please Check In to begin your workday shift.';
                case 'working': return 'You are currently Checked In & Active.';
                case 'break': return 'On Break. Click Return to resume workday.';
                case 'away': return 'Stepped away. Click Return to resume workday.';
                case 'checkedOut': return 'Your workday shift has concluded.';
                default: return '';
            }
        });

        const empStatusPillText = computed(() => {
            if (isUserOnApprovedLeave.value) return 'On Leave';
            switch (employeeAttendanceState.value) {
                case 'out': return 'Not Checked In';
                case 'working': return 'Working · Active';
                case 'break': return 'On Break';
                case 'away': return 'Stepped Away';
                case 'checkedOut': return 'Shift Completed';
                default: return 'Not Started';
            }
        });

        const empStatusPillClasses = computed(() => {
            if (isUserOnApprovedLeave.value) return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300';
            switch (employeeAttendanceState.value) {
                case 'out': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                case 'working': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
                case 'break': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
                case 'away': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300';
                case 'checkedOut': return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
                default: return 'bg-slate-100 text-slate-600';
            }
        });

        function computeWorkingMinutes() {
            if (!punchLog.checkIn || employeeAttendanceState.value === 'out' || employeeAttendanceState.value === 'checkedOut') {
                return shiftSession.workingMinutes || 0;
            }
            const nowMs = Date.now();
            let breakMs = 0;
            if (punchLog.breaks && Array.isArray(punchLog.breaks)) {
                punchLog.breaks.forEach(b => {
                    if (b.start && b.end) breakMs += (b.end - b.start);
                    else if (b.start) breakMs += (nowMs - b.start);
                });
            }
            if (punchLog.breakStart) breakMs += (nowMs - punchLog.breakStart);
            if (punchLog.awayStart) breakMs += (nowMs - punchLog.awayStart);
            const workingMs = Math.max(0, nowMs - punchLog.checkIn - breakMs);
            return Math.floor(workingMs / 60000);
        }

        // ─── Live Shift Metrics (second-accurate, reactive to liveNow) ────────
        const TARGET_SHIFT_SECONDS = 10 * 3600; // 36,000 seconds = 10 hours

        const liveShiftMetrics = computed(() => {
            const _tick = liveNow.value; // reactive dependency — updates every second
            const state = employeeAttendanceState.value;

            if (state === 'out') {
                return {
                    workSec: 0, breakSec: 0, remainSec: TARGET_SHIFT_SECONDS,
                    workFmt: '0h 00m 00s', breakFmt: '0h 00m 00s', remainFmt: '10h 00m 00s',
                    percent: 0
                };
            }

            if (state === 'checkedOut') {
                const ws = (shiftSession.workingSeconds || (shiftSession.workingMinutes || 0) * 60);
                const bs = (shiftSession.breakSeconds || (shiftSession.breakMinutes || 0) * 60);
                const pct = Math.min(100, Math.round((ws / TARGET_SHIFT_SECONDS) * 100));
                return {
                    workSec: ws, breakSec: bs,
                    remainSec: Math.max(0, TARGET_SHIFT_SECONDS - ws),
                    workFmt: formatSecondsHms(ws),
                    breakFmt: formatSecondsHms(bs),
                    remainFmt: pct >= 100 ? '0h 00m 00s (Goal Achieved!)' : formatSecondsHms(TARGET_SHIFT_SECONDS - ws),
                    percent: pct
                };
            }

            // Live calculation for 'working' | 'break' | 'away'
            const now = Date.now();
            let breakMs = 0;
            if (punchLog.breaks && Array.isArray(punchLog.breaks)) {
                punchLog.breaks.forEach(b => { if (b.start && b.end) breakMs += (b.end - b.start); });
            }
            // Add current ongoing break/away
            if (punchLog.breakStart) breakMs += (now - punchLog.breakStart);
            if (punchLog.awayStart) breakMs += (now - punchLog.awayStart);

            const checkInMs = punchLog.checkIn || now;
            const totalElapsedMs = Math.max(0, now - checkInMs);
            const workMs = Math.max(0, totalElapsedMs - breakMs);

            const ws = Math.floor(workMs / 1000);
            const bs = Math.floor(breakMs / 1000);
            const pct = Math.min(100, Math.round((ws / TARGET_SHIFT_SECONDS) * 100));
            const remSec = Math.max(0, TARGET_SHIFT_SECONDS - ws);

            return {
                workSec: ws, breakSec: bs, remainSec: remSec,
                workFmt: formatSecondsHms(ws),
                breakFmt: formatSecondsHms(bs),
                remainFmt: formatSecondsHms(remSec),
                percent: pct
            };
        });

        const shiftProgress = computed(() => {
            const m = liveShiftMetrics.value;
            const pct = m.percent;
            return {
                percent: pct,
                completedText: `${m.workFmt} completed`,
                remainingText: pct >= 100 ? '🎉 10h Goal Achieved!' : `${m.remainFmt} remaining`,
                breakDeductedText: `${m.breakFmt} break deducted`
            };
        });

        function empPunchAction(action) {
            if (isUserOnApprovedLeave.value) {
                showToast('You are currently on Approved Leave. Punching is disabled.', 'error');
                return;
            }
            showLoading(`Logging ${action}...`);
            setTimeout(() => {
                hideLoading();
                const now = Date.now();
                const timeStr = getNJTimeString();
                const dateStr = getNJDateString();

                if (!punchLog.checkIn) {
                    punchLog.checkIn = null;
                    punchLog.breaks = [];
                    punchLog.breakStart = null;
                    punchLog.awayStart = null;
                }

                if (action === 'Check In') {
                    employeeAttendanceState.value = 'working';
                    shiftSession.checkInTime = timeStr;
                    shiftSession.punctuality = computePunctuality();
                    shiftSession.workingMinutes = 0;
                    shiftSession.breakMinutes = 0;
                    shiftSession.isCompleted = false;
                    punchLog.checkIn = now;
                    punchLog.breaks = [];
                    punchLog.breakStart = null;
                    punchLog.awayStart = null;
                } else if (action === 'Break') {
                    employeeAttendanceState.value = 'break';
                    punchLog.breakStart = now;
                } else if (action === 'Step Away') {
                    employeeAttendanceState.value = 'away';
                    punchLog.awayStart = now;
                } else if (action === 'Return Back') {
                    if (punchLog.breakStart) {
                        punchLog.breaks.push({ start: punchLog.breakStart, end: now });
                        punchLog.breakStart = null;
                    }
                    if (punchLog.awayStart) {
                        punchLog.breaks.push({ start: punchLog.awayStart, end: now });
                        punchLog.awayStart = null;
                    }
                    employeeAttendanceState.value = 'working';
                } else if (action === 'Check Out') {
                    if (punchLog.breakStart) { punchLog.breaks.push({ start: punchLog.breakStart, end: now }); punchLog.breakStart = null; }
                    if (punchLog.awayStart) { punchLog.breaks.push({ start: punchLog.awayStart, end: now }); punchLog.awayStart = null; }
                    const checkInMs = punchLog.checkIn || now;
                    let breakMs = 0;
                    if (Array.isArray(punchLog.breaks)) punchLog.breaks.forEach(b => { breakMs += (b.end - b.start); });
                    const workingMs = Math.max(0, now - checkInMs - breakMs);
                    // Store SECONDS for precision
                    shiftSession.workingSeconds = Math.floor(workingMs / 1000);
                    shiftSession.breakSeconds = Math.floor(breakMs / 1000);
                    shiftSession.workingMinutes = Math.floor(workingMs / 60000);
                    shiftSession.breakMinutes = Math.floor(breakMs / 60000);
                    shiftSession.checkOutTime = timeStr;
                    shiftSession.isCompleted = true;
                    employeeAttendanceState.value = 'checkedOut';
                }

                const myEmpId = currentUser.value ? String(currentUser.value.id) : 'guest';
                localStorage.setItem('ark_emp_punch_log_' + myEmpId, JSON.stringify(punchLog));
                localStorage.setItem('ark_emp_shift_' + myEmpId, JSON.stringify(shiftSession));
                localStorage.setItem('ark_emp_punch_log', JSON.stringify(punchLog));
                localStorage.setItem('ark_emp_shift', JSON.stringify(shiftSession));

                // ── Build audit detail string ──
                let auditDetail = '';
                if (action === 'Return Back') {
                    const lastBreak = punchLog.breaks && punchLog.breaks.length ? punchLog.breaks[punchLog.breaks.length - 1] : null;
                    if (lastBreak && lastBreak.end && lastBreak.start) {
                        const bSec = Math.floor((lastBreak.end - lastBreak.start) / 1000);
                        auditDetail = `Break deducted: ${formatSecondsHms(bSec)}`;
                    }
                } else if (action === 'Check Out') {
                    auditDetail = `Net Work: ${formatSecondsHms(shiftSession.workingSeconds || 0)} | Break: ${formatSecondsHms(shiftSession.breakSeconds || 0)}`;
                }

                if (action === 'Check Out') {
                    const todayRecord = {
                        date: `Today (${dateStr.slice(5)})`,
                        empName: currentUser.value ? currentUser.value.name : 'Employee',
                        checkIn: shiftSession.checkInTime || '—',
                        checkOut: timeStr,
                        breakDeducted: formatSecondsHms(shiftSession.breakSeconds || 0),
                        completed: formatSecondsHms(shiftSession.workingSeconds || 0),
                        completedHms: formatSecondsHms(shiftSession.workingSeconds || 0),
                        status: shiftSession.punctuality === 'Late Arrival' ? 'Late Arrival' : 'Completed',
                        onTime: shiftSession.punctuality !== 'Late Arrival'
                    };
                    const idx = mockWeeklyCheckIns.value.findIndex(i => i.date.includes('Today'));
                    if (idx !== -1) mockWeeklyCheckIns.value[idx] = todayRecord;
                    else mockWeeklyCheckIns.value.unshift(todayRecord);
                    localStorage.setItem('ark_emp_weekly_checkins_' + myEmpId, JSON.stringify(mockWeeklyCheckIns.value));
                    localStorage.setItem('ark_emp_weekly_checkins', JSON.stringify(mockWeeklyCheckIns.value));
                }

                const netHoursStr = action === 'Check Out'
                    ? formatSecondsHms(shiftSession.workingSeconds || 0)
                    : 'In Progress';

                timesheets.value.unshift({
                    id: `TS-LOCAL-${Date.now()}`,
                    empName: currentUser.value.name,
                    empId: currentUser.value.id,
                    action,
                    time: timeStr,
                    date: dateStr,
                    totalHours: netHoursStr,
                    breakDeducted: action === 'Return Back' ? auditDetail : (action === 'Check Out' ? formatSecondsHms(shiftSession.breakSeconds || 0) : '—'),
                    auditNote: auditDetail,
                    punctuality: shiftSession.punctuality || 'On Time'
                });

                const meEmp = employees.value.find(e => String(e.id) === String(currentUser.value.id));
                if (meEmp && meEmp.status !== 'On Leave') {
                    meEmp.status = employeeAttendanceState.value === 'working' ? 'Active'
                        : (employeeAttendanceState.value === 'break' || employeeAttendanceState.value === 'away') ? 'Away'
                        : employeeAttendanceState.value === 'checkedOut' ? 'Inactive' : meEmp.status;
                }
                persistState();

                const toastMsg = action === 'Check Out'
                    ? `Shift finalized! Net Work: ${formatSecondsHms(shiftSession.workingSeconds || 0)}`
                    : action === 'Return Back'
                        ? `${action} recorded. ${auditDetail}`
                        : `${action} recorded at ${timeStr}`;
                showToast(toastMsg, 'success');

                // Persist attendance punch to Supabase
                SupabaseService.recordAttendance({
                    id: `TS-${currentUser.value.id}-${Date.now()}`,
                    empId: currentUser.value.id,
                    empName: currentUser.value.name,
                    action, date: dateStr, time: timeStr,
                    totalHours: netHoursStr,
                    punctuality: shiftSession.punctuality || 'On Time'
                }).catch(() => {});
            }, 300);
        }



        // ── Comprehensive & Enterprise PDF Reports ────────────────────────────
        const reportDateMode = ref('month'); // 'month' or 'custom'
        const reportStartDate = ref(new Date().toISOString().slice(0, 10));
        const reportEndDate = ref(new Date().toISOString().slice(0, 10));
        const reportScope = ref('all'); // 'all', 'individual', 'subordinates'
        const reportSelectedEmpId = ref('');
        const reportMonth = ref((() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; })());
        const reportDossierEmpId = ref('');

        function matchesReportDate(dateStr) {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return false;
            if (reportDateMode.value === 'month') {
                const [yr, mo] = reportMonth.value.split('-').map(Number);
                return d.getFullYear() === yr && (d.getMonth() + 1) === mo;
            } else {
                const start = reportStartDate.value ? new Date(reportStartDate.value) : new Date(0);
                const end = reportEndDate.value ? new Date(reportEndDate.value + 'T23:59:59') : new Date();
                return d >= start && d <= end;
            }
        }

        function matchesReportEmployee(empId) {
            const sId = String(empId);
            if (reportScope.value === 'individual') {
                return reportSelectedEmpId.value && sId === String(reportSelectedEmpId.value);
            } else if (reportScope.value === 'subordinates' && isUserManager.value) {
                const subIds = userSubordinates.value.map(s => String(s.id));
                return subIds.includes(sId) || (currentUser.value && sId === String(currentUser.value.id));
            } else {
                return true;
            }
        }

        function exportAttendancePDF() {
            showLoading('Generating Comprehensive Attendance Report PDF...');
            setTimeout(() => {
                try {
                    const { jsPDF } = window.jspdf || {};
                    if (!jsPDF) {
                        hideLoading();
                        showToast('PDF generator is initializing. Please retry.', 'info');
                        return;
                    }
                    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

                    let periodLabel = '';
                    if (reportDateMode.value === 'month') {
                        const [yr, mo] = reportMonth.value.split('-').map(Number);
                        periodLabel = new Date(yr, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
                    } else {
                        periodLabel = `${reportStartDate.value || 'Start'} to ${reportEndDate.value || 'End'}`;
                    }

                    const filtered = timesheets.value.filter(t => matchesReportDate(t.date) && matchesReportEmployee(t.empId));
                    const targetList = filtered;
                    const totalLogs = targetList.length;
                    const onTimeCount = targetList.filter(t => t.punctuality !== 'Late Arrival').length;
                    const lateCount = targetList.filter(t => t.punctuality === 'Late Arrival').length;
                    const onTimePct = totalLogs > 0 ? Math.round((onTimeCount / totalLogs) * 100) : 100;

                    // Brand Navy Header
                    doc.setFillColor(12, 26, 75);
                    doc.rect(0, 0, 842, 60, 'F');

                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(16);
                    doc.text('ARK SHIPPING LINE', 32, 28);

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(197, 220, 254);
                    doc.text('HUMAN RESOURCES MANAGEMENT SYSTEM · COMPREHENSIVE ATTENDANCE AUDIT', 32, 45);

                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`PERIOD: ${periodLabel.toUpperCase()}`, 810, 36, { align: 'right' });

                    // Section Heading
                    doc.setTextColor(30, 41, 59);
                    doc.setFontSize(13);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Detailed Shift Check-In / Out Record (${reportScope.value === 'individual' ? 'Individual Employee' : reportScope.value === 'subordinates' ? 'Team / Subordinates' : 'All Employees'})`, 32, 86);

                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Generated: ${new Date().toLocaleString()} (NJ Time) · Certified by: ${currentUser.value ? currentUser.value.name : 'Administrator'} · ARK HR Compliance`, 32, 100);

                    // 4 KPI Summary Cards
                    const drawCard = (x, y, w, h, title, val, color) => {
                        doc.setFillColor(248, 250, 252);
                        doc.setDrawColor(226, 232, 240);
                        doc.roundedRect(x, y, w, h, 6, 6, 'FD');
                        doc.setFontSize(7.5);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(100, 116, 139);
                        doc.text(title.toUpperCase(), x + 10, y + 16);
                        doc.setFontSize(13);
                        doc.setTextColor(...color);
                        doc.text(String(val), x + 10, y + 36);
                    };

                    drawCard(32, 112, 178, 46, 'Total Events Recorded', totalLogs, [37, 99, 235]);
                    drawCard(224, 112, 178, 46, 'Punctuality Compliance', `${onTimePct}%`, [16, 185, 129]);
                    drawCard(416, 112, 178, 46, 'Late Arrivals Recorded', lateCount, [225, 29, 72]);
                    drawCard(608, 112, 202, 46, 'Scope / Target', reportScope.value === 'individual' ? (employees.value.find(e=>String(e.id)===String(reportSelectedEmpId.value))?.name || 'Selected') : 'Organization-Wide', [124, 58, 237]);

                    // Group/Merge attendance events into 1 row per employee shift/day (Check-In & Check-Out side by side)
                    const shiftMap = {};
                    targetList.forEach(t => {
                        const key = `${t.empId}_${t.date}`;
                        if (!shiftMap[key]) {
                            shiftMap[key] = {
                                date: t.date || '—',
                                empId: t.empId || '—',
                                empName: t.empName || '—',
                                dept: t.dept || (employees.value.find(e => String(e.id) === String(t.empId))?.dept) || 'Operations',
                                checkIn: '—',
                                checkOut: '—',
                                totalHours: t.totalHours || '—',
                                punctuality: t.punctuality || 'On Time'
                            };
                        }
                        const act = String(t.action || '').toLowerCase();
                        if (act.includes('in')) {
                            shiftMap[key].checkIn = t.time || '—';
                        } else if (act.includes('out')) {
                            shiftMap[key].checkOut = t.time || '—';
                            if (t.totalHours) shiftMap[key].totalHours = t.totalHours;
                            if (t.punctuality) shiftMap[key].punctuality = t.punctuality;
                        } else {
                            if (shiftMap[key].checkIn === '—') shiftMap[key].checkIn = t.time || '—';
                            else shiftMap[key].checkOut = t.time || '—';
                        }
                    });

                    const rows = Object.values(shiftMap).map(s => [
                        s.date,
                        s.empId,
                        s.empName,
                        s.dept,
                        s.checkIn,
                        s.checkOut,
                        s.totalHours,
                        s.punctuality
                    ]);

                    doc.autoTable({
                        startY: 170,
                        head: [['Date', 'Emp ID', 'Employee Name', 'Department', 'Check-In Time', 'Check-Out Time', 'Shift Hours', 'Punctuality']],
                        body: rows.length ? rows : [['—', '—', 'No attendance records found for criteria', '—', '—', '—', '—', '—']],
                        theme: 'striped',
                        headStyles: { fillColor: [12, 26, 75], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
                        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
                        alternateRowStyles: { fillColor: [248, 250, 252] },
                        columnStyles: { 7: { fontStyle: 'bold' } },
                        didParseCell: function(data) {
                            if (data.section === 'body' && data.column.index === 7) {
                                if (data.cell.raw === 'Late Arrival') data.cell.styles.textColor = [225, 29, 72];
                                else data.cell.styles.textColor = [16, 185, 129];
                            }
                        },
                        margin: { left: 32, right: 32 }
                    });

                    // Footers on all pages
                    const pageCount = doc.internal.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                        doc.setPage(i);
                        doc.setDrawColor(226, 232, 240);
                        doc.line(32, 560, 810, 560);
                        doc.setFontSize(7.5);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(148, 163, 184);
                        doc.text('ARK SHIPPING LINE · CONFIDENTIAL HRMS ENTERPRISE RECORD · CERTIFIED INTERNAL AUDIT', 32, 574);
                        doc.text(`Page ${i} of ${pageCount}`, 810, 574, { align: 'right' });
                    }

                    doc.save(`ARK_Attendance_Report_${periodLabel.replace(/\s+/g, '_')}.pdf`);
                    showToast('Comprehensive Attendance Report exported successfully!', 'success');
                } catch (err) {
                    console.error('[exportAttendancePDF]', err);
                    showToast('PDF Export Error: ' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            }, 300);
        }

        function exportLeavesPDF() {
            showLoading('Generating Comprehensive Leaves Audit PDF...');
            setTimeout(() => {
                try {
                    const { jsPDF } = window.jspdf || {};
                    if (!jsPDF) {
                        hideLoading();
                        showToast('PDF generator is initializing. Please retry.', 'info');
                        return;
                    }
                    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

                    let periodLabel = '';
                    if (reportDateMode.value === 'month') {
                        const [yr, mo] = reportMonth.value.split('-').map(Number);
                        periodLabel = new Date(yr, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
                    } else {
                        periodLabel = `${reportStartDate.value || 'Start'} to ${reportEndDate.value || 'End'}`;
                    }

                    const filteredLeaves = leaves.value.filter(l => matchesReportDate(l.from) && matchesReportEmployee(l.empId));
                    const totalReqs = filteredLeaves.length;
                    const approvedCount = filteredLeaves.filter(l => l.status === 'Approved').length;
                    const pendingCount = filteredLeaves.filter(l => l.status === 'Pending' || l.status === 'ManagerApproved').length;
                    const rejectedCount = filteredLeaves.filter(l => l.status === 'Rejected').length;

                    // Brand Navy Header
                    doc.setFillColor(12, 26, 75);
                    doc.rect(0, 0, 842, 60, 'F');

                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(16);
                    doc.text('ARK SHIPPING LINE', 32, 28);

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(197, 220, 254);
                    doc.text('HUMAN RESOURCES MANAGEMENT SYSTEM · LEAVE GOVERNANCE & APPROVALS AUDIT', 32, 45);

                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`PERIOD: ${periodLabel.toUpperCase()}`, 810, 36, { align: 'right' });

                    // Section Heading
                    doc.setTextColor(30, 41, 59);
                    doc.setFontSize(13);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Detailed Leave Requests, Multi-Level Workflow & Decisions Dossier', 32, 86);

                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Generated: ${new Date().toLocaleString()} (NJ Time) · Authorized: ${currentUser.value ? currentUser.value.name : 'Administrator'}`, 32, 100);

                    // Summary KPI Cards
                    const drawCard = (x, y, w, h, title, val, color) => {
                        doc.setFillColor(248, 250, 252);
                        doc.setDrawColor(226, 232, 240);
                        doc.roundedRect(x, y, w, h, 6, 6, 'FD');
                        doc.setFontSize(7.5);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(100, 116, 139);
                        doc.text(title.toUpperCase(), x + 10, y + 16);
                        doc.setFontSize(13);
                        doc.setTextColor(...color);
                        doc.text(String(val), x + 10, y + 36);
                    };

                    drawCard(32, 112, 178, 46, 'Filtered Leave Requests', totalReqs, [37, 99, 235]);
                    drawCard(224, 112, 178, 46, 'Fully Approved', approvedCount, [16, 185, 129]);
                    drawCard(416, 112, 178, 46, 'In Approval Queue', pendingCount, [245, 158, 11]);
                    drawCard(608, 112, 202, 46, 'Rejected Requests', rejectedCount, [225, 29, 72]);

                    const rows = filteredLeaves.map(l => [
                        l.id || '—',
                        l.empId || '—',
                        l.empName || '—',
                        l.type || 'Annual',
                        `${formatDateNice(l.from)} to ${formatDateNice(l.to)}`,
                        `${l.days} d`,
                        (l.reason || '—').slice(0, 35),
                        l.managerDecision ? `${l.managerDecision} (${l.managerName || 'Mgr'})` : 'Awaiting Review',
                        l.adminDecision ? `${l.adminDecision} (${l.adminName || 'Admin'})` : (l.status === 'ManagerApproved' ? 'Pending Final Admin' : 'Pending'),
                        l.status || 'Pending'
                    ]);

                    doc.autoTable({
                        startY: 170,
                        head: [['Req ID', 'ID', 'Employee', 'Type', 'Period', 'Days', 'Reason', '1st Level (Mgr)', '2nd Level (Admin)', 'Status']],
                        body: rows.length ? rows : [['—', '—', 'No leave records found for criteria', '—', '—', '—', '—', '—', '—', '—']],
                        theme: 'striped',
                        headStyles: { fillColor: [12, 26, 75], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3.5, textColor: [30, 41, 59] },
                        alternateRowStyles: { fillColor: [248, 250, 252] },
                        columnStyles: { 9: { fontStyle: 'bold' } },
                        didParseCell: function(data) {
                            if (data.section === 'body' && data.column.index === 9) {
                                if (data.cell.raw === 'Approved') data.cell.styles.textColor = [16, 185, 129];
                                else if (data.cell.raw === 'Rejected') data.cell.styles.textColor = [225, 29, 72];
                                else data.cell.styles.textColor = [217, 119, 6];
                            }
                        },
                        margin: { left: 32, right: 32 }
                    });

                    const pageCount = doc.internal.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                        doc.setPage(i);
                        doc.setDrawColor(226, 232, 240);
                        doc.line(32, 560, 810, 560);
                        doc.setFontSize(7.5);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(148, 163, 184);
                        doc.text('ARK SHIPPING LINE · CONFIDENTIAL HRMS ENTERPRISE RECORD · CERTIFIED INTERNAL AUDIT', 32, 574);
                        doc.text(`Page ${i} of ${pageCount}`, 810, 574, { align: 'right' });
                    }

                    doc.save(`ARK_Leaves_Audit_Report_${periodLabel.replace(/\s+/g, '_')}.pdf`);
                    showToast('Comprehensive Leaves Audit PDF exported successfully!', 'success');
                } catch (err) {
                    console.error('[exportLeavesPDF]', err);
                    showToast('PDF Export Error: ' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            }, 300);
        }

        // ── Employee Self-Service Report State & Export ─────────────────────
        const myReportDateMode = ref('month');
        const myReportStartDate = ref(new Date().toISOString().slice(0, 10));
        const myReportEndDate = ref(new Date().toISOString().slice(0, 10));
        const myReportMonth = ref((() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; })());
        const myReportType = ref('attendance'); // 'attendance' or 'leaves'

        function exportMyReportPDF() {
            if (!currentUser.value) return;
            reportDateMode.value = myReportDateMode.value;
            reportStartDate.value = myReportStartDate.value;
            reportEndDate.value = myReportEndDate.value;
            reportMonth.value = myReportMonth.value;
            reportScope.value = 'individual';
            reportSelectedEmpId.value = currentUser.value.id;

            if (myReportType.value === 'leaves') {
                exportLeavesPDF();
            } else {
                exportAttendancePDF();
            }
        }

        // ── Manager Team Report State & Export ──────────────────────────────
        const mgrReportDateMode = ref('month');
        const mgrReportStartDate = ref(new Date().toISOString().slice(0, 10));
        const mgrReportEndDate = ref(new Date().toISOString().slice(0, 10));
        const mgrReportMonth = ref((() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; })());
        const mgrReportSubId = ref('all'); // 'all' or specific empId
        const mgrReportType = ref('attendance'); // 'attendance' or 'leaves'

        function exportManagerTeamPDF() {
            if (!isUserManager.value) {
                showToast('Manager access required', 'error');
                return;
            }
            reportDateMode.value = mgrReportDateMode.value;
            reportStartDate.value = mgrReportStartDate.value;
            reportEndDate.value = mgrReportEndDate.value;
            reportMonth.value = mgrReportMonth.value;

            if (mgrReportSubId.value === 'all') {
                reportScope.value = 'subordinates';
            } else {
                reportScope.value = 'individual';
                reportSelectedEmpId.value = mgrReportSubId.value;
            }

            if (mgrReportType.value === 'leaves') {
                exportLeavesPDF();
            } else {
                exportAttendancePDF();
            }
        }

        function exportRosterPDF() {
            showLoading('Generating Workforce Roster PDF...');
            setTimeout(() => {
                try {
                    const { jsPDF } = window.jspdf || {};
                    if (!jsPDF) {
                        hideLoading();
                        showToast('PDF generator is initializing. Please retry.', 'info');
                        return;
                    }
                    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

                    // Brand Navy Header
                    doc.setFillColor(12, 26, 75);
                    doc.rect(0, 0, 595, 60, 'F');

                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(15);
                    doc.text('ARK SHIPPING LINE', 32, 28);

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8.5);
                    doc.setTextColor(197, 220, 254);
                    doc.text('OFFICIAL WORKFORCE ROSTER & ORGANIZATIONAL DIRECTORY', 32, 45);

                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${employees.value.length} TOTAL EMPLOYEES`, 563, 36, { align: 'right' });

                    doc.setTextColor(30, 41, 59);
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Active Personnel & Departmental Hierarchy', 32, 84);

                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Generated: ${new Date().toLocaleString()} (NJ Time) · Super Admin Verified`, 32, 97);

                    const rows = employees.value.map(e => [
                        e.id || '—',
                        e.name || '—',
                        e.dept || 'Operations',
                        e.role || 'Staff',
                        e.email || '—',
                        getEmployeeManagerName(e.id),
                        e.status || 'Active'
                    ]);

                    doc.autoTable({
                        startY: 110,
                        head: [['ID', 'Full Name', 'Department', 'Job Title', 'Email Address', 'Reports To', 'Status']],
                        body: rows,
                        theme: 'striped',
                        headStyles: { fillColor: [12, 26, 75], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 4, textColor: [30, 41, 59] },
                        alternateRowStyles: { fillColor: [248, 250, 252] },
                        margin: { left: 32, right: 32 }
                    });

                    const pageCount = doc.internal.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                        doc.setPage(i);
                        doc.setDrawColor(226, 232, 240);
                        doc.line(32, 800, 563, 800);
                        doc.setFontSize(7);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(148, 163, 184);
                        doc.text('ARK SHIPPING LINE · CONFIDENTIAL ORGANIZATIONAL DIRECTORY', 32, 814);
                        doc.text(`Page ${i} of ${pageCount}`, 563, 814, { align: 'right' });
                    }

                    doc.save('ARK_Workforce_Roster.pdf');
                    showToast('Workforce Roster PDF exported!', 'success');
                } catch (err) {
                    console.error('[exportRosterPDF]', err);
                    showToast('PDF Export Error: ' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            }, 300);
        }

        function exportEmployeeDossierPDF(empId) {
            if (!empId) {
                showToast('Please select an employee first', 'info');
                return;
            }
            const emp = employees.value.find(e => String(e.id) === String(empId));
            if (!emp) {
                showToast('Employee not found', 'error');
                return;
            }

            showLoading(`Generating Dossier for ${emp.name}...`);
            setTimeout(() => {
                try {
                    const { jsPDF } = window.jspdf || {};
                    if (!jsPDF) {
                        hideLoading();
                        showToast('PDF generator is initializing. Please retry.', 'info');
                        return;
                    }
                    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

                    // Header
                    doc.setFillColor(12, 26, 75);
                    doc.rect(0, 0, 595, 60, 'F');

                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(15);
                    doc.text('ARK SHIPPING LINE', 32, 28);

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8.5);
                    doc.setTextColor(197, 220, 254);
                    doc.text('INDIVIDUAL EMPLOYEE PERFORMANCE & ATTENDANCE DOSSIER', 32, 45);

                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`EMP ID: ${emp.id}`, 563, 36, { align: 'right' });

                    // Employee Profile Box
                    doc.setFillColor(248, 250, 252);
                    doc.setDrawColor(226, 232, 240);
                    doc.roundedRect(32, 75, 531, 95, 6, 6, 'FD');

                    doc.setFontSize(14);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(15, 23, 42);
                    doc.text(emp.name, 48, 98);

                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(100, 116, 139);
                    doc.text(`${emp.role || 'Staff'} · Department of ${emp.dept}`, 48, 112);

                    // Grid details
                    doc.setFontSize(8);
                    doc.setTextColor(71, 85, 105);
                    doc.text(`Official Email: ${emp.email}`, 48, 132);
                    doc.text(`Reporting Manager: ${getEmployeeManagerName(emp.id)}`, 48, 146);
                    doc.text(`Date of Joining: ${emp.joined || '15 Jan 2024'}`, 48, 160);

                    doc.text(`Status: ${emp.status || 'Active'}`, 330, 132);
                    doc.text(`Total Leave Days Used: ${emp.usedLeaveDays || 0} days`, 330, 146);
                    doc.text(`Annual Allocation: 24 days`, 330, 160);

                    // Timesheet records
                    const empTimesheets = timesheets.value.filter(t => String(t.empId) === String(emp.id));
                    const empLeaves = leaves.value.filter(l => String(l.empId) === String(emp.id));

                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(15, 23, 42);
                    doc.text('Recent Attendance & Shift Performance', 32, 190);

                    const tsRows = (empTimesheets.length ? empTimesheets : timesheets.value.slice(0, 6)).map(t => [
                        t.date || '—',
                        t.action || 'Shift',
                        t.time || '—',
                        t.totalHours || '09h 45m',
                        t.punctuality || 'On Time'
                    ]);

                    doc.autoTable({
                        startY: 198,
                        head: [['Date', 'Action', 'Time', 'Duration Logged', 'Punctuality']],
                        body: tsRows,
                        theme: 'striped',
                        headStyles: { fillColor: [12, 26, 75], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3.5 },
                        alternateRowStyles: { fillColor: [248, 250, 252] },
                        margin: { left: 32, right: 32 }
                    });

                    let nextY = doc.lastAutoTable.finalY + 22;
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(15, 23, 42);
                    doc.text('Leave Applications & Approval Audit Trail', 32, nextY);

                    const lvRows = empLeaves.map(l => [
                        l.id || '—',
                        l.type || 'Annual',
                        `${formatDateNice(l.from)} to ${formatDateNice(l.to)}`,
                        `${l.days}d`,
                        (l.reason || '—').slice(0, 30),
                        l.managerDecision ? `${l.managerDecision} (${l.managerName || 'Mgr'})` : '—',
                        l.status || 'Pending'
                    ]);

                    doc.autoTable({
                        startY: nextY + 8,
                        head: [['Leave ID', 'Type', 'Period', 'Days', 'Reason', 'Manager Action', 'Final Status']],
                        body: lvRows.length ? lvRows : [['—', 'No recorded leaves', '—', '0', 'None', '—', 'Normal']],
                        theme: 'striped',
                        headStyles: { fillColor: [12, 26, 75], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3.5 },
                        alternateRowStyles: { fillColor: [248, 250, 252] },
                        margin: { left: 32, right: 32 }
                    });

                    // Footer
                    const pageCount = doc.internal.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                        doc.setPage(i);
                        doc.setDrawColor(226, 232, 240);
                        doc.line(32, 800, 563, 800);
                        doc.setFontSize(7);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(148, 163, 184);
                        doc.text(`ARK SHIPPING LINE · OFFICIAL DOSSIER · EMP: ${emp.name} (${emp.id})`, 32, 814);
                        doc.text(`Page ${i} of ${pageCount}`, 563, 814, { align: 'right' });
                    }

                    doc.save(`ARK_Dossier_${emp.name.replace(/\s+/g, '_')}_${emp.id}.pdf`);
                    showToast(`Dossier PDF generated for ${emp.name}!`, 'success');
                } catch (err) {
                    console.error('[exportEmployeeDossierPDF]', err);
                    showToast('PDF Export Error: ' + err.message, 'error');
                } finally {
                    hideLoading();
                }
            }, 300);
        }

        // ── Monthly Roster & Progress ─────────────────────────────────────────
        const monthlyRosterData = computed(() => {
            const [yr, mo] = selectedRosterMonth.value.split('-').map(Number);
            const empId = selectedRosterEmpId.value === 'my'
                ? (currentUser.value ? String(currentUser.value.id) : null)
                : selectedRosterEmpId.value;

            const totalDays = new Date(yr, mo, 0).getDate(); // days in month
            const rows = [];
            let workDays = 0;
            let restDays = 0;
            let completedWorkSec = 0;

            // Build per-day data
            const dayMap = {}; // date string -> checkout timesheet
            if (empId) {
                timesheets.value
                    .filter(t => String(t.empId) === String(empId) && t.action === 'Check Out' && t.date && t.date.startsWith(`${yr}-${pad2(mo)}`))
                    .forEach(t => { dayMap[t.date] = t; });
            }

            for (let d = 1; d <= totalDays; d++) {
                const dateObj = new Date(yr, mo - 1, d);
                const dow = dateObj.getDay(); // 0=Sun, 6=Sat
                const isRest = (dow === 0 || dow === 6);
                const dateStr = `${yr}-${pad2(mo)}-${pad2(d)}`;
                const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                if (isRest) {
                    restDays++;
                    rows.push({ day: d, dateStr, dayLabel, isRest: true, status: 'Rest Day', checkIn: '—', checkOut: '—', netWork: '—', breakTime: '—', complete: false });
                } else {
                    workDays++;
                    const ts = dayMap[dateStr];
                    if (ts) {
                        // Parse seconds from totalHours string (e.g. "8h 30m 10s" or "8h 30m")
                        let sec = 0;
                        const hMatch = (ts.totalHours || '').match(/(\d+)h/);
                        const mMatch = (ts.totalHours || '').match(/(\d+)m/);
                        const sMatch = (ts.totalHours || '').match(/(\d+)s/);
                        if (hMatch) sec += parseInt(hMatch[1]) * 3600;
                        if (mMatch) sec += parseInt(mMatch[1]) * 60;
                        if (sMatch) sec += parseInt(sMatch[1]);
                        completedWorkSec += sec;
                        rows.push({ day: d, dateStr, dayLabel, isRest: false, status: 'Done', checkIn: ts.time || '—', checkOut: ts.time || '—', netWork: ts.totalHours || '—', breakTime: ts.breakDeducted || '—', complete: true });
                    } else {
                        // Future or absent
                        const today = new Date();
                        const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        const isToday = dateStr === getNJDateString();
                        rows.push({ day: d, dateStr, dayLabel, isRest: false, status: isToday ? 'Today' : isPast ? 'Absent' : 'Upcoming', checkIn: '—', checkOut: '—', netWork: '—', breakTime: '—', complete: false });
                    }
                }
            }

            const targetSec = workDays * TARGET_SHIFT_SECONDS;
            const remainSec = Math.max(0, targetSec - completedWorkSec);
            const progressPct = targetSec > 0 ? Math.min(100, Math.round((completedWorkSec / targetSec) * 100)) : 0;

            return {
                yr, mo, totalDays, workDays, restDays, rows,
                targetSec, completedWorkSec, remainSec, progressPct,
                targetFmt: formatSecondsHms(targetSec),
                completedFmt: formatSecondsHms(completedWorkSec),
                remainFmt: formatSecondsHms(remainSec)
            };
        });

        // Roster subordinate options
        const rosterEmpOptions = computed(() => {
            const opts = [{ value: 'my', label: 'My Attendance' }];
            if (currentRole.value === 'admin') {
                (employees.value || INITIAL_EMPLOYEES || []).forEach(e => opts.push({ value: String(e.id), label: e.name }));
            } else if (isUserManager.value) {
                (userSubordinates.value || []).forEach(e => opts.push({ value: String(e.id), label: e.name + ' (Sub)' }));
            }
            return opts;
        });

        // Roster subordinate leaves for manager view
        const rosterSelectedEmpLeaves = computed(() => {
            const empId = selectedRosterEmpId.value === 'my'
                ? (currentUser.value ? String(currentUser.value.id) : null)
                : selectedRosterEmpId.value;
            if (!empId) return [];
            const [yr, mo] = selectedRosterMonth.value.split('-'.trim()).map(Number);
            return (leaves.value || INITIAL_LEAVES || []).filter(l => {
                if (String(l.empId) !== empId) return false;
                if (!l.from) return false;
                const d = new Date(l.from);
                return d.getFullYear() === yr && (d.getMonth() + 1) === mo;
            });
        });



        async function saveSupabaseCredentials() {
            const url = String(supabaseUrl.value || '').trim();
            const key = String(supabaseKey.value || '').trim();
            if (!url || !key) {
                showToast('Please enter both Supabase URL and Anon Key', 'error');
                return;
            }
            localStorage.setItem('ark_supabase_url', url);
            localStorage.setItem('ark_supabase_key', key);
            SupabaseService.resetClient();
            showToast('Credentials saved — testing connection…', 'info');
            await testSupabaseConnection();
        }

        async function testSupabaseConnection() {
            if (!SupabaseService.isConfigured()) {
                showToast('Enter Supabase URL & Key first', 'error');
                return;
            }
            showLoading('Testing Supabase connection…');
            const result = await SupabaseService.testConnection();
            hideLoading();
            if (result.success) {
                supabaseConnected.value = true;
                showToast('✅ Supabase connected! Syncing data…', 'success');
                await syncFromSupabase();
            } else {
                supabaseConnected.value = false;
                showToast('❌ Connection failed: ' + (result.error || 'unknown error'), 'error');
            }
        }

        function downloadJsonBackup() {
            const data = { employees: employees.value, leaves: leaves.value, timesheets: timesheets.value, departments: departments.value };
            const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const dl = document.createElement('a');
            dl.setAttribute("href", jsonStr);
            dl.setAttribute("download", `ARK_HRMS_Backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(dl); dl.click(); document.body.removeChild(dl);
            showToast('Backup downloaded!', 'success');
        }

        function resetWorkspaceData() {
            if (confirm("Reset all local workspace data to fresh initial defaults?")) {
                localStorage.clear();
                location.reload();
            }
        }

        // ── Monthly PER (Performance Evaluation & Rating) System ───────────
        const performanceRatings = ref([]);
        watch(performanceRatings, () => localStorage.setItem('ark_performance_ratings', JSON.stringify(performanceRatings.value)), { deep: true });

        const currentEvalMonth = computed(() => getNJDateString().slice(0, 7)); // 'YYYY-MM' e.g. '2026-09'

        const pendingRatings = computed(() => {
            try {
                if (!currentUser.value) return [];
                const monthKey = currentEvalMonth.value;
                let targetList = [];

                if (currentRole.value === 'admin') {
                    targetList = (employees.value || INITIAL_EMPLOYEES || []).filter(e => e && String(e.id) !== '1');
                } else if (isUserManager.value) {
                    targetList = userSubordinates.value || [];
                } else {
                    return [];
                }

                const ratings = performanceRatings.value || [];
                return targetList.filter(e => {
                    return e && !ratings.some(r => r && String(r.empId) === String(e.id) && r.month === monthKey && String(r.raterId) === String(currentUser.value.id));
                });
            } catch (e) {
                return [];
            }
        });

        const evalRatingForm = reactive({});

        function openEvalModal() {
            pendingRatings.value.forEach(e => {
                if (!evalRatingForm[e.id]) {
                    evalRatingForm[e.id] = { rating: 5, feedback: '' };
                }
            });
            modals.evalPopup = true;
        }

        function submitEmployeeRating(empId) {
            const emp = employees.value.find(e => String(e.id) === String(empId));
            if (!emp) return;
            const form = evalRatingForm[empId] || { rating: 5, feedback: 'Good performance' };
            const monthKey = currentEvalMonth.value;

            const existingIdx = performanceRatings.value.findIndex(r => String(r.empId) === String(empId) && r.month === monthKey && String(r.raterId) === String(currentUser.value.id));
            const newRecord = {
                id: 'PER-' + Date.now(),
                empId: String(emp.id),
                empName: emp.name,
                raterId: String(currentUser.value.id),
                raterName: currentUser.value.name,
                month: monthKey,
                rating: Number(form.rating) || 5,
                feedback: String(form.feedback || '').trim() || 'Good performance',
                date: getNJDateString()
            };

            if (existingIdx >= 0) {
                performanceRatings.value[existingIdx] = newRecord;
            } else {
                performanceRatings.value.unshift(newRecord);
            }
            persistState();
            showToast(`Submitted ${form.rating} ★ PER rating for ${emp.name}`, 'success');

            if (pendingRatings.value.length === 0) {
                modals.evalPopup = false;
            }
        }

        // Dynamic Top Performers derived from PER ratings & punctuality
        const topPerformers = computed(() => {
            const ratings = performanceRatings.value || [];
            const ts = timesheets.value || [];
            if (ratings.length === 0 && ts.length === 0) return [];

            return (employees.value || INITIAL_EMPLOYEES || [])
                .filter(e => e && e.status !== 'Inactive')
                .map(e => {
                    const empRatings = ratings.filter(r => r && String(r.empId) === String(e.id));
                    let avgRating = 4.5;
                    if (empRatings.length > 0) {
                        avgRating = empRatings.reduce((s, r) => s + Number(r.rating || 5), 0) / empRatings.length;
                    }
                    const empTs = ts.filter(t => t && String(t.empId) === String(e.id));
                    let punctualityPct = 100;
                    if (empTs.length > 0) {
                        const onTime = empTs.filter(t => t.punctuality !== 'Late Arrival').length;
                        punctualityPct = Math.round((onTime / empTs.length) * 100);
                    }
                    const scorePct = Math.min(100, Math.round((avgRating / 5) * 80 + (punctualityPct / 100) * 20));

                    return {
                        id: e.id,
                        name: e.name,
                        dept: e.dept,
                        avatar: e.avatar,
                        avgRating: Math.round(avgRating * 10) / 10,
                        scorePct
                    };
                })
                .sort((a, b) => b.scorePct - a.scorePct)
                .slice(0, 5);
        });

        function renderAllCharts() {
            if (currentRole.value === 'admin') {
                ChartManager.renderWeeklyTrend('chart-admin-weekly-trend', timesheets.value, employees.value, isDarkMode.value);
                ChartManager.renderPresenceDonut('chart-admin-presence-donut', employees.value, isDarkMode.value);
                ChartManager.renderDeptHeadcount('chart-dept-headcount', departmentList.value, employees.value, isDarkMode.value);
                ChartManager.renderLeaveTypes('chart-leave-types', 'leave-type-legend', leaves.value, isDarkMode.value);
                ChartManager.renderAttPunctuality('chart-att-punctuality', 'donut-att-ontime', timesheets.value, isDarkMode.value);
                ChartManager.renderAttHours('chart-att-hours', timesheets.value, isDarkMode.value);
                ChartManager.renderMonthlyAttendance('chart-monthly-attendance', timesheets.value, employees.value, isDarkMode.value);
            }
        }

        // Lifecycle Hooks
        onMounted(() => {
            if (isDarkMode.value) {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
            }
            updateClocks();
            clockTimer = setInterval(updateClocks, 1000);

            // Clean up any duplicates on startup
            leaves.value = sanitizeLeavesList(leaves.value);
            persistState();

            // Fetch daily inspirational quote for workforce
            fetchDailyQuote();

            const session = localStorage.getItem('ark_session');
            if (session) {
                try {
                    currentUser.value = JSON.parse(session);
                    // Load user's scoped shift and punch state
                    loadUserShiftState(currentUser.value ? currentUser.value.id : null);
                    syncFromSupabase(true);
                    nextTick(() => { renderAllCharts(); });
                } catch (e) {
                    localStorage.removeItem('ark_session');
                }
            }

            // Auto prompt monthly PER evaluation modal if ratings are pending for Admin/Manager
            setTimeout(() => {
                if ((currentRole.value === 'admin' || isUserManager.value) && pendingRatings.value.length > 0) {
                    openEvalModal();
                }
            }, 1200);

            // ── Cross-tab session sync ───────────────────────────────────────
            // If another tab logs in or out, reload this tab to get a clean state
            window._arkStorageHandler = (e) => {
                if (e.key === 'ark_session') {
                    // Session changed in another tab → force a clean reload
                    window.location.reload();
                }
            };
            window.addEventListener('storage', window._arkStorageHandler);
        });

        onUnmounted(() => {
            if (clockTimer) clearInterval(clockTimer);
            if (window._arkStorageHandler) {
                window.removeEventListener('storage', window._arkStorageHandler);
            }
        });


        return {
            isDarkMode, njClock, currentUser, currentRole, adminTab, empTab, showNotifDropdown,
            supabaseUrl, supabaseKey, supabaseConnected,
            employees, leaves, timesheets, departments, notifications, employeeAttendanceState,
            shiftSession, punchLog, mockWeeklyCheckIns, toast, loading, skeletonLoading, modals,
            loginForm, empForm, leaveForm, deptForm, profileForm, viewedEmployeeId, empFilter, leaveFilterStatus,
            avatarList: AVATARS, customAvatarUrl, setCustomAvatarUrl, isAvatarImage,
            departmentList, departmentOverview, filteredEmployees, adminPendingLeavesCount,
            pendingLeavesOverview, filteredAdminLeaves, mySubmittedLeaves, isUserManager,
            adminStatsAwaitingAdmin, adminStatsAwaitingMgr, adminStatsApproved, adminStatsRejected,
            userSubordinates, userReportingManager, managerSubordinateLeaves, managerSubordinatePendingCount,
            userNotifications, isUserOnApprovedLeave, empActionHint, empStatusPillText, empStatusPillClasses,
            shiftProgress, liveShiftMetrics, viewedEmployee, viewedEmployeeTimesheets, viewedEmployeeLeaves, topPerformers,
            isSubmittingLeave, liveNow, selectedRosterMonth, selectedRosterEmpId, rosterViewMode, availableMonths,
            monthlyRosterData, rosterEmpOptions, rosterSelectedEmpLeaves, reportMonth, reportDossierEmpId,
            reportDateMode, reportStartDate, reportEndDate, reportScope, reportSelectedEmpId,
            myReportDateMode, myReportStartDate, myReportEndDate, myReportMonth, myReportType,
            mgrReportDateMode, mgrReportStartDate, mgrReportEndDate, mgrReportMonth, mgrReportSubId, mgrReportType,
            dailyQuote, fetchDailyQuote,
            toggleDarkMode, handleLogin, logout, switchAdminNav, switchEmpTab,
            syncFromSupabase, saveSupabaseCredentials, testSupabaseConnection, downloadJsonBackup, resetWorkspaceData,
            openAddEmployeeModal, editEmployee, saveEmployeeSubmit, deleteEmployeePrompt,
            openEmployeeProfileModal, openAvatarPicker, selectAvatar, openEditProfileModal, saveProfileInfo,
            openAddDepartmentModal, saveDepartmentSubmit, adminFinalDecide, managerDecideLeave,
            openApplyLeaveModal, submitApplyLeave, empPunchAction, isPunchDisabled,
            adminLeaveForm, openAdminAddLeaveModal, submitAdminAddLeave, clearTestRecords,
            exportAttendancePDF, exportLeavesPDF, exportRosterPDF, exportEmployeeDossierPDF,
            exportManagerTeamPDF, exportMyReportPDF,
            performanceRatings, pendingRatings, currentEvalMonth, evalRatingForm, openEvalModal, submitEmployeeRating,
            openChangePasswordModal, submitChangePassword, openAnnouncementsModal, postAnnouncement, deleteAnnouncement,
            clearNotifications,
            announcementsList, announcementForm, passwordForm, showToast,
            getBadgeClasses, formatDateNice, getLeaveAuditBadge, isManager, getEmployeeManager, getEmployeeManagerName,
            canAdminDecideLeave, formatSecondsHms, formatSecondsPretty, pad2
        };
    }
});

app.mount('#app');