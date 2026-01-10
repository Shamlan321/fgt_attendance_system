import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('x-api-key');
        if (authHeader !== process.env.API_SECRET_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // Get Python server URL from environment
        const pythonServerUrl = process.env.PYTHON_SERVER_URL || 'http://localhost:5000';

        // Forward request to Python registration server
        const response = await fetch(`${pythonServerUrl}/register-employee`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.API_SECRET_KEY || ''
            },
            body: JSON.stringify({ name })
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to connect to registration server. Ensure Python server is running.'
        }, { status: 500 });
    }
}
