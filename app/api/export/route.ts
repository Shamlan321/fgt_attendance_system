import { fetchLogs } from '@/app/lib/data';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'today';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let logs;
        let filename;

        if (type === 'custom' && startDate && endDate) {
            logs = await fetchLogs(startDate, endDate);
            filename = `attendance_${startDate}_to_${endDate}.xlsx`;
        } else if (type === 'today') {
            const today = new Date().toISOString().split('T')[0];
            logs = await fetchLogs(today, today);
            filename = `attendance_${today}.xlsx`;
        } else if (type === 'week') {
            const { getWeekDates } = await import('@/app/lib/utils');
            const { start, end } = getWeekDates();
            logs = await fetchLogs(start, end);
            filename = `attendance_week_${start}_to_${end}.xlsx`;
        } else if (type === 'month') {
            const { getMonthDates } = await import('@/app/lib/utils');
            const { start, end } = getMonthDates();
            logs = await fetchLogs(start, end);
            filename = `attendance_month_${start}_to_${end}.xlsx`;
        } else {
            logs = await fetchLogs();
            filename = 'attendance_all.xlsx';
        }

        // Create worksheet data
        const wsData = [
            ['Name', 'Date', 'Time', 'Synced At'],
            ...logs.map(log => [
                log.name,
                log.date,
                log.time,
                new Date(log.synced_at).toLocaleString()
            ])
        ];

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column widths
        ws['!cols'] = [
            { wch: 20 },
            { wch: 12 },
            { wch: 10 },
            { wch: 20 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

        // Generate buffer
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Return as downloadable file
        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
