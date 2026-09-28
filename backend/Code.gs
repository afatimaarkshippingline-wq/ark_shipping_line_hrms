/**
 * ARK HRMS · Google Apps Script Backend
 * ARK Shipping Line
 *
 * SETUP STEPS:
 * 1. Create a new Google Spreadsheet named "ARK_HRMS_Data"
 * 2. Extensions → Apps Script
 * 3. Paste this file contents into Code.gs
 * 4. Run setup() once to seed initial data
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy Web App URL into Frontend → Settings → Webhook URL
 */

const SPREADSHEET_NAME = 'ARK_HRMS_Data';

const SHEETS = {
  EMPLOYEES: 'Employees',
  DEPARTMENTS: 'Departments',
  ATTENDANCE: 'Attendance',
  LEAVES: 'Leaves',
  AUDIT: 'AuditLog',
  SETTINGS: 'Settings'
};

const EMPLOYEE_HEADERS = [
  'id', 'name', 'email', 'password', 'dept', 'role', 'status',
  'managerId', 'avatar', 'joined', 'annualLeaveQuota', 'usedLeaveDays'
];

const DEPT_HEADERS = ['name', 'headId', 'headName', 'budget', 'createdAt'];

const ATTENDANCE_HEADERS = [
  'id', 'empId', 'empName', 'action', 'date', 'time',
  'timestamp', 'totalHours', 'punctuality', 'notes'
];

const LEAVE_HEADERS = [
  'id', 'empId', 'empName', 'type', 'from', 'to', 'days', 'reason',
  'status', 'managerId', 'managerName', 'managerDecision', 'managerAt', 'managerNote',
  'adminId', 'adminName', 'adminDecision', 'adminAt', 'adminNote', 'createdAt'
];

const AUDIT_HEADERS = ['id', 'actorId', 'actorName', 'action', 'target', 'detail', 'timestamp'];

const SETTINGS_HEADERS = ['key', 'value'];

// ─────────────────────────────────────────────
// Spreadsheet helpers
// ─────────────────────────────────────────────

function getOrCreateSpreadsheet_() {
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  return SpreadsheetApp.create(SPREADSHEET_NAME);
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1e40af')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureAllSheets_() {
  const ss = getOrCreateSpreadsheet_();
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() <= 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) { /* ignore */ }
  }
  getOrCreateSheet_(ss, SHEETS.EMPLOYEES, EMPLOYEE_HEADERS);
  getOrCreateSheet_(ss, SHEETS.DEPARTMENTS, DEPT_HEADERS);
  getOrCreateSheet_(ss, SHEETS.ATTENDANCE, ATTENDANCE_HEADERS);
  getOrCreateSheet_(ss, SHEETS.LEAVES, LEAVE_HEADERS);
  getOrCreateSheet_(ss, SHEETS.AUDIT, AUDIT_HEADERS);
  getOrCreateSheet_(ss, SHEETS.SETTINGS, SETTINGS_HEADERS);
  return ss;
}

function cleanVal_(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, TIMEZONE_NJ, 'yyyy-MM-dd');
  }
  let s = String(val).trim();
  if (s.indexOf('T') !== -1 && (s.indexOf('Z') !== -1 || s.indexOf('.000') !== -1)) {
    s = s.split('T')[0];
  }
  return s;
}

function sheetToObjects_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(String);
  return data.slice(1).filter(row => row[0] !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cleanVal_(row[i]); });
    return obj;
  });
}

function appendRow_(sheet, headers, obj) {
  const row = headers.map(h => (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '');
  sheet.appendRow(row);
}

function updateRowById_(sheet, headers, id, updates) {
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id');
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) {
      headers.forEach((h, c) => {
        if (updates[h] !== undefined) sheet.getRange(r + 1, c + 1).setValue(updates[h]);
      });
      return true;
    }
  }
  return false;
}

function deleteRowById_(sheet, headers, id) {
  const data = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id');
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][idCol]) === String(id)) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

const TIMEZONE_NJ = 'America/New_York';

