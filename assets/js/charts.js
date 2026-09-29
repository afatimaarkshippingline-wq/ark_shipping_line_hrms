/**
 * ARK HRMS · Chart.js Manager
 * ARK Shipping Line
 */

const ChartManager = {
    instances: {
        weeklyTrend: null,
        presenceDonut: null,
        deptHeadcount: null,
        leaveTypes: null,
        attPunctuality: null,
        attHours: null,
        monthlyAttendance: null
    },

    destroy(name) {
        if (this.instances[name]) {
            try { this.instances[name].destroy(); } catch (e) {}
            this.instances[name] = null;
        }
    },

    getTheme(isDark) {
        return {
            textColor: isDark ? '#94a3b8' : '#64748b',
            gridColor: isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.7)',
            legendOpts: {
                labels: {
                    color: isDark ? '#94a3b8' : '#64748b',
                    font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
                    boxWidth: 12,
                    padding: 12
                }
            }
        };
    },

    renderWeeklyTrend(canvasId, timesheets = [], employees = [], isDark = false) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        this.destroy('weeklyTrend');
        const theme = this.getTheme(isDark);

        // Dynamically compute last 7 days attendance %
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const totalStaff = Math.max(1, employees.filter(e => e.status !== 'Inactive').length);
        const dynamicData = days.map((d, idx) => {
            const dayTimesheets = timesheets.filter(t => {
                if (!t.date) return false;
                const date = new Date(t.date);
                return (date.getDay() + 6) % 7 === idx; // 0=Mon, 6=Sun
            });
            const uniqueEmps = new Set(dayTimesheets.map(t => String(t.empId))).size;
            return uniqueEmps > 0 ? Math.min(100, Math.round((uniqueEmps / totalStaff) * 100)) : (idx < 5 ? 100 : 0);
        });

        this.instances.weeklyTrend = new Chart(canvas, {
            type: 'line',
            data: {
                labels: days,
                datasets: [
                    { label: 'Present %', data: dynamicData, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.12)', fill: true, tension: 0.4, pointBackgroundColor: '#fff', pointBorderColor: '#2563eb', pointBorderWidth: 2, pointRadius: 4, borderWidth: 2.5 },
                    { label: 'Target', data: [90, 90, 90, 90, 90, 90, 90], borderColor: '#94a3b8', borderDash: [5, 5], pointRadius: 0, borderWidth: 1.5 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: theme.legendOpts },
                scales: {
                    x: { grid: { display: false }, ticks: { color: theme.textColor } },
                    y: { min: 0, max: 100, grid: { color: theme.gridColor }, ticks: { color: theme.textColor, callback: v => `${v}%` } }
                }
            }
        });
    },

    renderPresenceDonut(canvasId, employees, isDark) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        this.destroy('presenceDonut');
        const a = employees.filter(e => e.status === 'Active').length;
        const aw = employees.filter(e => e.status === 'Away').length;
        const ol = employees.filter(e => e.status === 'On Leave').length;
        this.instances.presenceDonut = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Away', 'Leave'],
                datasets: [{
                    data: [a, aw, ol],
                    backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6'],
                    borderWidth: 3,
                    borderColor: isDark ? '#0f172a' : '#ffffff',
                    hoverOffset: 10,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '74%',
                plugins: { legend: { display: false } }
            }
        });
    },

    renderDeptHeadcount(canvasId, departments, employees, isDark) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        this.destroy('deptHeadcount');
        const theme = this.getTheme(isDark);
        this.instances.deptHeadcount = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: departments.map(d => d.split(' ')[0]),
                datasets: [{
                    label: 'Staff',
                    data: departments.map(d => employees.filter(e => e.dept === d).length),
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
                    borderRadius: 10,
                    maxBarThickness: 42
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 } } },
                    y: { beginAtZero: true, ticks: { stepSize: 1, color: theme.textColor }, grid: { color: theme.gridColor } }
                }
            }
        });
    },

    renderLeaveTypes(canvasId, legendId, leaves, isDark) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        this.destroy('leaveTypes');
        const typeMap = {};
        leaves.forEach(l => { typeMap[l.type] = (typeMap[l.type] || 0) + 1; });
        const labels = Object.keys(typeMap).length ? Object.keys(typeMap) : ['No data'];
        const data = Object.keys(typeMap).length ? Object.values(typeMap) : [1];
        const colors = ['#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6', '#10b981'];

        this.instances.leaveTypes = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 3,
                    borderColor: isDark ? '#0f172a' : '#ffffff',
                    hoverOffset: 8,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: { legend: { display: false } }
            }
        });

        const legendEl = document.getElementById(legendId);
        if (legendEl) {
            legendEl.innerHTML = labels.map((lbl, i) => `
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${colors[i % colors.length]}"></span>
                    <span class="text-slate-600 dark:text-slate-300">${lbl}</span>
                    <strong class="ml-auto text-slate-900 dark:text-white">${data[i]}</strong>
                </div>
            `).join('');
        }
    },

    renderAttPunctuality(canvasId, valueId, timesheets, isDark) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        this.destroy('attPunctuality');
        const buckets = ['On Time', 'Early Arrival', 'Late Arrival'];
        const data = buckets.map(b => timesheets.filter(t => t.punctuality === b).length || 0);
        const theme = this.getTheme(isDark);

        this.instances.attPunctuality = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: buckets,
                datasets: [{
                    data,
                    backgroundColor: ['#10b981', '#3b82f6', '#f43f5e'],
                    borderWidth: 3,
                    borderColor: isDark ? '#0f172a' : '#ffffff',
                    hoverOffset: 10,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { ...theme.legendOpts, position: 'bottom' } }
            }
        });

        const sum = data.reduce((a, b) => a + b, 0) || 1;
        const valEl = document.getElementById(valueId);
        if (valEl) valEl.innerText = `${Math.round((data[0] / sum) * 100)}%`;
    },

    renderAttHours(canvasId, timesheets, isDark) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        this.destroy('attHours');
        const theme = this.getTheme(isDark);
        const labels = timesheets.slice(0, 10).map(t => t.empName.split(' ')[0]);
        const data = timesheets.slice(0, 10).map(t => parseFloat(String(t.totalHours).replace('h', '')) || 0);

        this.instances.attHours = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Hours',
                    data,
                    backgroundColor: data.map(h => h >= 6 ? 'rgba(16,185,129,0.85)' : h >= 4 ? 'rgba(59,130,246,0.85)' : 'rgba(245,158,11,0.85)'),
                    borderRadius: 8,
                    maxBarThickness: 36
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: theme.textColor } },
                    y: { beginAtZero: true, max: 10, grid: { color: theme.gridColor }, ticks: { color: theme.textColor, callback: v => `${v}h` } }
                }
            }
        });
    },

    renderMonthlyAttendance(canvasId, timesheets = [], employees = [], isDark = false) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        this.destroy('monthlyAttendance');
        const theme = this.getTheme(isDark);

        const totalStaff = Math.max(1, employees.filter(e => e.status !== 'Inactive').length);
        const days = Array.from({ length: 15 }, (_, i) => `${i + 1}`);
        const dynamicData = days.map((d, idx) => {
            const dayTs = timesheets.filter(t => t.date && parseInt(t.date.split('-')[2], 10) === (idx + 1));
            const uniqueEmps = new Set(dayTs.map(t => String(t.empId))).size;
            return uniqueEmps > 0 ? Math.min(100, Math.round((uniqueEmps / totalStaff) * 100)) : 100;
        });

        this.instances.monthlyAttendance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'Attendance %',
                    data: dynamicData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37,99,235,0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: theme.textColor, maxTicksLimit: 8 } },
                    y: { min: 0, max: 100, grid: { color: theme.gridColor }, ticks: { color: theme.textColor, callback: v => `${v}%` } }
                }
            }
        });
    }
};
