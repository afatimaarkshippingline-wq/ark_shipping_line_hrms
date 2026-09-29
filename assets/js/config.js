/**
 * ARK HRMS · Configuration & Initial Seed Data
 * ARK Shipping Line
 */

const CONFIG = {
    // Supabase configuration — paste your own credentials in Admin → Settings
    DEFAULT_SUPABASE_URL: '',          // e.g. https://xyzcompany.supabase.co
    DEFAULT_SUPABASE_ANON_KEY: '',     // e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

    // Legacy Google Apps Script URL (kept for reference, no longer used)
    DEFAULT_API_URL: '',

    // Timezone & Shift Settings (New Jersey / NJ time)
    NJ_TIMEZONE: 'America/New_York',
    TARGET_WORK_MINUTES: 10 * 60, // 10-hour shift = 600 mins
    LATE_ARRIVAL_CUTOFF_HOUR: 8,
    LATE_ARRIVAL_CUTOFF_MINUTE: 30
};

const ADMIN_ACCOUNT = {
    id: '1',
    name: 'Administrator',
    email: 'admin@ark.com',
    password: 'admin123',
    role: 'admin',
    designation: 'Super Administrator',
    dept: 'HR',
    avatar: '👨‍💼'
};

const INITIAL_EMPLOYEES = [
    { id: '101', name: 'Dara Janwary', email: 'dara.janwary@ark.com', password: '123456', dept: 'Accounts', role: 'Accounts Manager', status: 'Active', avatar: '👨‍💼', joined: '15 Jan 2024', managerId: '1' },
    { id: '102', name: 'Samra Farid', email: 'samra.farid@ark.com', password: '123456', dept: 'Accounts', role: 'Accounts Executive', status: 'Active', avatar: '👩‍💼', joined: '20 Feb 2024', managerId: '101' },
    { id: '103', name: 'Zeeshan Rashid', email: 'zeeshan.rashid@ark.com', password: '123456', dept: 'Accounts', role: 'Accounts Officer', status: 'Active', avatar: '👨‍💻', joined: '10 Mar 2024', managerId: '101' },
    { id: '104', name: 'Faraz Ud Din', email: 'faraz.uddin@ark.com', password: '123456', dept: 'Documentation', role: 'Documentation Manager', status: 'Active', avatar: '👨‍💼', joined: '05 Jan 2024', managerId: '1' },
    { id: '105', name: 'Rehab Zehra', email: 'rehab.zehra@ark.com', password: '123456', dept: 'Documentation', role: 'Documentation Officer', status: 'Active', avatar: '👩‍💼', joined: '18 Feb 2024', managerId: '104' },
    { id: '106', name: 'Ali Hussain', email: 'ali.hussain@ark.com', password: '123456', dept: 'Documentation', role: 'Documentation Executive', status: 'Active', avatar: '👨‍💻', joined: '22 Mar 2024', managerId: '104' },
    { id: '107', name: 'Maryam Siddiqui', email: 'maryam.siddiqui@ark.com', password: '123456', dept: 'Dispatch', role: 'Dispatch Manager', status: 'Active', avatar: '👩‍💼', joined: '12 Jan 2024', managerId: '1' },
    { id: '108', name: 'Shaema Hafeez', email: 'shaema.hafeez@ark.com', password: '123456', dept: 'Dispatch', role: 'Dispatch Officer', status: 'Active', avatar: '👩‍💻', joined: '08 Feb 2024', managerId: '107' },
    { id: '109', name: 'Hamid', email: 'hamid@ark.com', password: '123456', dept: 'Dispatch', role: 'Dispatch Executive', status: 'Active', avatar: '👨‍💼', joined: '15 Mar 2024', managerId: '107' },
    { id: '110', name: 'Iffrah Syed', email: 'iffrah.syed@ark.com', password: '123456', dept: 'Operations', role: 'Operations Manager', status: 'Active', avatar: '👩‍💼', joined: '01 Feb 2024', managerId: '1' },
    { id: '111', name: 'Muhammad Hamiz', email: 'muhammad.hamiz@ark.com', password: '123456', dept: 'Operations', role: 'Operations Executive', status: 'Active', avatar: '👨‍💻', joined: '20 Mar 2024', managerId: '110' },
    { id: '112', name: 'Ayesha Fatima', email: 'ayesha.fatima@ark.com', password: '123456', dept: 'HR', role: 'HR Manager', status: 'Active', avatar: '👩‍💼', joined: '10 Jan 2024', managerId: '1' }
];

