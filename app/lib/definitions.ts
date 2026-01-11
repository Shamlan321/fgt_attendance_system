export type AttendanceLog = {
  id: string;
  name: string;
  date: string;
  time: string;
  type?: 'check_in' | 'check_out'; // New field
  synced_at: string;
};

export type Employee = {
  id: string;
  name: string;
  created_at: Date;
};
