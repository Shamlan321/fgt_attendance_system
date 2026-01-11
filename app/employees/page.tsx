import Link from 'next/link';

export const dynamic = 'force-dynamic';

import { fetchEmployees } from '@/app/lib/data';

async function getEmployees() {
    return await fetchEmployees();
}

export default async function EmployeesPage() {
    const employees = await getEmployees();

    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm p-6 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
                        <p className="text-sm text-gray-500">Manage and track employee attendance</p>
                    </div>
                    <Link
                        href="/employees/add"
                        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md"
                    >
                        + Add Employee
                    </Link>
                </div>
            </div>

            <div className="p-4 space-y-4 max-w-md mx-auto">
                {/* Summary Card */}
                <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Total Employees</p>
                            <p className="text-3xl font-bold text-gray-800">{employees.length}</p>
                        </div>
                        <div className="text-5xl">👥</div>
                    </div>
                </div>

                {/* Employee List */}
                <div className="space-y-3">
                    {employees.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center text-gray-500 shadow-md">
                            <div className="text-4xl mb-2">👤</div>
                            <p>No employees registered yet.</p>
                        </div>
                    ) : (
                        employees.map((emp: any) => (
                            <Link
                                key={emp.name}
                                href={`/employees/${encodeURIComponent(emp.name)}`}
                                className="block bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg hover:scale-[1.02] transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                            {emp.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{emp.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {emp.presentDays} days | {emp.overtimeHours || 0}hr OT | {emp.lateArrivals || 0} Late
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {emp.isPresent ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                <span className="text-sm">✓</span> Present
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                Absent
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            {Math.round(emp.attendancePercentage)}% attendance
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}
