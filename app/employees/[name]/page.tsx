import Link from 'next/link';
import { fetchEmployeeStats, fetchEmployeeLogs } from '@/app/lib/data';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ name: string }>;
}

export default async function EmployeeDetailPage({ params }: PageProps) {
    const { name } = await params;
    const employeeName = decodeURIComponent(name);

    const stats = await fetchEmployeeStats(employeeName);
    const logs = await fetchEmployeeLogs(employeeName);

    return (
        <main className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm p-6 sticky top-0 z-10">
                <Link href="/employees" className="text-blue-600 text-sm font-medium mb-2 inline-block">
                    ← Back to Employees
                </Link>
                <h1 className="text-2xl font-bold text-gray-800">{employeeName}</h1>
                <p className="text-sm text-gray-500">Attendance Details</p>
            </div>

            <div className="p-4 space-y-6 max-w-md mx-auto">
                {/* Status Card */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-teal-600 flex items-center justify-center text-white font-bold text-2xl shadow-md">
                            {employeeName.substring(0, 2).toUpperCase()}
                        </div>
                        {stats.isPresent ? (
                            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-800 border-2 border-green-200">
                                <span className="text-lg">✓</span> Present Today
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 border-2 border-gray-200">
                                Absent Today
                            </span>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                        <p className="text-gray-500 text-xs font-medium mb-1">Overtime</p>
                        <p className="text-3xl font-bold text-purple-600">{stats.overtimeHours || 0}</p>
                        <p className="text-xs text-gray-400 mt-1">Hours</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                        <p className="text-gray-500 text-xs font-medium mb-1">Late Arrivals</p>
                        <p className="text-3xl font-bold text-orange-600">{stats.lateArrivals || 0}</p>
                        <p className="text-xs text-gray-400 mt-1">Days</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                        <p className="text-gray-500 text-xs font-medium mb-1">Present Days</p>
                        <p className="text-2xl font-bold text-green-600">{stats.presentDays}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                        <p className="text-gray-500 text-xs font-medium mb-1">Absent Days</p>
                        <p className="text-2xl font-bold text-red-600">{stats.absentDays}</p>
                    </div>
                </div>

                {/* Attendance History */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800">Attendance History</h2>

                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                        {logs.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <div className="text-4xl mb-2">📅</div>
                                <p>No attendance records found.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {logs.map((log) => (
                                    <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                        <div>
                                            <p className="font-semibold text-gray-900">{log.date}</p>
                                            <p className={`text-xs uppercase font-bold ${log.type === 'check_out' ? 'text-red-500' : 'text-green-500'}`}>
                                                {log.type ? log.type.replace('_', ' ') : 'Check In'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${log.type === 'check_out' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                {log.time}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