function nowISO_() {
  return Utilities.formatDate(new Date(), TIMEZONE_NJ, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
}

function todayDate_() {
  return Utilities.formatDate(new Date(), TIMEZONE_NJ, 'yyyy-MM-dd');
}

function nowTime_() {
  return Utilities.formatDate(new Date(), TIMEZONE_NJ, 'HH:mm:ss');
}

function uid_(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok_(data) {
  return jsonOut_({ success: true, data: data });
}

function err_(message, code) {
  return jsonOut_({ success: false, error: message, code: code || 400 });
}

function logAudit_(actorId, actorName, action, target, detail) {
  try {
    const ss = ensureAllSheets_();
    const sheet = ss.getSheetByName(SHEETS.AUDIT);
    appendRow_(sheet, AUDIT_HEADERS, {
      id: uid_('AUD'),
      actorId: actorId || '',
      actorName: actorName || '',
      action: action || '',
      target: target || '',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail || {}),
      timestamp: nowISO_()
    });
  } catch (e) {
    Logger.log('Audit log failed: ' + e);
  }
}

// ─────────────────────────────────────────────
// Seed sample hierarchy (run once from editor)
// ─────────────────────────────────────────────

function seedSampleData() {
  const ss = ensureAllSheets_();
  const empSheet = ss.getSheetByName(SHEETS.EMPLOYEES);
  const deptSheet = ss.getSheetByName(SHEETS.DEPARTMENTS);

  if (empSheet.getLastRow() > 1) {
    empSheet.getRange(2, 1, empSheet.getLastRow() - 1, empSheet.getLastColumn()).clearContent();
  }
  if (deptSheet.getLastRow() > 1) {
    deptSheet.getRange(2, 1, deptSheet.getLastRow() - 1, deptSheet.getLastColumn()).clearContent();
  }

  const depts = [
    { name: 'Accounts', headId: '101', headName: 'Dara Janwary', budget: '', createdAt: nowISO_() },
    { name: 'Documentation', headId: '104', headName: 'Faraz Ud Din', budget: '', createdAt: nowISO_() },
    { name: 'Dispatch', headId: '107', headName: 'Maryam Siddiqui', budget: '', createdAt: nowISO_() },
    { name: 'Operations', headId: '110', headName: 'Iffrah Syed', budget: '', createdAt: nowISO_() },
    { name: 'HR', headId: '112', headName: 'Ayesha Fatima', budget: '', createdAt: nowISO_() }
  ];
  depts.forEach(d => appendRow_(deptSheet, DEPT_HEADERS, d));

  // Hierarchy:
  // 1 Admin
  //   101 Dara Janwary (Accounts) → 102 Samra, 103 Zeeshan
  //   104 Faraz Ud Din (Documentation) → 105 Rehab, 106 Ali
  //   107 Maryam Siddiqui (Dispatch) → 108 Shaema, 109 Hamid
  //   110 Iffrah Syed (Operations) → 111 Muhammad Hamiz
  //   112 Ayesha Fatima (HR)

  const employees = [
    { id: '1', name: 'Administrator', email: 'admin@ark.com', password: 'admin123', dept: 'HR', role: 'Super Administrator', status: 'Active', managerId: '', avatar: '👨‍💼', joined: '01 Jan 2023', annualLeaveQuota: 24, usedLeaveDays: 0 },
    { id: '101', name: 'Dara Janwary', email: 'dara.janwary@ark.com', password: '123456', dept: 'Accounts', role: 'Accounts Manager', status: 'Active', managerId: '1', avatar: '👨‍💼', joined: '15 Jan 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '102', name: 'Samra Farid', email: 'samra.farid@ark.com', password: '123456', dept: 'Accounts', role: 'Accounts Executive', status: 'Active', managerId: '101', avatar: '👩‍💼', joined: '20 Feb 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '103', name: 'Zeeshan Rashid', email: 'zeeshan.rashid@ark.com', password: '123456', dept: 'Accounts', role: 'Accounts Officer', status: 'Active', managerId: '101', avatar: '👨‍💻', joined: '10 Mar 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '104', name: 'Faraz Ud Din', email: 'faraz.uddin@ark.com', password: '123456', dept: 'Documentation', role: 'Documentation Manager', status: 'Active', managerId: '1', avatar: '👨‍💼', joined: '05 Jan 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '105', name: 'Rehab Zehra', email: 'rehab.zehra@ark.com', password: '123456', dept: 'Documentation', role: 'Documentation Officer', status: 'Active', managerId: '104', avatar: '👩‍💼', joined: '18 Feb 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '106', name: 'Ali Hussain', email: 'ali.hussain@ark.com', password: '123456', dept: 'Documentation', role: 'Documentation Executive', status: 'Active', managerId: '104', avatar: '👨‍💻', joined: '22 Mar 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '107', name: 'Maryam Siddiqui', email: 'maryam.siddiqui@ark.com', password: '123456', dept: 'Dispatch', role: 'Dispatch Manager', status: 'Active', managerId: '1', avatar: '👩‍💼', joined: '12 Jan 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '108', name: 'Shaema Hafeez', email: 'shaema.hafeez@ark.com', password: '123456', dept: 'Dispatch', role: 'Dispatch Officer', status: 'Active', managerId: '107', avatar: '👩‍💻', joined: '08 Feb 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '109', name: 'Hamid', email: 'hamid@ark.com', password: '123456', dept: 'Dispatch', role: 'Dispatch Executive', status: 'Active', managerId: '107', avatar: '👨‍💼', joined: '15 Mar 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '110', name: 'Iffrah Syed', email: 'iffrah.syed@ark.com', password: '123456', dept: 'Operations', role: 'Operations Manager', status: 'Active', managerId: '1', avatar: '👩‍💼', joined: '01 Feb 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '111', name: 'Muhammad Hamiz', email: 'muhammad.hamiz@ark.com', password: '123456', dept: 'Operations', role: 'Operations Executive', status: 'Active', managerId: '110', avatar: '👨‍💻', joined: '20 Mar 2024', annualLeaveQuota: 18, usedLeaveDays: 0 },
    { id: '112', name: 'Ayesha Fatima', email: 'ayesha.fatima@ark.com', password: '123456', dept: 'HR', role: 'HR Manager', status: 'Active', managerId: '1', avatar: '👩‍💼', joined: '10 Jan 2024', annualLeaveQuota: 18, usedLeaveDays: 0 }
  ];
  employees.forEach(e => appendRow_(empSheet, EMPLOYEE_HEADERS, e));

  logAudit_('SYSTEM', 'System', 'SEED', 'Employees+Departments', 'Real hierarchy seeded (numeric IDs)');
  Logger.log('Seed complete. Spreadsheet: ' + ss.getUrl());
  return ss.getUrl();
}

function authenticate_(empId, password) {
  const ss = ensureAllSheets_();
  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
  const id = String(empId || '').trim();
  const pass = String(password || '').trim();

  const user = employees.find(e => {
    const eid = String(e.id).trim();
    return eid === id || eid.toUpperCase() === id.toUpperCase();
  });
  if (!user) return null;

  const sheetPass = String(user.password == null ? '' : user.password).trim();
  if (sheetPass !== pass) return null;

  const uid = String(user.id).trim();
  return {
    id: uid,
    name: String(user.name || ''),
    email: String(user.email || ''),
    role: uid === '1' || String(user.role).toLowerCase().indexOf('admin') >= 0 ? 'admin' : 'employee',
    designation: String(user.role || ''),
    dept: String(user.dept || ''),
    managerId: user.managerId ? String(user.managerId).trim() : '',
    avatar: user.avatar || '👨‍💼',
    status: user.status || 'Active'
  };
}

// ─────────────────────────────────────────────
// Hierarchy helpers
// ─────────────────────────────────────────────

function getDirectReports_(managerId) {
  const ss = ensureAllSheets_();
  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
  return employees.filter(e => String(e.managerId) === String(managerId));
}

function getAllSubordinates_(managerId, employees) {
  const result = [];
  const queue = [String(managerId)];
  const seen = {};
  while (queue.length) {
    const mid = queue.shift();
    employees.forEach(e => {
      if (String(e.managerId) === mid && !seen[e.id]) {
        seen[e.id] = true;
        result.push(e);
        queue.push(String(e.id));
      }
    });
  }
  return result;
}

function isManagerOf_(managerId, empId) {
  const ss = ensureAllSheets_();
  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
  const subs = getAllSubordinates_(managerId, employees);
  return subs.some(e => String(e.id) === String(empId));
}

function isManager_(empId) {
  const ss = ensureAllSheets_();
  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
  return employees.some(e => String(e.managerId) === String(empId));
}

// ─────────────────────────────────────────────
// API Actions
// ─────────────────────────────────────────────

function action_init(payload) {
  const ss = ensureAllSheets_();
  return ok_({
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    sheets: ss.getSheets().map(s => s.getName())
  });
}

function action_login(payload) {
  const user = authenticate_(payload.empId, payload.password);
  if (!user) return err_('Invalid Employee ID or password', 401);
  logAudit_(user.id, user.name, 'LOGIN', user.id, 'Successful login');
  return ok_({ user: user });
}

function action_getEmployees(payload) {
  const ss = ensureAllSheets_();
  let employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
  employees = employees.map(e => {
    const copy = Object.assign({}, e);
    delete copy.password;
    return copy;
  });

  const requesterId = payload.requesterId;
  const role = payload.role;

  if (role === 'admin' || String(requesterId) === '1') {
    return ok_({ employees: employees });
  }

  if (requesterId) {
    const all = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
    const subs = getAllSubordinates_(requesterId, all);
    const self = all.find(e => String(e.id) === String(requesterId));
    const visible = [];
    if (self) { const s = Object.assign({}, self); delete s.password; visible.push(s); }
    subs.forEach(e => { const c = Object.assign({}, e); delete c.password; visible.push(c); });
    return ok_({ employees: visible });
  }

  return ok_({ employees: employees });
}

function action_getDepartments(payload) {
  const ss = ensureAllSheets_();
  const depts = sheetToObjects_(ss.getSheetByName(SHEETS.DEPARTMENTS));
  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
  const enriched = depts.map(d => {
    const count = employees.filter(e => e.dept === d.name).length;
    return Object.assign({}, d, { headcount: count });
  });
  return ok_({ departments: enriched });
}

function action_saveEmployee(payload) {
  const ss = ensureAllSheets_();
  const sheet = ss.getSheetByName(SHEETS.EMPLOYEES);
  const emp = payload.employee || {};
  if (!emp.name || !emp.email || !emp.dept) return err_('name, email, dept required');

  if (emp.id) {
    const updates = {
      name: emp.name,
      email: emp.email,
      dept: emp.dept,
      role: emp.role || '',
      status: emp.status || 'Active',
      managerId: emp.managerId || '',
      avatar: emp.avatar || '',
      annualLeaveQuota: emp.annualLeaveQuota || 18
    };
    if (emp.password) updates.password = emp.password;
    const ok = updateRowById_(sheet, EMPLOYEE_HEADERS, emp.id, updates);
    if (!ok) return err_('Employee not found');
    logAudit_(payload.actorId, payload.actorName, 'UPDATE_EMPLOYEE', emp.id, updates);
    return ok_({ id: emp.id, updated: true });
  }

  const all = sheetToObjects_(sheet);
  const nextNum = all.length + 1;
  const newId = emp.id || String(100 + nextNum);
  const row = {
    id: newId,
    name: emp.name,
    email: emp.email,
    password: emp.password || '123456',
    dept: emp.dept,
    role: emp.role || 'Staff Member',
    status: emp.status || 'Active',
    managerId: emp.managerId || '',
    avatar: emp.avatar || '👨‍💼',
    joined: emp.joined || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy'),
    annualLeaveQuota: emp.annualLeaveQuota || 18,
    usedLeaveDays: 0
  };
  appendRow_(sheet, EMPLOYEE_HEADERS, row);
  logAudit_(payload.actorId, payload.actorName, 'CREATE_EMPLOYEE', newId, row);
  return ok_({ id: newId, created: true });
}

function action_deleteEmployee(payload) {
  if (!payload.empId) return err_('empId required');
  const ss = ensureAllSheets_();
  const sheet = ss.getSheetByName(SHEETS.EMPLOYEES);
  const ok = deleteRowById_(sheet, EMPLOYEE_HEADERS, payload.empId);
  if (!ok) return err_('Employee not found');
  logAudit_(payload.actorId, payload.actorName, 'DELETE_EMPLOYEE', payload.empId, {});
  return ok_({ deleted: true });
}

function action_saveDepartment(payload) {
  const ss = ensureAllSheets_();
  const sheet = ss.getSheetByName(SHEETS.DEPARTMENTS);
  const d = payload.department || {};
  if (!d.name) return err_('name required');
  const existing = sheetToObjects_(sheet);
  const found = existing.find(x => x.name === d.name);
  if (found) {
    const data = sheet.getDataRange().getValues();
    for (let r = 1; r < data.length; r++) {
      if (data[r][0] === d.name) {
        if (d.headId !== undefined) sheet.getRange(r + 1, 2).setValue(d.headId);
        if (d.headName !== undefined) sheet.getRange(r + 1, 3).setValue(d.headName);
        if (d.budget !== undefined) sheet.getRange(r + 1, 4).setValue(d.budget);
        break;
      }
    }
    return ok_({ updated: true });
  }
  appendRow_(sheet, DEPT_HEADERS, {
    name: d.name,
    headId: d.headId || '',
    headName: d.headName || '',
    budget: d.budget || '',
    createdAt: nowISO_()
  });
  logAudit_(payload.actorId, payload.actorName, 'CREATE_DEPARTMENT', d.name, d);
  return ok_({ created: true });
}

/**
 * Attendance punch — Check In | Break | Step Away | Return Back | Check Out
 */
function action_attendance(payload) {
  const empId = payload.empId;
  const action = payload.type || payload.action;
  if (!empId || !action) return err_('empId and action required');

  const ss = ensureAllSheets_();
  const empSheet = ss.getSheetByName(SHEETS.EMPLOYEES);
  const employees = sheetToObjects_(empSheet);
  const emp = employees.find(e => String(e.id) === String(empId));
  if (!emp) return err_('Employee not found');

  const attSheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const record = {
    id: uid_('TS'),
    empId: emp.id,
    empName: emp.name,
    action: action,
    date: payload.date || todayDate_(),
    time: payload.time || nowTime_(),
    timestamp: nowISO_(),
    totalHours: payload.totalHours || '',
    punctuality: payload.punctuality || 'On Time',
    notes: payload.notes || ''
  };
  appendRow_(attSheet, ATTENDANCE_HEADERS, record);

  let newStatus = emp.status;
  if (action === 'Check In' || action === 'Return Back') newStatus = 'Active';
  else if (action === 'Break' || action === 'Step Away') newStatus = 'Away';
  else if (action === 'Check Out') newStatus = 'Inactive';
  updateRowById_(empSheet, EMPLOYEE_HEADERS, emp.id, { status: newStatus });

  logAudit_(emp.id, emp.name, 'ATTENDANCE', action, record);
  return ok_({ record: record, status: newStatus });
}

function action_getAttendance(payload) {
  const ss = ensureAllSheets_();
  let rows = sheetToObjects_(ss.getSheetByName(SHEETS.ATTENDANCE));

  if (payload.empId) rows = rows.filter(r => String(r.empId) === String(payload.empId));
  if (payload.date) rows = rows.filter(r => String(r.date) === String(payload.date));
  if (payload.fromDate) rows = rows.filter(r => String(r.date) >= String(payload.fromDate));
  if (payload.toDate) rows = rows.filter(r => String(r.date) <= String(payload.toDate));

  if (payload.requesterId && payload.role !== 'admin') {
    const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
    const subs = getAllSubordinates_(payload.requesterId, employees);
    const allowed = {};
    allowed[payload.requesterId] = true;
    subs.forEach(s => { allowed[s.id] = true; });
    rows = rows.filter(r => allowed[r.empId]);
  }

  rows.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return ok_({ attendance: rows });
}

/**
 * Leave apply → status = Pending (awaits Manager)
 * If applicant is a Manager → status = Pending (awaits Admin directly)
 */
function action_applyLeave(payload) {
  const empId = payload.empId;
  if (!empId || !payload.type || !payload.from || !payload.to) {
    return err_('empId, type, from, to required');
  }
  const ss = ensureAllSheets_();
  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
  const emp = employees.find(e => String(e.id) === String(empId));
  if (!emp) return err_('Employee not found');

  const cleanFrom = cleanVal_(payload.from);
  const cleanTo = cleanVal_(payload.to);

  const d1 = new Date(cleanFrom);
  const d2 = new Date(cleanTo);
  const days = payload.days || (Math.ceil(Math.abs(d2 - d1) / 86400000) + 1);

  const isManager = employees.some(e => String(e.managerId) === String(emp.id));
  const managerEmp = emp.managerId ? employees.find(e => String(e.id) === String(emp.managerId)) : null;

  const leave = {
    id: uid_('LV'),
    empId: emp.id,
    empName: emp.name,
    type: payload.type,
    from: cleanFrom,
    to: cleanTo,
    days: days,
    reason: payload.reason || '',
    status: 'Pending',
    managerId: emp.managerId || '',
    managerName: managerEmp ? managerEmp.name : '',
    managerDecision: isManager ? 'N/A (Manager level)' : '',
    managerAt: '',
    managerNote: '',
    adminId: '',
    adminName: '',
    adminDecision: '',
    adminAt: '',
    adminNote: '',
    createdAt: nowISO_()
  };

  appendRow_(ss.getSheetByName(SHEETS.LEAVES), LEAVE_HEADERS, leave);
  logAudit_(emp.id, emp.name, 'APPLY_LEAVE', leave.id, leave);
  return ok_({ leave: leave });
}

/**
 * Manager decides on leave
 */
function action_managerDecideLeave(payload) {
  const leaveId = payload.leaveId;
  const decision = payload.decision;
  const managerId = payload.managerId;
  if (!leaveId || !decision || !managerId) return err_('leaveId, decision, managerId required');

  const ss = ensureAllSheets_();
  const sheet = ss.getSheetByName(SHEETS.LEAVES);
  const leaves = sheetToObjects_(sheet);
  const leave = leaves.find(l => String(l.id) === String(leaveId));
  if (!leave) return err_('Leave not found');
  if (leave.status !== 'Pending') return err_('Leave is not pending manager review');

  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
  const isAdmin = String(managerId) === '1';
  if (!isAdmin && !isManagerOf_(managerId, leave.empId) && String(leave.managerId) !== String(managerId)) {
    return err_('Not authorized to decide this leave', 403);
  }

  const managerEmp = employees.find(e => String(e.id) === String(managerId));
  const managerName = payload.managerName || (managerEmp ? managerEmp.name : 'Manager');

  const updates = {
    managerId: managerId,
    managerName: managerName,
    managerDecision: decision,
    managerAt: nowISO_(),
    managerNote: payload.note || ''
  };

  if (decision === 'Rejected') {
    updates.status = 'Rejected';
  } else {
    updates.status = 'ManagerApproved';
  }

  updateRowById_(sheet, LEAVE_HEADERS, leaveId, updates);
  logAudit_(managerId, managerName, 'MANAGER_LEAVE_DECISION', leaveId, updates);
  return ok_({ leaveId: leaveId, status: updates.status, managerName: managerName });
}

/**
 * Admin final decision
 * Manager's own leave skips Manager stage (can go directly Pending → Approved)
 */
function action_adminDecideLeave(payload) {
  const leaveId = payload.leaveId;
  const decision = payload.decision;
  if (!leaveId || !decision) return err_('leaveId and decision required');

  const ss = ensureAllSheets_();
  const sheet = ss.getSheetByName(SHEETS.LEAVES);
  const leaves = sheetToObjects_(sheet);
  const leave = leaves.find(l => String(l.id) === String(leaveId));
  if (!leave) return err_('Leave not found');

  if (leave.status !== 'ManagerApproved' && leave.status !== 'Pending') {
    return err_('Leave is not awaiting admin approval');
  }

  // If subordinate's leave and still Pending → block admin (must wait for manager)
  if (leave.status === 'Pending') {
    const empIsManager = isManager_(leave.empId);
    if (!empIsManager) {
      return err_('This leave is still awaiting manager approval', 403);
    }
  }

  const adminId = payload.adminId || '1';
  const adminName = payload.adminName || 'Admin';

  const updates = {
    adminId: adminId,
    adminName: adminName,
    adminDecision: decision,
    adminAt: nowISO_(),
    adminNote: payload.note || '',
    status: decision === 'Approved' ? 'Approved' : 'Rejected'
  };

  updateRowById_(sheet, LEAVE_HEADERS, leaveId, updates);

  if (decision === 'Approved') {
    const empSheet = ss.getSheetByName(SHEETS.EMPLOYEES);
    updateRowById_(empSheet, EMPLOYEE_HEADERS, leave.empId, { status: 'On Leave' });
    const employees = sheetToObjects_(empSheet);
    const emp = employees.find(e => String(e.id) === String(leave.empId));
    if (emp) {
      const used = Number(emp.usedLeaveDays || 0) + Number(leave.days || 0);
      updateRowById_(empSheet, EMPLOYEE_HEADERS, leave.empId, { usedLeaveDays: used });
    }
  }

  logAudit_(adminId, adminName, 'ADMIN_LEAVE_DECISION', leaveId, updates);
  return ok_({ leaveId: leaveId, status: updates.status, adminName: adminName });
}

function action_getLeaves(payload) {
  const ss = ensureAllSheets_();
  let leaves = sheetToObjects_(ss.getSheetByName(SHEETS.LEAVES));

  if (payload.empId) leaves = leaves.filter(l => String(l.empId) === String(payload.empId));
  if (payload.status) leaves = leaves.filter(l => String(l.status) === String(payload.status));

  if (payload.requesterId && payload.role !== 'admin') {
    const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES));
    const subs = getAllSubordinates_(payload.requesterId, employees);
    const allowed = {};
    allowed[payload.requesterId] = true;
    subs.forEach(s => { allowed[s.id] = true; });
    leaves = leaves.filter(l => allowed[l.empId]);
  }

  leaves.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return ok_({ leaves: leaves });
}

