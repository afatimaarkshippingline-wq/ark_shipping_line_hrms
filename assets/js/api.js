/**
 * ARK HRMS · Supabase API Service Layer
 * ARK Shipping Line
 *
 * All data operations go through this module.
 * If Supabase credentials are missing/offline, every method returns a
 * { success: false, error: 'Local mode', local: true } envelope so
 * app.js can gracefully fall back to localStorage.
 */

const SupabaseService = (() => {

    // ------------------------------------------------------------------
    // Client Management
    // ------------------------------------------------------------------

    let _client = null;

    function _getClient() {
        const url = localStorage.getItem('ark_supabase_url') || CONFIG.DEFAULT_SUPABASE_URL;
        const key = localStorage.getItem('ark_supabase_key') || CONFIG.DEFAULT_SUPABASE_ANON_KEY;
        if (!url || !key) return null;
        if (_client) return _client;
        try {
            // supabase-js v2 is loaded via CDN as window.supabase
            _client = supabase.createClient(url, key);
            return _client;
        } catch (e) {
            console.warn('[SupabaseService] createClient failed:', e);
            return null;
        }
    }

    /** Force re-initialise (call after credentials change) */
    function resetClient() {
        _client = null;
        _getClient();
    }

    function isConfigured() {
        const url = localStorage.getItem('ark_supabase_url') || CONFIG.DEFAULT_SUPABASE_URL;
        const key = localStorage.getItem('ark_supabase_key') || CONFIG.DEFAULT_SUPABASE_ANON_KEY;
        return !!(url && key);
    }

    // Shared error envelope
    function _localFallback(reason = 'Not configured') {
        return { success: false, error: reason, local: true };
    }

    // ------------------------------------------------------------------
    // Test Connection
    // ------------------------------------------------------------------

    async function testConnection() {
        const db = _getClient();
        if (!db) return { success: false, error: 'Credentials not set', local: true };
        try {
            const { error } = await db.from('employees').select('id').limit(1);
            if (error) throw error;
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // ------------------------------------------------------------------
    // Authentication (local check against employees table)
    // ------------------------------------------------------------------

    async function login(empId, password) {
        const db = _getClient();
        if (!db) return _localFallback();

        try {
            // Admin check (id = '1')
            if (String(empId) === '1') {
                const { data, error } = await db
                    .from('employees')
                    .select('*')
                    .eq('id', '1')
                    .single();
                if (error) throw error;
                if (data && data.password === password) {
                    return {
                        success: true,
                        data: {
                            user: {
                                id: '1', name: data.name, email: data.email,
                                role: 'admin', dept: data.dept,
                                designation: data.role, avatar: data.avatar || '👨‍💼',
                                managerId: ''
                            }
                        }
                    };
                }
                return { success: false, error: 'Invalid credentials' };
            }

            // Regular employee
            const { data, error } = await db
                .from('employees')
                .select('*')
                .eq('id', String(empId))
                .single();
            if (error) throw error;
            if (!data) return { success: false, error: 'Employee not found' };
            if (data.password !== password) return { success: false, error: 'Incorrect password' };

            return {
                success: true,
                data: {
                    user: {
                        id: data.id, name: data.name, email: data.email,
                        role: 'employee', dept: data.dept,
                        designation: data.role, avatar: data.avatar || '👨‍💼',
                        managerId: data.manager_id || ''
                    }
                }
            };
        } catch (e) {
            console.warn('[SupabaseService.login]', e);
            return _localFallback(e.message);
        }
    }

    // ------------------------------------------------------------------
    // Employees
    // ------------------------------------------------------------------

    async function fetchEmployees() {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const { data, error } = await db
                .from('employees')
                .select('*')
                .order('id');
            if (error) throw error;
            // Normalise snake_case → camelCase for frontend compat
            const mapped = (data || []).map(e => ({
                id: String(e.id),
                name: e.name,
                email: e.email,
                password: e.password,
                dept: e.dept,
                role: e.role,
                status: e.status || 'Active',
                managerId: e.manager_id ? String(e.manager_id) : '',
                avatar: e.avatar || '👨‍💼',
                joined: e.joined || '',
                annualLeaveQuota: e.annual_leave_quota || 18,
                usedLeaveDays: e.used_leave_days || 0
            }));
            return { success: true, data: mapped };
        } catch (e) {
            console.warn('[SupabaseService.fetchEmployees]', e);
            return _localFallback(e.message);
        }
    }

    async function saveEmployee(employee) {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const row = {
                id: String(employee.id),
                name: employee.name,
                email: employee.email,
                password: employee.password || '123456',
                dept: employee.dept,
                role: employee.role,
                status: employee.status || 'Active',
                manager_id: employee.managerId ? String(employee.managerId) : null,
                avatar: employee.avatar || '👨‍💼',
                joined: employee.joined || '',
                annual_leave_quota: employee.annualLeaveQuota || 18,
                used_leave_days: employee.usedLeaveDays || 0,
                updated_at: new Date().toISOString()
            };
            const { error } = await db.from('employees').upsert(row, { onConflict: 'id' });
            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.warn('[SupabaseService.saveEmployee]', e);
            return _localFallback(e.message);
        }
    }

    async function deleteEmployee(empId) {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const { error } = await db.from('employees').delete().eq('id', String(empId));
            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.warn('[SupabaseService.deleteEmployee]', e);
            return _localFallback(e.message);
        }
    }

    // ------------------------------------------------------------------
    // Departments
    // ------------------------------------------------------------------

    async function fetchDepartments() {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const { data, error } = await db
                .from('departments')
                .select('*')
                .order('name');
            if (error) throw error;
            const mapped = (data || []).map(d => ({
                id: d.id,
                name: d.name,
                headId: d.head_id ? String(d.head_id) : '',
                headName: d.head_name || '',
                budget: d.budget || '$0'
            }));
            return { success: true, data: mapped };
        } catch (e) {
            console.warn('[SupabaseService.fetchDepartments]', e);
            return _localFallback(e.message);
        }
    }

    async function saveDepartment(dept) {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const row = {
                name: dept.name,
                head_id: dept.headId ? String(dept.headId) : null,
                head_name: dept.headName || '',
                budget: dept.budget || '$0'
            };
            if (dept.id) {
                const { error } = await db.from('departments').update(row).eq('id', dept.id);
                if (error) throw error;
            } else {
                const { error } = await db.from('departments').insert(row);
                if (error) throw error;
            }
            return { success: true };
        } catch (e) {
            console.warn('[SupabaseService.saveDepartment]', e);
            return _localFallback(e.message);
        }
    }

    // ------------------------------------------------------------------
    // Attendance / Timesheets
    // ------------------------------------------------------------------

    async function fetchAttendance(empId = null, limit = 200) {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            let q = db.from('attendance').select('*').order('created_at', { ascending: false }).limit(limit);
            if (empId) q = q.eq('emp_id', String(empId));
            const { data, error } = await q;
            if (error) throw error;
            const mapped = (data || []).map(a => ({
                id: a.id,
                empId: String(a.emp_id),
                empName: a.emp_name,
                action: a.action,
                date: a.date,
                time: a.time,
                totalHours: a.total_hours || '',
                punctuality: a.punctuality || 'On Time'
            }));
            return { success: true, data: mapped };
        } catch (e) {
            console.warn('[SupabaseService.fetchAttendance]', e);
            return _localFallback(e.message);
        }
    }

    async function recordAttendance(record) {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const row = {
                id: record.id,
                emp_id: String(record.empId),
                emp_name: record.empName,
                action: record.action,
                date: record.date,
                time: record.time,
                total_hours: record.totalHours || '',
                punctuality: record.punctuality || 'On Time',
                notes: record.notes || ''
            };
            const { error } = await db.from('attendance').upsert(row, { onConflict: 'id' });
            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.warn('[SupabaseService.recordAttendance]', e);
            return _localFallback(e.message);
        }
    }

    // ------------------------------------------------------------------
    // Leaves
    // ------------------------------------------------------------------

    async function fetchLeaves(empId = null, role = 'admin', limit = 300) {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            // Fetch leaves list for workflow (Managers require subordinate leaves, Admin requires all)
            const q = db.from('leaves').select('*').order('created_at', { ascending: false }).limit(limit);
            const { data, error } = await q;
            if (error) throw error;
            const mapped = (data || []).map(l => ({
                id: l.id,
                empId: String(l.emp_id),
                empName: l.emp_name,
                type: l.type,
                from: l.from_date,
                to: l.to_date,
                days: l.days,
                reason: l.reason || '',
                status: l.status || 'Pending',
                managerId: l.manager_id ? String(l.manager_id) : '',
                managerName: l.manager_name || '',
                managerDecision: l.manager_decision || '',
                managerAt: l.manager_at || '',
                managerNote: l.manager_note || '',
                adminId: l.admin_id ? String(l.admin_id) : '',
                adminName: l.admin_name || '',
                adminDecision: l.admin_decision || '',
                adminAt: l.admin_at || '',
                adminNote: l.admin_note || '',
                createdAt: l.created_at || ''
            }));
            return { success: true, data: mapped };
        } catch (e) {
            console.warn('[SupabaseService.fetchLeaves]', e);
            return _localFallback(e.message);
        }
    }

    async function applyLeave(leaveData) {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const row = {
                id: leaveData.id,
                emp_id: String(leaveData.empId),
                emp_name: leaveData.empName,
                type: leaveData.type,
                from_date: leaveData.from,
                to_date: leaveData.to,
                days: leaveData.days || 1,
                reason: leaveData.reason || '',
                status: leaveData.status || 'Pending',
                manager_id: leaveData.managerId ? String(leaveData.managerId) : null,
                manager_name: leaveData.managerName || null,
                manager_decision: leaveData.managerDecision || null
            };
            const { error } = await db.from('leaves').insert(row);
            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.warn('[SupabaseService.applyLeave]', e);
            return _localFallback(e.message);
        }
    }

    async function managerDecideLeave(leaveId, decision, managerId, managerName, note = '', dateStr = '') {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const newStatus = decision === 'Approved' ? 'ManagerApproved' : 'Rejected';
            const { error } = await db.from('leaves').update({
                status: newStatus,
                manager_decision: decision,
                manager_id: String(managerId),
                manager_name: managerName,
                manager_at: dateStr || new Date().toISOString().split('T')[0],
                manager_note: note
            }).eq('id', leaveId);
            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.warn('[SupabaseService.managerDecideLeave]', e);
            return _localFallback(e.message);
        }
    }

    async function adminDecideLeave(leaveId, decision, adminId, adminName, note = '', dateStr = '') {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const { error } = await db.from('leaves').update({
                status: decision === 'Approved' ? 'Approved' : 'Rejected',
                admin_decision: decision,
                admin_id: String(adminId),
                admin_name: adminName,
                admin_at: dateStr || new Date().toISOString().split('T')[0],
                admin_note: note
            }).eq('id', leaveId);
            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.warn('[SupabaseService.adminDecideLeave]', e);
            return _localFallback(e.message);
        }
    }

    // ------------------------------------------------------------------
    // Sync All (replaces old Google Sheets syncAll)
    // ------------------------------------------------------------------

    async function syncAll(requesterId = '', role = 'admin') {
        const db = _getClient();
        if (!db) return _localFallback();
        try {
            const [empRes, leaveRes, attRes, deptRes] = await Promise.all([
                fetchEmployees(),
                fetchLeaves(requesterId, role),
                fetchAttendance(role === 'employee' ? requesterId : null),
                fetchDepartments()
            ]);
            return {
                success: true,
                data: {
                    employees: empRes.success ? empRes.data : [],
                    leaves: leaveRes.success ? leaveRes.data : [],
                    attendance: attRes.success ? attRes.data : [],
                    departments: deptRes.success ? deptRes.data : []
                }
            };
        } catch (e) {
            console.warn('[SupabaseService.syncAll]', e);
            return _localFallback(e.message);
        }
    }

    // Public API
    return {
        resetClient,
        isConfigured,
        testConnection,
        login,
        syncAll,
        fetchEmployees,
        saveEmployee,
        deleteEmployee,
        fetchDepartments,
        saveDepartment,
        fetchAttendance,
        recordAttendance,
        fetchLeaves,
        applyLeave,
        managerDecideLeave,
        adminDecideLeave
    };

})();
