import { sql } from '@vercel/postgres';
import { AttendanceLog } from './definitions';
import { unstable_noStore as noStore } from 'next/cache';
import { mockStore, EmployeeStats } from './mock-store';

export { type EmployeeStats };

export async function fetchLatestAttendance() {
    noStore();

    // Return mock data if no DB connection
    if (!process.env.POSTGRES_URL) {
        console.log('Using mock store for attendance logs');
        return mockStore.getLogs();
    }

    try {
        const data = await sql<AttendanceLog>`
      SELECT * FROM attendance_logs 
      ORDER BY date DESC, time DESC 
      LIMIT 20
    `;
        return data.rows;
    } catch (error) {
        console.error('Database Error:', error);
        return [];
    }
}

export async function fetchStats() {
    noStore();

    if (!process.env.POSTGRES_URL) {
        const logs = mockStore.getLogs();
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = logs.filter(log => log.date === today);
        const uniqueNames = new Set(todayLogs.map(l => l.name)).size;
        return { todayValues: uniqueNames, totalEntries: logs.length };
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        const countPromise = sql`
      SELECT COUNT(DISTINCT name) as count 
      FROM attendance_logs 
      WHERE date = ${today}
    `;

        const totalPromise = sql`SELECT COUNT(*) as count FROM attendance_logs`;

        const [todayCount, totalCount] = await Promise.all([countPromise, totalPromise]);

        return {
            todayValues: Number(todayCount.rows[0].count),
            totalEntries: Number(totalCount.rows[0].count)
        };
    } catch (error) {
        console.error('Database Error:', error);
        return { todayValues: 0, totalEntries: 0 };
    }
}

export async function fetchEmployees(): Promise<EmployeeStats[]> {
    noStore();

    if (!process.env.POSTGRES_URL) {
        return mockStore.getAllEmployeeStats();
    }

    try {
        const employees = await sql`
      SELECT 
        name,
        COUNT(*) as total_days,
        COUNT(CASE WHEN date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') THEN 1 END) as is_present,
        MAX(synced_at) as last_check_in
      FROM attendance_logs
      GROUP BY name
      ORDER BY name ASC
    `;

        return employees.rows.map(row => {
            const totalDays = Number(row.total_days);
            // Determine absent days based on work days in month (approximate for MVP)
            const currentDay = new Date().getDate();
            const absentDays = Math.max(0, currentDay - totalDays); // Simple heuristic
            const attendancePercentage = (totalDays / currentDay) * 100;

            return {
                name: row.name,
                totalDays,
                presentDays: totalDays, // For now assuming 1 entry per day
                absentDays,
                attendancePercentage: Math.round(attendancePercentage * 10) / 10,
                lastCheckIn: row.last_check_in,
                isPresent: Number(row.is_present) > 0
            };
        });
    } catch (error) {
        console.error('Database Error:', error);
        return [];
    }
}

export async function fetchEmployeeStats(name: string): Promise<EmployeeStats> {
    noStore();

    if (!process.env.POSTGRES_URL) {
        return mockStore.getEmployeeStats(name);
    }

    try {
        const stats = await sql`
            SELECT 
                COUNT(*) as total_days,
                COUNT(CASE WHEN date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') THEN 1 END) as is_present
            FROM attendance_logs
            WHERE name = ${name}
        `;

        const row = stats.rows[0];
        const totalDays = Number(row.total_days);
        const currentDay = new Date().getDate();
        const absentDays = Math.max(0, currentDay - totalDays);
        const attendancePercentage = currentDay > 0 ? (totalDays / currentDay) * 100 : 0;

        return {
            name,
            totalDays,
            presentDays: totalDays,
            absentDays,
            attendancePercentage: Math.round(attendancePercentage * 10) / 10,
            isPresent: Number(row.is_present) > 0
        };
    } catch (error) {
        console.error('Database Error:', error);
        return { name, totalDays: 0, presentDays: 0, absentDays: 0, attendancePercentage: 0, isPresent: false };
    }
}

export async function fetchEmployeeLogs(name: string): Promise<AttendanceLog[]> {
    noStore();
    if (!process.env.POSTGRES_URL) return mockStore.getEmployeeLogs(name);

    try {
        const logs = await sql<AttendanceLog>`
            SELECT * FROM attendance_logs 
            WHERE name = ${name}
            ORDER BY date DESC, time DESC
        `;
        return logs.rows;
    } catch (error) {
        return [];
    }
}

export async function fetchLogs(startDate?: string, endDate?: string): Promise<AttendanceLog[]> {
    noStore();
    if (!process.env.POSTGRES_URL) return mockStore.getLogs(startDate, endDate);

    try {
        let query;
        if (startDate && endDate) {
            query = sql<AttendanceLog>`
                SELECT * FROM attendance_logs 
                WHERE date >= ${startDate} AND date <= ${endDate}
                ORDER BY date DESC, time DESC
            `;
        } else {
            query = sql<AttendanceLog>`
                SELECT * FROM attendance_logs 
                ORDER BY date DESC, time DESC
            `;
        }

        const logs = await query;
        return logs.rows;
    } catch (error) {
        console.error('Database Error:', error);
        return [];
    }
}