const AVATARS = [
    '👨‍💼', '👩‍💼', '🧑‍💻', '👩‍💻', '👨‍🔬', '👩‍🔬', '👨‍🎨', '👩‍🎨', '🧑‍🚀', '🧑‍🏫', '🧕', '🧔', '🧑‍💼', '👨‍💻', '👩‍🦰'
];

const INITIAL_LEAVES = [
    {
        id: 'LV-SEED-1',
        empId: '102',
        empName: 'Samra Farid',
        type: 'Annual Leave',
        from: '2026-09-29',
        to: '2026-09-30',
        days: 2,
        reason: 'Family trip planned',
        status: 'ManagerApproved',
        managerId: '101',
        managerName: 'Dara Janwary',
        managerDecision: 'Approved',
        managerAt: '2026-09-28',
        managerNote: 'Work delegated to Zeeshan',
        adminId: '',
        adminName: '',
        adminDecision: '',
        adminAt: '',
        adminNote: '',
        createdAt: '2026-09-28T09:00:00.000Z'
    },
    {
        id: 'LV-SEED-2',
        empId: '105',
        empName: 'Rehab Zehra',
        type: 'Sick Leave',
        from: '2026-09-29',
        to: '2026-09-29',
        days: 1,
        reason: 'Medical consultation and flu recovery',
        status: 'Pending',
        managerId: '104',
        managerName: 'Faraz Ud Din',
        managerDecision: '',
        managerAt: '',
        managerNote: '',
        adminId: '',
        adminName: '',
        adminDecision: '',
        adminAt: '',
        adminNote: '',
        createdAt: '2026-09-28T10:30:00.000Z'
    },
    {
        id: 'LV-SEED-3',
        empId: '108',
        empName: 'Shaema Hafeez',
        type: 'Casual Leave',
        from: '2026-09-27',
        to: '2026-09-27',
        days: 1,
        reason: 'Personal domestic matter',
        status: 'Approved',
        managerId: '107',
        managerName: 'Maryam Siddiqui',
        managerDecision: 'Approved',
        managerAt: '2026-09-27',
        managerNote: 'Approved',
        adminId: '1',
        adminName: 'Administrator',
        adminDecision: 'Approved',
        adminAt: '2026-09-27',
        adminNote: 'Granted by Admin',
        createdAt: '2026-09-27T08:00:00.000Z'
    }
];

