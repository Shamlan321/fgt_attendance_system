'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AddEmployeePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        message: string;
        image?: string;
    } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            alert('Please enter a name');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/register-employee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'secret_key_123'
                },
                body: JSON.stringify({ name: name.trim() })
            });

            const data = await response.json();
            setResult(data);

            if (data.success) {
                // Wait 3 seconds then redirect to employees page
                setTimeout(() => {
                    router.push('/employees');
                }, 3000);
            }
        } catch (error) {
            setResult({
                success: false,
                message: 'Failed to connect to server. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm p-6 sticky top-0 z-10">
                <Link href="/employees" className="text-blue-600 text-sm font-medium mb-2 inline-block">
                    ← Back to Employees
                </Link>
                <h1 className="text-2xl font-bold text-gray-800">Add New Employee</h1>
                <p className="text-sm text-gray-500">Register a new employee via camera</p>
            </div>

            <div className="p-4 max-w-md mx-auto">
                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">📋 Instructions</h3>
                    <ol className="text-sm text-blue-800 space-y-1">
                        <li>1. Enter the employee's name below</li>
                        <li>2. Click "Register Employee"</li>
                        <li>3. Employee should stand in front of the camera</li>
                        <li>4. Wait for face capture confirmation</li>
                    </ol>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Employee Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter full name"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !name.trim()}
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? 'Registering...' : 'Register Employee'}
                    </button>
                </form>

                {/* Loading State */}
                {loading && (
                    <div className="mt-6 bg-white rounded-2xl p-8 shadow-lg border border-gray-100 text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-700 font-medium">Capturing face...</p>
                        <p className="text-sm text-gray-500 mt-2">Please look at the camera</p>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className={`mt-6 rounded-2xl p-6 shadow-lg border ${result.success
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">
                                {result.success ? '✅' : '❌'}
                            </span>
                            <div>
                                <h3 className={`font-semibold ${result.success ? 'text-green-900' : 'text-red-900'
                                    }`}>
                                    {result.success ? 'Success!' : 'Registration Failed'}
                                </h3>
                                <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                    {result.message}
                                </p>
                            </div>
                        </div>

                        {/* Image Preview */}
                        {result.success && result.image && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Captured Image:</p>
                                <img
                                    src={`data:image/jpeg;base64,${result.image}`}
                                    alt="Captured face"
                                    className="w-full rounded-lg border-2 border-green-300"
                                />
                                <p className="text-xs text-green-600 mt-2 text-center">
                                    Redirecting to employees page...
                                </p>
                            </div>
                        )}

                        {!result.success && (
                            <button
                                onClick={() => setResult(null)}
                                className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
                            >
                                Try Again
                            </button>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
