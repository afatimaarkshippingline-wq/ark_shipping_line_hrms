/**
 * ARK HRMS · Vue 3 Application Controller
 * ARK Shipping Line
 */

const { createApp, ref, reactive, computed, onMounted, onUnmounted, nextTick } = Vue;

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

        // Core Collections with Local Storage Cache
        const employees = ref(JSON.parse(localStorage.getItem('ark_employees')) || INITIAL_EMPLOYEES.map(e => ({ ...e })));
        const leaves = ref(JSON.parse(localStorage.getItem('ark_leaves')) || (typeof INITIAL_LEAVES !== 'undefined' ? INITIAL_LEAVES.map(l => ({ ...l })) : []));
        const timesheets = ref(JSON.parse(localStorage.getItem('ark_timesheets')) || (typeof INITIAL_TIMESHEETS !== 'undefined' ? INITIAL_TIMESHEETS.map(t => ({ ...t })) : []));
        const departments = ref(JSON.parse(localStorage.getItem('ark_departments') || '[]'));
        const notifications = ref(JSON.parse(localStorage.getItem('ark_notifications') || '[]'));

        // Employee Shift Session & Punch Log
        const employeeAttendanceState = ref('out');
        const shiftSession = reactive(JSON.parse(localStorage.getItem('ark_emp_shift') || 'null') || {
            checkInTime: '', checkOutTime: '', breakMinutes: 0, workingMinutes: 0, workingSeconds: 0, breakSeconds: 0, isCompleted: false, punctuality: 'On Time'
        });
        const punchLog = reactive(JSON.parse(localStorage.getItem('ark_emp_punch_log') || 'null') || {});
        const mockWeeklyCheckIns = ref(JSON.parse(localStorage.getItem('ark_emp_weekly_checkins') || '[]'));

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

        // Modals State
        const modals = reactive({
            employee: false,
            applyLeave: false,
            department: false,
            avatar: false,
            editProfile: false,
            viewProfile: false
        });

        // Form Models
        const loginForm = reactive({ empId: '', password: '', showPassword: false });
        const empForm = reactive({ id: '', name: '', email: '', dept: 'Accounts', role: '', status: 'Active', managerId: '', password: '' });
        const leaveForm = reactive({ type: 'Annual Leave', from: '', to: '', reason: '' });
        const deptForm = reactive({ name: '', headId: '', headName: '', budget: '' });
        const profileForm = reactive({ name: '', email: '', role: '' });
        const viewedEmployeeId = ref(null);

        // Filter Models
        const empFilter = reactive({ search: '', dept: 'All', status: 'All' });
        const leaveFilterStatus = ref('All');

        // State Persistence
        function persistState() {
            try {
                localStorage.setItem('ark_employees', JSON.stringify(employees.value));
                localStorage.setItem('ark_leaves', JSON.stringify(leaves.value));
                localStorage.setItem('ark_timesheets', JSON.stringify(timesheets.value));
                localStorage.setItem('ark_departments', JSON.stringify(departments.value));
                localStorage.setItem('ark_notifications', JSON.stringify(notifications.value));
            } catch (e) {}
        }

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
                    const remoteLeaves = d.leaves.map(l => ({ ...l, empId: String(l.empId) }));
                    const localOnly = leaves.value.filter(l => String(l.id).startsWith('LV-LOCAL-'));
                    leaves.value = [...localOnly, ...remoteLeaves];
                }

                if (Array.isArray(d.attendance)) {
                    const remoteTs = d.attendance.map(a => ({
                        id: a.id, empId: String(a.empId), empName: a.empName || '',
                        action: a.action || '', time: a.time || '', date: a.date || '',
                        totalHours: a.totalHours || '', punctuality: a.punctuality || 'On Time'
                    }));
                    const localOnly = timesheets.value.filter(t => String(t.id).startsWith('TS-LOCAL-'));
                    timesheets.value = [...localOnly, ...remoteTs];
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

        function onLoginSuccess() {
            showToast(`Welcome back, ${currentUser.value.name}!`, 'success');
            loginForm.empId = '';
            loginForm.password = '';
            syncFromSupabase(true); // silent background sync
            nextTick(() => {
                if (currentRole.value === 'admin') renderAllCharts();
            });
        }

        function setDemoLogin(id, pass) {
            loginForm.empId = id;
            loginForm.password = pass;
            handleLogin();
        }

        function logout() {
            currentUser.value = null;
            localStorage.removeItem('ark_session');
            sessionStorage.clear();
            showToast('Signed out successfully', 'info');
        }

        // Navigation
        function switchAdminNav(sec) {
            adminTab.value = sec;
            nextTick(() => {
                if (sec === 'overview') {
                    ChartManager.renderWeeklyTrend('chart-admin-weekly-trend', isDarkMode.value);
                    ChartManager.renderPresenceDonut('chart-admin-presence-donut', employees.value, isDarkMode.value);
                    ChartManager.renderDeptHeadcount('chart-dept-headcount', departmentList.value, employees.value, isDarkMode.value);
                    ChartManager.renderLeaveTypes('chart-leave-types', 'leave-type-legend', leaves.value, isDarkMode.value);
                } else if (sec === 'attendance') {
                    ChartManager.renderAttPunctuality('chart-att-punctuality', 'donut-att-ontime', timesheets.value, isDarkMode.value);
                    ChartManager.renderAttHours('chart-att-hours', timesheets.value, isDarkMode.value);
                } else if (sec === 'reports') {
                    ChartManager.renderMonthlyAttendance('chart-monthly-attendance', isDarkMode.value);
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
            return employees.value.filter(e => {
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
            return leaves.value.filter(l => canAdminDecideLeave(l)).length;
        });

        const pendingLeavesOverview = computed(() => {
            return leaves.value.filter(l => l.status === 'Pending' || l.status === 'ManagerApproved').slice(0, 5);
        });

        const filteredAdminLeaves = computed(() => {
            if (leaveFilterStatus.value === 'All') return leaves.value;
            return leaves.value.filter(l => l.status === leaveFilterStatus.value);
        });

        const mySubmittedLeaves = computed(() => {
            if (!currentUser.value) return [];
            return leaves.value.filter(l => String(l.empId) === String(currentUser.value.id));
        });

        const isUserManager = computed(() => {
            if (!currentUser.value) return false;
            const r = (currentUser.value.designation || currentUser.value.role || '').toLowerCase();
            if (r.includes('manager') || r.includes('lead') || r.includes('supervisor') || r.includes('head')) return true;
            return isManager(currentUser.value.id);
        });

        const userSubordinates = computed(() => {
            if (!currentUser.value) return [];
            const myId = String(currentUser.value.id);
            const myEmp = employees.value.find(e => String(e.id) === myId);
            const myDept = myEmp?.dept || currentUser.value.dept;
            return employees.value.filter(e => {
                if (String(e.id) === myId) return false;
                if (String(e.managerId) === myId) return true;
                if (isUserManager.value && e.dept === myDept && !isManager(e.id)) return true;
                return false;
            });
        });

        const userReportingManager = computed(() => {
            if (!currentUser.value) return { name: 'Super Administrator', role: 'Executive', dept: 'Executive', avatar: '👨‍💼', email: 'admin@ark.com' };
            const m = currentUser.value.managerId ? employees.value.find(e => String(e.id) === String(currentUser.value.managerId)) : null;
            if (m) return { name: m.name, role: m.role || 'Manager', dept: m.dept || 'Executive', avatar: m.avatar || '👨‍💼', email: m.email };
            return { name: 'Super Administrator', role: 'Super Administrator', dept: 'Executive / HR', avatar: '👨‍💼', email: 'admin@ark.com' };
        });

        const managerSubordinateLeaves = computed(() => {
            if (!currentUser.value || !isUserManager.value) return [];
            const myId = String(currentUser.value.id);
            const myEmp = employees.value.find(e => String(e.id) === myId);
            const myDept = myEmp?.dept || currentUser.value.dept;
            const subIds = new Set(userSubordinates.value.map(s => String(s.id)));

            return leaves.value.filter(l => {
                // Never show manager's own leave requests in subordinate queue
                if (String(l.empId) === myId) return false;
                // Direct match by managerId
                if (String(l.managerId) === myId) return true;
                // Subordinate direct id match
                if (subIds.has(String(l.empId))) return true;
                // Manager name match
                if (currentUser.value.name && l.managerName && l.managerName.toLowerCase() === currentUser.value.name.toLowerCase()) return true;
                // Match by employee record in current employees list
                const applicant = employees.value.find(e => String(e.id) === String(l.empId));
                if (applicant) {
                    if (String(applicant.managerId) === myId) return true;
                    if (applicant.dept === myDept && !isManager(applicant.id) && (!l.managerId || String(l.managerId) === '1' || String(l.managerId) === myId)) {
                        return true;
                    }
                }
                return false;
            });
        });

        const managerSubordinatePendingCount = computed(() => {
            return managerSubordinateLeaves.value.filter(l => l.status === 'Pending').length;
        });

        const userNotifications = computed(() => {
            if (!currentUser.value) return [];
            return notifications.value.filter(n => !n.targetEmpId || String(n.targetEmpId) === String(currentUser.value.id) || currentUser.value.role === 'admin');
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
            const emp = employees.value.find(e => String(e.id) === String(empId));
            if (emp) {
                const r = (emp.role || emp.designation || '').toLowerCase();
                if (r.includes('manager') || r.includes('lead') || r.includes('supervisor') || r.includes('head')) return true;
            }
            return employees.value.some(e => String(e.managerId) === String(empId));
        }

        function getEmployeeManager(empId) {
            const emp = employees.value.find(e => String(e.id) === String(empId));
            if (!emp || !emp.managerId || String(emp.managerId) === '1' || String(emp.managerId) === String(empId)) return null;
            return employees.value.find(e => String(e.id) === String(emp.managerId)) || null;
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
                    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]
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
            return timesheets.value.filter(t => String(t.empId) === String(viewedEmployeeId.value));
        });

        const viewedEmployeeLeaves = computed(() => {
            if (!viewedEmployeeId.value) return [];
            return leaves.value.filter(l => String(l.empId) === String(viewedEmployeeId.value));
        });

        function openAvatarPicker() { modals.avatar = true; }
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

        function exportAttendanceCSV() {
            let csv = "Name,ID,Action,Time,Date,Net Hours,Break Deducted,Audit Note,Punctuality\n";
            timesheets.value.forEach(t => { csv += `"${t.empName}","${t.empId}","${t.action}","${t.time}","${t.date}","${t.totalHours}","${t.breakDeducted || ''}","${t.auditNote || ''}","${t.punctuality}"\n`; });
            downloadCSVFile(csv, "ARK_Timesheet.csv");
        }

        function exportFullDataCSV() {
            let csv = "ID,Name,Email,Dept,Role,Status,Joined\n";
            employees.value.forEach(e => { csv += `"${e.id}","${e.name}","${e.email}","${e.dept}","${e.role || ''}","${e.status}","${e.joined || ''}"\n`; });
            downloadCSVFile(csv, "ARK_Roster.csv");
        }

        // ── Monthly Reports ──────────────────────────────────────────────────
        const selectedReportMonth = ref(() => {
            const d = new Date();
            return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
        });
        // Initialize as plain string:
        const reportMonth = ref((() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; })());

        function exportMonthlyLeavesCSV() {
            const [yr, mo] = reportMonth.value.split('-').map(Number);
            const filtered = leaves.value.filter(l => {
                if (!l.from) return false;
                const d = new Date(l.from);
                return d.getFullYear() === yr && (d.getMonth() + 1) === mo;
            });
            let csv = "Employee,ID,Leave Type,From,To,Days,Status,Manager Decision,Admin Decision,Reason\n";
            filtered.forEach(l => {
                csv += `"${l.empName}","${l.empId}","${l.type}","${l.from}","${l.to}","${l.days || ''}","${l.status}","${l.managerDecision || ''}","${l.adminDecision || ''}","${(l.reason || '').replace(/"/g, "'")}"\n`;
            });
            const moLabel = new Date(yr, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
            downloadCSVFile(csv, `ARK_Leaves_Report_${moLabel.replace(' ', '_')}.csv`);
        }

        function exportMonthlyHoursCSV() {
            const [yr, mo] = reportMonth.value.split('-').map(Number);
            const filtered = timesheets.value.filter(t => {
                if (!t.date) return false;
                const d = new Date(t.date);
                return d.getFullYear() === yr && (d.getMonth() + 1) === mo;
            });
            let csv = "Employee,ID,Action,Time,Date,Net Hours,Break Deducted,Audit Note,Punctuality\n";
            filtered.forEach(t => {
                csv += `"${t.empName}","${t.empId}","${t.action}","${t.time}","${t.date}","${t.totalHours}","${t.breakDeducted || ''}","${t.auditNote || ''}","${t.punctuality}"\n`;
            });
            const moLabel = new Date(yr, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
            downloadCSVFile(csv, `ARK_Hours_Report_${moLabel.replace(' ', '_')}.csv`);
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
                employees.value.forEach(e => opts.push({ value: String(e.id), label: e.name }));
            } else if (isUserManager.value) {
                userSubordinates.value.forEach(e => opts.push({ value: String(e.id), label: e.name + ' (Sub)' }));
            }
            return opts;
        });

        // Roster subordinate leaves for manager view
        const rosterSelectedEmpLeaves = computed(() => {
            const empId = selectedRosterEmpId.value === 'my'
                ? (currentUser.value ? String(currentUser.value.id) : null)
                : selectedRosterEmpId.value;
            if (!empId) return [];
            const [yr, mo] = selectedRosterMonth.value.split('-').map(Number);
            return leaves.value.filter(l => {
                if (String(l.empId) !== empId) return false;
                if (!l.from) return false;
                const d = new Date(l.from);
                return d.getFullYear() === yr && (d.getMonth() + 1) === mo;
            });
        });

        function downloadCSVFile(content, fileName) {
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.setAttribute("href", URL.createObjectURL(blob));
            link.setAttribute("download", fileName);
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            showToast('CSV exported!', 'success');
        }

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

        const topPerformers = computed(() => {
            return [...employees.value].filter(e => e.status !== 'On Leave').slice(0, 5);
        });

        function renderAllCharts() {
            if (currentRole.value === 'admin') {
                ChartManager.renderWeeklyTrend('chart-admin-weekly-trend', isDarkMode.value);
                ChartManager.renderPresenceDonut('chart-admin-presence-donut', employees.value, isDarkMode.value);
                ChartManager.renderDeptHeadcount('chart-dept-headcount', departmentList.value, employees.value, isDarkMode.value);
                ChartManager.renderLeaveTypes('chart-leave-types', 'leave-type-legend', leaves.value, isDarkMode.value);
                ChartManager.renderAttPunctuality('chart-att-punctuality', 'donut-att-ontime', timesheets.value, isDarkMode.value);
                ChartManager.renderAttHours('chart-att-hours', timesheets.value, isDarkMode.value);
                ChartManager.renderMonthlyAttendance('chart-monthly-attendance', isDarkMode.value);
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

            const session = localStorage.getItem('ark_session');
            if (session) {
                try {
                    currentUser.value = JSON.parse(session);
                    syncFromSupabase(true);
                    nextTick(() => { renderAllCharts(); });
                } catch (e) {
                    localStorage.removeItem('ark_session');
                }
            }
        });

        onUnmounted(() => {
            if (clockTimer) clearInterval(clockTimer);
        });

        return {
            isDarkMode, njClock, currentUser, currentRole, adminTab, empTab, showNotifDropdown,
            supabaseUrl, supabaseKey, supabaseConnected,
            employees, leaves, timesheets, departments, notifications, employeeAttendanceState,
            shiftSession, punchLog, mockWeeklyCheckIns, toast, loading, skeletonLoading, modals,
            loginForm, empForm, leaveForm, deptForm, profileForm, viewedEmployeeId, empFilter, leaveFilterStatus,
            avatarList: AVATARS,
            departmentList, departmentOverview, filteredEmployees, adminPendingLeavesCount,
            pendingLeavesOverview, filteredAdminLeaves, mySubmittedLeaves, isUserManager,
            userSubordinates, userReportingManager, managerSubordinateLeaves, managerSubordinatePendingCount,
            userNotifications, isUserOnApprovedLeave, empActionHint, empStatusPillText, empStatusPillClasses,
            shiftProgress, liveShiftMetrics, viewedEmployee, viewedEmployeeTimesheets, viewedEmployeeLeaves, topPerformers,
            isSubmittingLeave, liveNow, selectedRosterMonth, selectedRosterEmpId, rosterViewMode, availableMonths,
            monthlyRosterData, rosterEmpOptions, rosterSelectedEmpLeaves, reportMonth,
            toggleDarkMode, handleLogin, setDemoLogin, logout, switchAdminNav, switchEmpTab,
            syncFromSupabase, saveSupabaseCredentials, testSupabaseConnection, downloadJsonBackup, resetWorkspaceData,
            openAddEmployeeModal, editEmployee, saveEmployeeSubmit, deleteEmployeePrompt,
            openEmployeeProfileModal, openAvatarPicker, selectAvatar, openEditProfileModal, saveProfileInfo,
            openAddDepartmentModal, saveDepartmentSubmit, adminFinalDecide, managerDecideLeave,
            openApplyLeaveModal, submitApplyLeave, empPunchAction, isPunchDisabled,
            exportAttendanceCSV, exportFullDataCSV, exportMonthlyLeavesCSV, exportMonthlyHoursCSV, clearNotifications,
            getBadgeClasses, formatDateNice, getLeaveAuditBadge, isManager, getEmployeeManager, getEmployeeManagerName,
            canAdminDecideLeave, formatSecondsHms, formatSecondsPretty, pad2
        };
    }
});

app.mount('#app');

