import { createTables } from '@/app/lib/db-init';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        await createTables();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
