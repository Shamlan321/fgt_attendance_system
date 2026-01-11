import { AttendanceLog } from './definitions';
import { unstable_noStore as noStore } from 'next/cache';
import { mockStore, EmployeeStats } from './mock-store';
import { getTodayPST } from './utils';
import { supabase } from './supabase';

export { type EmployeeStats };

export async function fetchLatestAttendance() {
    noStore();

    // Return mock data if no Supabase connection
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.log('Using mock store for attendance logs');
        return mockStore.getLogs();
    }

    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .select('*')
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(20);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Database Error:', error);
        return [];
    }
}

export async function fetchStats() {
    noStore();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const logs = mockStore.getLogs();
        const today = getTodayPST();
        const todayLogs = logs.filter(log => log.date === today);
        const uniqueNames = new Set(todayLogs.map(l => l.name)).size;
        return { todayValues: uniqueNames, totalEntries: logs.length };
    }

    try {
        const today = getTodayPST();

        // Count distinct names for today
        const { data: todayData, error: todayError } = await supabase
            .from('attendance_logs')
            .select('name')
            .eq('date', today);

        if (todayError) throw todayError;

        const uniqueNames = new Set(todayData?.map(log => log.name) || []).size;

        // Count total entries
        const { count: totalCount, error: totalError } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true });

        if (totalError) throw totalError;

        return {
            todayValues: uniqueNames,
            totalEntries: totalCount || 0
        };
    } catch (error) {
        console.error('Database Error:', error);
        return { todayValues: 0, totalEntries: 0 };
    }
}

export async function fetchEmployees(): Promise<EmployeeStats[]> {
    noStore();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return mockStore.getAllEmployeeStats();
    }

    try {
        const today = getTodayPST();

        // Fetch all attendance logs
        const { data: logs, error } = await supabase
            .from('attendance_logs')
            .select('name, date, synced_at');

        if (error) throw error;
        if (!logs || logs.length === 0) return [];

        // Group by employee name
        const employeeMap = new Map<string, any>();

        logs.forEach(log => {
            if (!employeeMap.has(log.name)) {
                employeeMap.set(log.name, {
                    name: log.name,
                    totalDays: 0,
                    isPresent: false,
                    lastCheckIn: log.synced_at
                });
            }

            const emp = employeeMap.get(log.name);
            emp.totalDays++;
            if (log.date === today) {
                emp.isPresent = true;
            }
            if (new Date(log.synced_at) > new Date(emp.lastCheckIn)) {
                emp.lastCheckIn = log.synced_at;
            }
        });

        // Calculate stats
        const currentDay = new Date().getDate();
        return Array.from(employeeMap.values()).map(emp => {
            const absentDays = Math.max(0, currentDay - emp.totalDays);
            const attendancePercentage = (emp.totalDays / currentDay) * 100;

            return {
                name: emp.name,
                totalDays: emp.totalDays,
                presentDays: emp.totalDays,
                absentDays,
                attendancePercentage: Math.round(attendancePercentage * 10) / 10,
                lastCheckIn: emp.lastCheckIn,
                isPresent: emp.isPresent
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Database Error:', error);
        return [];
    }
}

export async function fetchEmployeeStats(name: string): Promise<EmployeeStats> {
    noStore();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return mockStore.getEmployeeStats(name);
    }

    try {
        const today = getTodayPST();

        const { data: logs, error } = await supabase
            .from('attendance_logs')
            .select('date')
            .eq('name', name);

        if (error) throw error;

        const totalDays = logs?.length || 0;
        const isPresent = logs?.some(log => log.date === today) || false;
        const currentDay = new Date().getDate();
        const absentDays = Math.max(0, currentDay - totalDays);
        const attendancePercentage = currentDay > 0 ? (totalDays / currentDay) * 100 : 0;

        return {
            name,
            totalDays,
            presentDays: totalDays,
            absentDays,
            attendancePercentage: Math.round(attendancePercentage * 10) / 10,
            isPresent
        };
    } catch (error) {
        console.error('Database Error:', error);
        return { name, totalDays: 0, presentDays: 0, absentDays: 0, attendancePercentage: 0, isPresent: false };
    }
}

export async function fetchEmployeeLogs(name: string): Promise<AttendanceLog[]> {
    noStore();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return mockStore.getEmployeeLogs(name);
    }

    try {
        const { data, error } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('name', name)
            .order('date', { ascending: false })
            .order('time', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Database Error:', error);
        return [];
    }
}

export async function fetchLogs(startDate?: string, endDate?: string): Promise<AttendanceLog[]> {
    noStore();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return mockStore.getLogs(startDate, endDate);
    }

    try {
        let query = supabase
            .from('attendance_logs')
            .select('*');

        if (startDate && endDate) {
            query = query
                .gte('date', startDate)
                .lte('date', endDate);
        }

        query = query
            .order('date', { ascending: false })
            .order('time', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Database Error:', error);
        return [];
    }
}
