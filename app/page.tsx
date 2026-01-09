import { fetchLatestAttendance, fetchStats } from '@/app/lib/data';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const latestLogs = await fetchLatestAttendance();
  const stats = await fetchStats();

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm p-6 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500">{new Date().toDateString()}</p>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
            <p className="text-blue-100 text-sm font-medium">Present Today</p>
            <p className="text-4xl font-bold mt-2">{stats.todayValues}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-md">
            <p className="text-gray-500 text-sm font-medium">Total Entries</p>
            <p className="text-4xl font-bold mt-2 text-gray-800">{stats.totalEntries}</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            {latestLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <p>No attendance records yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {latestLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {log.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{log.name}</p>
                        <p className="text-xs text-gray-500">{log.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
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
