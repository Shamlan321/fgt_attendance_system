import { AttendanceLog } from './definitions';

// Singleton store for local development
// We attach to globalThis to persist across hot reloads in dev

const globalForMock = globalThis as unknown as {
    mockStore: MockStore | undefined;
};

export interface EmployeeStats {
    name: string;
    totalDays: number;
    presentDays: number;
    absentDays: number;
    attendancePercentage: number;
    lastCheckIn?: Date | string;
    isPresent: boolean;
    overtimeHours?: number;
    lateArrivals?: number;
}

class MockStore {
    private logs: AttendanceLog[] = [];

    constructor() {
        this.logs = [
            { id: '1', name: 'John Doe', date: '2023-10-26', time: '09:00:00', type: 'check_in', synced_at: new Date().toISOString() },
            { id: '2', name: 'Jane Smith', date: '2023-10-26', time: '09:15:00', type: 'check_in', synced_at: new Date().toISOString() },
            { id: '3', name: 'John Doe', date: '2023-10-25', time: '08:55:00', type: 'check_in', synced_at: new Date().toISOString() },
        ];
    }

    addLog(log: Omit<AttendanceLog, 'id' | 'synced_at'>) {
        const newLog: AttendanceLog = {
            ...log,
            id: crypto.randomUUID(),
            synced_at: new Date().toISOString(),
        };
        this.logs.unshift(newLog);
        return newLog;
    }

    getLogs(startDate?: string, endDate?: string): AttendanceLog[] {
        if (!startDate && !endDate) return this.logs;

        return this.logs.filter(log => {
            if (startDate && log.date < startDate) return false;
            if (endDate && log.date > endDate) return false;
            return true;
        });
    }

    public getEmployees(): string[] {
        const uniqueNames = new Set(this.logs.map(log => log.name));
        return Array.from(uniqueNames).sort();
    }

    public getEmployeeStats(name: string, month?: string): EmployeeStats {
        // Filter logs for this employee
        let employeeLogs = this.logs.filter(log => log.name === name);

        // If month specified, filter by month (format: YYYY-MM)
        if (month) {
            employeeLogs = employeeLogs.filter(log => log.date.startsWith(month));
        } else {
            // Default to current month
            const currentMonth = new Date().toISOString().slice(0, 7);
            employeeLogs = employeeLogs.filter(log => log.date.startsWith(currentMonth));
        }

        const today = new Date().toISOString().split('T')[0];
        const isPresent = employeeLogs.some(log => log.date === today);

        // Get unique days present
        const uniqueDays = new Set(employeeLogs.map(log => log.date));
        const presentDays = uniqueDays.size;

        // Calculate total days in month (for percentage)
        const totalDays = this.getTotalDaysInMonth(month);
        const absentDays = totalDays - presentDays;
        const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

        // Find the latest check-in time for the employee within the filtered logs
        let latestCheckIn: Date | undefined;
        if (employeeLogs.length > 0) {
            // Sort logs by synced_at in descending order to easily get the latest
            const sortedLogs = [...employeeLogs].sort((a, b) => new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime());
            latestCheckIn = new Date(sortedLogs[0].synced_at);
        }

        return {
            name,
            totalDays,
            presentDays,
            absentDays,
            attendancePercentage: Math.round(attendancePercentage * 10) / 10,
            lastCheckIn: latestCheckIn,
            isPresent
        };
    }

    public getAllEmployeeStats(): EmployeeStats[] {
        const employees = this.getEmployees();
        return employees.map(name => this.getEmployeeStats(name));
    }

    private getTotalDaysInMonth(month?: string): number {
        const targetMonth = month || new Date().toISOString().slice(0, 7);
        const [year, monthNum] = targetMonth.split('-').map(Number);
        const date = new Date(year, monthNum, 0);
        return date.getDate();
    }

    public getEmployeeLogs(name: string, startDate?: string, endDate?: string): AttendanceLog[] {
        let logs = this.logs.filter(log => log.name === name);

        if (startDate) {
            logs = logs.filter(log => log.date >= startDate);
        }
        if (endDate) {
            logs = logs.filter(log => log.date <= endDate);
        }

        return logs;
    }
}

export const mockStore = globalForMock.mockStore ?? new MockStore();

if (process.env.NODE_ENV !== 'production') {
    globalForMock.mockStore = mockStore;
}
