import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { mockStore } from '@/app/lib/mock-store';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('x-api-key');
        if (authHeader !== process.env.API_SECRET_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, date, time } = body;

        if (!name || !date || !time) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            console.log(`[MOCK DB] Inserted attendance: ${name}, ${date}, ${time}`);
            mockStore.addLog({ name, date, time });
            return NextResponse.json({ success: true, mock: true }, { status: 200 });
        }

        // Insert into Supabase
        const { error } = await supabase
            .from('attendance_logs')
            .insert([{ name, date, time }]);

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
