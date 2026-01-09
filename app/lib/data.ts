import { sql } from '@vercel/postgres';
import { AttendanceLog } from './definitions';
import { unstable_noStore as noStore } from 'next/cache';
import { mockStore } from './mock-store';

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