const INITIAL_TIMESHEETS = [
    { id: 'TS-SEED-01', empId: '101', empName: 'Dara Janwary', dept: 'Accounts', action: 'Check Out', date: '2026-09-25', time: '06:05:00 PM', checkIn: '08:00:15 AM', checkOut: '06:05:00 PM', totalHours: '09h 45m 00s', breakTime: '00h 19m 45s', workingSeconds: 35100, breakSeconds: 1185, punctuality: 'On Time', notes: 'Completed 10h shift' },
    { id: 'TS-SEED-02', empId: '102', empName: 'Samra Farid', dept: 'Accounts', action: 'Check Out', date: '2026-09-25', time: '06:12:30 PM', checkIn: '08:10:00 AM', checkOut: '06:12:30 PM', totalHours: '09h 37m 30s', breakTime: '00h 25m 00s', workingSeconds: 34650, breakSeconds: 1500, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-03', empId: '103', empName: 'Zeeshan Rashid', dept: 'Accounts', action: 'Check Out', date: '2026-09-25', time: '06:00:00 PM', checkIn: '08:29:10 AM', checkOut: '06:00:00 PM', totalHours: '09h 15m 50s', breakTime: '00h 15m 00s', workingSeconds: 33350, breakSeconds: 900, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-04', empId: '101', empName: 'Dara Janwary', dept: 'Accounts', action: 'Check Out', date: '2026-09-24', time: '06:00:00 PM', checkIn: '08:00:00 AM', checkOut: '06:00:00 PM', totalHours: '09h 40m 00s', breakTime: '00h 20m 00s', workingSeconds: 34800, breakSeconds: 1200, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-05', empId: '102', empName: 'Samra Farid', dept: 'Accounts', action: 'Check Out', date: '2026-09-24', time: '06:08:00 PM', checkIn: '08:05:00 AM', checkOut: '06:08:00 PM', totalHours: '09h 43m 00s', breakTime: '00h 20m 00s', workingSeconds: 34980, breakSeconds: 1200, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-06', empId: '101', empName: 'Dara Janwary', dept: 'Accounts', action: 'Check Out', date: '2026-09-23', time: '06:02:00 PM', checkIn: '08:00:00 AM', checkOut: '06:02:00 PM', totalHours: '09h 42m 00s', breakTime: '00h 20m 00s', workingSeconds: 34920, breakSeconds: 1200, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-07', empId: '102', empName: 'Samra Farid', dept: 'Accounts', action: 'Check Out', date: '2026-09-23', time: '06:15:00 PM', checkIn: '08:15:00 AM', checkOut: '06:15:00 PM', totalHours: '09h 30m 00s', breakTime: '00h 30m 00s', workingSeconds: 34200, breakSeconds: 1800, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-08', empId: '101', empName: 'Dara Janwary', dept: 'Accounts', action: 'Check Out', date: '2026-09-22', time: '06:00:00 PM', checkIn: '08:00:00 AM', checkOut: '06:00:00 PM', totalHours: '09h 50m 00s', breakTime: '00h 10m 00s', workingSeconds: 35400, breakSeconds: 600, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-09', empId: '102', empName: 'Samra Farid', dept: 'Accounts', action: 'Check Out', date: '2026-09-22', time: '06:10:00 PM', checkIn: '08:02:00 AM', checkOut: '06:10:00 PM', totalHours: '09h 48m 00s', breakTime: '00h 20m 00s', workingSeconds: 35280, breakSeconds: 1200, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-10', empId: '101', empName: 'Dara Janwary', dept: 'Accounts', action: 'Check Out', date: '2026-09-21', time: '06:05:00 PM', checkIn: '08:01:00 AM', checkOut: '06:05:00 PM', totalHours: '09h 44m 00s', breakTime: '00h 20m 00s', workingSeconds: 35040, breakSeconds: 1200, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-11', empId: '102', empName: 'Samra Farid', dept: 'Accounts', action: 'Check Out', date: '2026-09-21', time: '06:00:00 PM', checkIn: '08:35:00 AM', checkOut: '06:00:00 PM', totalHours: '09h 00m 00s', breakTime: '00h 25m 00s', workingSeconds: 32400, breakSeconds: 1500, punctuality: 'Late Arrival', notes: 'Late arrival' },
    { id: 'TS-SEED-12', empId: '101', empName: 'Dara Janwary', dept: 'Accounts', action: 'Check Out', date: '2026-09-18', time: '06:00:00 PM', chckIn: '08:00:00 AM', checkOut: '06:00:00 PM', totalHours: '09h 40m 00s', breakTime: '00h 20m 00s', workingSeconds: 34800, breakSeconds: 1200, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-13', empId: '102', empName: 'Samra Farid', dept: 'Accounts', action: 'Check Out', date: '2026-09-18', time: '06:05:00 PM', checkIn: '08:00:00 AM', checkOut: '06:05:00 PM', totalHours: '09h 45m 00s', breakTime: '00h 20m 00s', workingSeconds: 35100, breakSeconds: 1200, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-14', empId: '101', empName: 'Dara Janwary', dept: 'Accounts', action: 'Check Out', date: '2026-09-17', time: '06:10:00 PM', checkIn: '08:00:00 AM', checkOut: '06:10:00 PM', totalHours: '09h 50m 00s', breakTime: '00h 20m 00s', workingSeconds: 35400, breakSeconds: 1200, punctuality: 'On Time', notes: 'Completed shift' },
    { id: 'TS-SEED-15', empId: '102', empName: 'Samra Farid', dept: 'Accounts', action: 'Check Out', date: '2026-09-17', time: '06:00:00 PM', checkIn: '08:00:00 AM', checkOut: '06:00:00 PM', totalHours: '09h 35m 00s', breakTime: '00h 25m 00s', workingSeconds: 34500, breakSeconds: 1500, punctuality: 'On Time', notes: 'Completed shift' }
];
