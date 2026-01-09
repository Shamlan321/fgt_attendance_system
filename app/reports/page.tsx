'use client';

import { useState } from 'react';

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);

    const handleDownload = async (type: string) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/export?type=${type}`);

            if (!response.ok) {
                throw new Error('Export failed');
            }

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            const filename = contentDisposition
                ? contentDisposition.split('filename=')[1].replace(/"/g, '')
                : `attendance_${type}.xlsx`;

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download report');
        } finally {
            setLoading(false);
        }
    };

    const reportTypes = [
        {
            type: 'today',
            title: 'Today\'s Attendance',
            description: 'Download attendance for today',
            icon: '📅',
            color: 'from-blue-400 to-blue-600'
        },
        {
            type: 'week',
            title: 'This Week',
            description: 'Download attendance for current week',
            icon: '📊',
            color: 'from-purple-400 to-purple-600'
        },
        {
            type: 'month',
            title: 'This Month',
            description: 'Download attendance for current month',
            icon: '📈',
            color: 'from-green-400 to-green-600'
        },
        {
            type: 'all',
            title: 'All Time',
            description: 'Download complete attendance history',
            icon: '📚',
            color: 'from-orange-400 to-orange-600'
        }
    ];

    return (
        <main className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm p-6 sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
                <p className="text-sm text-gray-500">Download attendance reports as Excel</p>
            </div>

            <div className="p-4 space-y-4 max-w-md mx-auto">
                {/* Info Card */}
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="text-4xl">📄</div>
                        <div>
                            <h3 className="font-semibold text-lg">Excel Reports</h3>
                            <p className="text-blue-100 text-sm">Select a time period to download</p>
                        </div>
                    </div>
                </div>

                {/* Report Options */}
                <div className="space-y-3">
                    {reportTypes.map((report) => (
                        <button
                            key={report.type}
                            onClick={() => handleDownload(report.type)}
                            disabled={loading}
                            className="w-full bg-white rounded-xl p-5 shadow-md border border-gray-100 hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${report.color} flex items-center justify-center text-2xl shadow-md`}>
                                        {report.icon}
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-semibold text-gray-900">{report.title}</h3>
                                        <p className="text-sm text-gray-500">{report.description}</p>
                                    </div>
                                </div>
                                <div className="text-gray-400">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {loading && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 shadow-2xl">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="text-gray-800 font-medium">Generating report...</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100">
                    <h3 className="font-semibold text-gray-800 mb-2">📋 How it works</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>Select a time period from the options above</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>Excel file will download automatically</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>Open with Excel, Google Sheets, or any spreadsheet app</span>
                        </li>
                    </ul>
                </div>
            </div>
        </main>
    );
}
