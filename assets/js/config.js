/**
 * ARK HRMS · Configuration & Initial Seed Data
 * ARK Shipping Line
 */

const CONFIG = {
    // Supabase configuration — paste your own credentials in Admin → Settings
    DEFAULT_SUPABASE_URL: 'https://ezdsvzunxolseezqvikn.supabase.co',          // e.g. https://xyzcompany.supabase.co
    DEFAULT_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6ZHN2enVueG9sc2VlenF2aWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Nzg5OTAsImV4cCI6MjEwNjE1NDk5MH0.OFe5jWJj69xwwXe2tQtnJsDCy9AfoDRAINEdVEN5R24',     // e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

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

const INITIAL_LEAVES = [];

const INITIAL_TIMESHEETS = [];
