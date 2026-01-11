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

        // Fetch settings
        const { data: settingsData } = await supabase
            .from('system_settings')
            .select('*');

        const settings = {
            standard_check_in: '09:00',
            standard_check_out: '17:00',
            overtime_threshold: '20:00',
            ...Object.fromEntries(settingsData?.map((s: any) => [s.key, s.value]) || [])
        };

        // Fetch all attendance logs for the current month/relevant period
        // Optimization: Filter by date if needed, for now getting all is fine for small scale
        const { data: logs, error } = await supabase
            .from('attendance_logs')
            .select('name, date, time, type, synced_at');

        if (error) throw error;
        if (!logs || logs.length === 0) return [];

        // Group logs by employee and date
        // Structure: Map<Name, Map<Date, { first: Time, last: Time }>>
        const employeeData = new Map<string, {
            totalDays: number;
            presentDays: number;
            overtimeHours: number;
            lateArrivals: number;
            lastCheckIn: string;
            isPresent: boolean;
            dailyStats: Map<string, { checkIn: string; checkOut: string; }>;
        }>();

        logs.forEach(log => {
            if (!employeeData.has(log.name)) {
                employeeData.set(log.name, {
                    totalDays: 0,
                    presentDays: 0,
                    overtimeHours: 0,
                    lateArrivals: 0,
                    lastCheckIn: '',
                    isPresent: false,
                    dailyStats: new Map()
                });
            }

            const emp = employeeData.get(log.name)!;

            // Update Daily Stats
            if (!emp.dailyStats.has(log.date)) {
                emp.dailyStats.set(log.date, { checkIn: log.time, checkOut: log.time });
            } else {
                const day = emp.dailyStats.get(log.date)!;
                if (log.time < day.checkIn) day.checkIn = log.time;
                if (log.time > day.checkOut) day.checkOut = log.time;
            }

            // Track latest activity for "Last Seen"
            if (!emp.lastCheckIn || new Date(log.synced_at) > new Date(emp.lastCheckIn)) {
                emp.lastCheckIn = log.synced_at;
            }

            if (log.date === today) emp.isPresent = true;
        });

        // Calculate aggregated stats
        const currentDay = new Date().getDate();

        return Array.from(employeeData.entries()).map(([name, data]) => {
            let totalOvertimeMinutes = 0;
            let lateCount = 0;

            data.dailyStats.forEach((times, date) => {
                // Late Calculation
                if (times.checkIn > settings.standard_check_in) {
                    lateCount++;
                }

                // Overtime Calculation
                // Only if checked out after standard check out
                if (times.checkOut > settings.standard_check_out) {
                    // Cap at threshold
                    const effectiveCheckOut = times.checkOut > settings.overtime_threshold
                        ? settings.overtime_threshold
                        : times.checkOut;

                    // Calculate difference in minutes
                    const [stdH, stdM] = settings.standard_check_out.split(':').map(Number);
                    const [outH, outM] = effectiveCheckOut.split(':').map(Number);

                    const diffMinutes = (outH * 60 + outM) - (stdH * 60 + stdM);
                    if (diffMinutes > 0) totalOvertimeMinutes += diffMinutes;
                }
            });

            const totalDays = data.dailyStats.size; // Total unique days present
            const absentDays = Math.max(0, currentDay - totalDays);
            const attendancePercentage = (totalDays / currentDay) * 100;

            return {
                name,
                totalDays,
                presentDays: totalDays,
                absentDays,
                attendancePercentage: Math.round(attendancePercentage * 10) / 10,
                lastCheckIn: data.lastCheckIn,
                isPresent: data.isPresent,
                overtimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
                lateArrivals: lateCount
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

        // Fetch settings
        const { data: settingsData } = await supabase
            .from('system_settings')
            .select('*');

        const settings = {
            standard_check_in: '09:00',
            standard_check_out: '17:00',
            overtime_threshold: '20:00',
            ...Object.fromEntries(settingsData?.map((s: any) => [s.key, s.value]) || [])
        };

        const { data: logs, error } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('name', name);

        if (error) throw error;
        if (!logs) return { name, totalDays: 0, presentDays: 0, absentDays: 0, attendancePercentage: 0, isPresent: false };

        const totalDays = new Set(logs.map(l => l.date)).size;
        const isPresent = logs.some(log => log.date === today);
        const currentDay = new Date().getDate();
        const absentDays = Math.max(0, currentDay - totalDays);
        const attendancePercentage = currentDay > 0 ? (totalDays / currentDay) * 100 : 0;

        // Find last check in
        const sortedLogs = [...logs].sort((a, b) => new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime());
        const lastCheckIn = sortedLogs[0]?.synced_at;

        // Calculate Overtime and Late Arrivals
        const dailyStats = new Map<string, { checkIn: string; checkOut: string; }>();
        logs.forEach(log => {
            if (!dailyStats.has(log.date)) {
                dailyStats.set(log.date, { checkIn: log.time, checkOut: log.time });
            } else {
                const day = dailyStats.get(log.date)!;
                if (log.time < day.checkIn) day.checkIn = log.time;
                if (log.time > day.checkOut) day.checkOut = log.time;
            }
        });

        let totalOvertimeMinutes = 0;
        let lateCount = 0;

        dailyStats.forEach((times) => {
            // Late Calculation
            if (times.checkIn > settings.standard_check_in) {
                lateCount++;
            }

            // Overtime Calculation
            if (times.checkOut > settings.standard_check_out) {
                const effectiveCheckOut = times.checkOut > settings.overtime_threshold
                    ? settings.overtime_threshold
                    : times.checkOut;

                const [stdH, stdM] = settings.standard_check_out.split(':').map(Number);
                const [outH, outM] = effectiveCheckOut.split(':').map(Number);

                const diffMinutes = (outH * 60 + outM) - (stdH * 60 + stdM);
                if (diffMinutes > 0) totalOvertimeMinutes += diffMinutes;
            }
        });

        return {
            name,
            totalDays,
            presentDays: totalDays,
            absentDays,
            attendancePercentage: Math.round(attendancePercentage * 10) / 10,
            isPresent,
            lastCheckIn,
            overtimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
            lateArrivals: lateCount
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
