'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        standard_check_in: '09:00',
        standard_check_out: '17:00',
        overtime_threshold: '20:00'
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('system_settings')
                .select('*');

            if (error) {
                // If table doesn't exist yet, we might get an error, ignore for now
                console.error(error);
            }

            if (data) {
                const newSettings = { ...settings };
                data.forEach((item: any) => {
                    if (item.value) newSettings[item.key as keyof typeof settings] = item.value;
                });
                setSettings(newSettings);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
                setMessage({ type: 'success', text: 'Settings saved (Mock Mode)' });
                setSaving(false);
                return;
            }

            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value
            }));

            const { error } = await supabase
                .from('system_settings')
                .upsert(updates);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Settings updated successfully!' });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Failed to update settings.' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-gray-50 pb-20">
            <div className="bg-white shadow-sm p-6 sticky top-0 z-10 mb-6">
                <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>
                <p className="text-sm text-gray-500">Configure global attendance rules</p>
            </div>

            <div className="max-w-2xl mx-auto px-4">
                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">

                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Time Configuration</h2>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Standard Check-in Time
                                </label>
                                <input
                                    type="time"
                                    value={settings.standard_check_in}
                                    onChange={e => setSettings({ ...settings, standard_check_in: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">Expected arrival time</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Standard Check-out Time
                                </label>
                                <input
                                    type="time"
                                    value={settings.standard_check_out}
                                    onChange={e => setSettings({ ...settings, standard_check_out: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">Expected departure time</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Overtime Rules</h2>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Overtime Threshold (Max Time)
                            </label>
                            <input
                                type="time"
                                value={settings.overtime_threshold}
                                onChange={e => setSettings({ ...settings, overtime_threshold: e.target.value })}
                                className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Any work logged after this time will be capped to this time for overtime calculation.
                                (e.g., if set to 20:00, checking out at 21:00 counts as 20:00)
                            </p>
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading || saving}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
