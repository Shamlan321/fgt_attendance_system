import { sql } from '@vercel/postgres';

export async function createTables() {
    try {
        await sql`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        date VARCHAR(10) NOT NULL,
        time VARCHAR(8) NOT NULL,
        synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
        console.log('Created "attendance_logs" table');
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
}