function action_getHierarchy(payload) {
  const ss = ensureAllSheets_();
  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES)).map(e => {
    const c = Object.assign({}, e);
    delete c.password;
    return c;
  });
  const departments = sheetToObjects_(ss.getSheetByName(SHEETS.DEPARTMENTS));

  function buildNode(id) {
    const emp = employees.find(e => String(e.id) === String(id));
    if (!emp) return null;
    const children = employees
      .filter(e => String(e.managerId) === String(id))
      .map(c => buildNode(c.id))
      .filter(Boolean);
    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      dept: emp.dept,
      status: emp.status,
      avatar: emp.avatar,
      reports: children
    };
  }

  const root = buildNode('1') || { id: '1', name: 'Admin', reports: [] };
  return ok_({ hierarchy: root, departments: departments, employees: employees });
}

function action_syncAll(payload) {
  const ss = ensureAllSheets_();
  const employees = sheetToObjects_(ss.getSheetByName(SHEETS.EMPLOYEES)).map(e => {
    const c = Object.assign({}, e);
    delete c.password;
    return c;
  });
  return ok_({
    employees: employees,
    departments: sheetToObjects_(ss.getSheetByName(SHEETS.DEPARTMENTS)),
    leaves: sheetToObjects_(ss.getSheetByName(SHEETS.LEAVES)),
    attendance: sheetToObjects_(ss.getSheetByName(SHEETS.ATTENDANCE)).slice(-200)
  });
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

function handleRequest_(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else {
      payload = e.parameter || {};
    }

    const action = payload.action || e.parameter.action || 'init';

    const map = {
      init: action_init,
      login: action_login,
      getEmployees: action_getEmployees,
      getDepartments: action_getDepartments,
      saveEmployee: action_saveEmployee,
      deleteEmployee: action_deleteEmployee,
      saveDepartment: action_saveDepartment,
      attendance: action_attendance,
      getAttendance: action_getAttendance,
      applyLeave: action_applyLeave,
      managerDecideLeave: action_managerDecideLeave,
      adminDecideLeave: action_adminDecideLeave,
      getLeaves: action_getLeaves,
      getHierarchy: action_getHierarchy,
      syncAll: action_syncAll
    };

    const fn = map[action];
    if (!fn) return err_('Unknown action: ' + action);
    return fn(payload);
  } catch (err) {
    Logger.log(err);
    return err_(String(err.message || err), 500);
  }
}

function doGet(e) {
  return handleRequest_(e || { parameter: {} });
}

function doPost(e) {
  return handleRequest_(e || {});
}

/**
 * One-time setup: run this from the Apps Script editor
 */
function setup() {
  const url = seedSampleData();
  Logger.log('Spreadsheet URL: ' + url);
  Logger.log('Now Deploy as Web App and paste the URL into the frontend.');
}