import { mockStore } from '@/app/lib/mock-store';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const employees = mockStore.getAllEmployeeStats();
        return NextResponse.json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
