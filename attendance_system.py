import cv2
import mediapipe as mp
import face_recognition
import numpy as np
import pickle
import os
from datetime import datetime
import pandas as pd
from openpyxl import load_workbook
from pathlib import Path
import threading
import time
import tkinter as tk
from tkinter import messagebox, simpledialog, ttk
from PIL import Image, ImageTk
import json

# ========== CONFIGURATION ==========
SHOW_DISPLAY = True
# ==================================

# Local backup manager for daily CSV files
class LocalBackupManager:
    # ... (same as before)
    def __init__(self):
        self.backup_dir = "attendance_logs"
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)
    
    def save_daily_attendance(self, name, date_str, time_str, log_type='check_in'):
        """Save attendance to daily CSV file in single-row format"""
        filename = os.path.join(self.backup_dir, f"attendance_{date_str}.csv")
        
        try:
            if os.path.exists(filename):
                df = pd.read_csv(filename)
            else:
                df = pd.DataFrame(columns=['Name', 'Date', 'Check-In', 'Check-Out'])
            
            # Find existing row for this employee
            mask = (df['Name'] == name) & (df['Date'] == date_str)
            
            if mask.any():
                idx = df[mask].index[0]
                if log_type == 'check_in':
                    df.loc[idx, 'Check-In'] = time_str
                else:
                    df.loc[idx, 'Check-Out'] = time_str
            else:
                new_row = {
                    'Name': name,
                    'Date': date_str,
                    'Check-In': time_str if log_type == 'check_in' else None,
                    'Check-Out': time_str if log_type == 'check_out' else None
                }
                df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            
            df.to_csv(filename, index=False)
            print(f" [Backup] Updated {filename}")
        except Exception as e:
            print(f" [Backup] Error updating {filename}: {e}")

class SettingsManager:
    def __init__(self):
        self.settings_file = "settings.json"
        self.defaults = {
            "standard_check_in": "09:00",
            "standard_check_out": "17:00",
            "overtime_threshold": 1.0, # Hours
            "cooldown_minutes": 10,
            "enable_cooldown": True
        }
        self.data = self.load()

    def load(self):
        if os.path.exists(self.settings_file):
            try:
                with open(self.settings_file, 'r') as f:
                    return {**self.defaults, **json.load(f)}
            except:
                return self.defaults
        return self.defaults

    def save(self, data):
        self.data = data
        with open(self.settings_file, 'w') as f:
            json.dump(data, f, indent=4)

class AttendanceSystem:
    def __init__(self, log_widget=None):
        # Initialize MediaPipe Face Detection
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_drawing = mp.solutions.drawing_utils
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5
        )
        
        self.log_widget = log_widget
        
        # Storage paths
        self.encodings_file = "face_encodings.pkl"
        self.attendance_file = "attendance.xlsx"
        self.rates_file = "employee_rates.xlsx"
        
        # Load existing encodings
        self.known_face_encodings = []
        self.known_face_names = []
        self.load_encodings()
        self.load_or_create_attendance_file()
        self.load_or_create_rates_file()
        
        # Track attendance state
        self.employee_state = {}
        self.COOLDOWN_MINUTES = 10
        self.PROCESS_STRIDE = 5
        self.frame_count = 0
        self.last_face_locations = []
        self.last_face_names = []
        
        # Initialize Local Backup Manager
        self.backup_manager = LocalBackupManager()
        self.settings_manager = SettingsManager()
        
        # Camera and running state
        self.cap = None
        self.running = False
        self.registration_mode = False
        self.reg_name = ""
        self.reg_countdown = 0
        self.last_frame = None
        
        # Attendance trigger state
        self.attendance_trigger = False
        self.attendance_countdown = 0
        self.trigger_cooldown = 0
        self.success_msg_timer = 0

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        full_msg = f"[{timestamp}] {message}\n"
        print(full_msg.strip())
        if self.log_widget:
            self.log_widget.insert(tk.END, full_msg)
            self.log_widget.see(tk.END)

    def load_encodings(self):
        if os.path.exists(self.encodings_file):
            try:
                with open(self.encodings_file, 'rb') as f:
                    data = pickle.load(f)
                    self.known_face_encodings = data['encodings']
                    self.known_face_names = data['names']
                print(f"Loaded {len(self.known_face_names)} face encodings")
            except Exception as e:
                print(f"Error loading encodings: {e}")

    def save_encodings(self):
        data = {'encodings': self.known_face_encodings, 'names': self.known_face_names}
        with open(self.encodings_file, 'wb') as f:
            pickle.dump(data, f)
        self.log(f"Saved {len(self.known_face_names)} face encodings")

    def load_or_create_attendance_file(self):
        """Load attendance data or create new file with proper structure"""
        if not os.path.exists(self.attendance_file):
            df = pd.DataFrame(columns=['Name', 'Date', 'Check-In', 'Check-Out', 'Hours', 'Overtime'])
            # Ensure columns have correct initial dtypes to avoid FutureWarnings
            df = df.astype({'Hours': 'float64', 'Overtime': 'float64'})
            df.to_excel(self.attendance_file, index=False)
            self.log("Created new attendance database")
        else:
            # Verify structure and migrate if needed
            try:
                df = pd.read_excel(self.attendance_file)
                # Check if old format (has 'Type' column)
                if 'Type' in df.columns:
                    self.log("Migrating old attendance format...")
                    self.migrate_attendance_data(df)
            except Exception as e:
                self.log(f"Error loading attendance: {e}")

    def migrate_attendance_data(self, old_df):
        """Convert old format (separate check-in/out rows) to new format (single row)"""
        new_data = []
        grouped = old_df.groupby(['Name', 'Date'])
        
        for (name, date), group in grouped:
            check_in_row = group[group['Type'] == 'check_in'].iloc[0] if not group[group['Type'] == 'check_in'].empty else None
            check_out_row = group[group['Type'] == 'check_out'].iloc[-1] if not group[group['Type'] == 'check_out'].empty else None
            
            check_in_time = check_in_row['Time'] if check_in_row is not None else None
            check_out_time = check_out_row['Time'] if check_out_row is not None else None
            
            hours = 0
            overtime = 0
            if check_in_time and check_out_time:
                try:
                    in_dt = datetime.strptime(str(check_in_time), "%H:%M:%S")
                    out_dt = datetime.strptime(str(check_out_time), "%H:%M:%S")
                    hours = (out_dt - in_dt).total_seconds() / 3600
                except:
                    pass
            
            new_data.append({
                'Name': name,
                'Date': date,
                'Check-In': check_in_time,
                'Check-Out': check_out_time,
                'Hours': round(hours, 2),
                'Overtime': overtime
            })
        
        new_df = pd.DataFrame(new_data)
        new_df.to_excel(self.attendance_file, index=False)
        self.log("Migration completed")

    def load_or_create_rates_file(self):
        """Load employee rates or create new file"""
        if not os.path.exists(self.rates_file):
            df = pd.DataFrame(columns=['Name', 'Hourly_Rate', 'Overtime_Rate'])
            df.to_excel(self.rates_file, index=False)
            self.log("Created employee rates database")

    def mark_attendance(self, name):
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        
        if name not in self.employee_state:
            self.employee_state[name] = {'last_log_time': None, 'status': 'out', 'today_date': date_str}
        
        state = self.employee_state[name]
        if state['today_date'] != date_str:
            state['last_log_time'] = None
            state['status'] = 'out'
            state['today_date'] = date_str
            
        last_log = state['last_log_time']
        settings = self.settings_manager.data
        
        if settings.get("enable_cooldown", True) and last_log:
            time_diff = (now - last_log).total_seconds() / 60
            if time_diff < settings.get("cooldown_minutes", 10):
                self.log(f"Cooldown active for {name}. Wait {int(settings.get('cooldown_minutes', 10) - time_diff)}m")
                return False
        
        log_type = 'check_out' if state['status'] == 'in' else 'check_in'
        if log_type == 'check_in': state['status'] = 'in'
        else: state['status'] = 'out'
        
        state['last_log_time'] = now
        
        # Update Excel with single-row-per-day format
        try:
            df = pd.read_excel(self.attendance_file)
            
            # Find existing row for this employee and date
            existing_mask = (df['Name'] == name) & (df['Date'] == date_str)
            
            if existing_mask.any():
                # Update existing row
                idx = df[existing_mask].index[0]
                if log_type == 'check_in':
                    df.loc[idx, 'Check-In'] = str(time_str)
                else:
                    df.loc[idx, 'Check-Out'] = str(time_str)
                    # Calculate hours
                    check_in = df.at[idx, 'Check-In']
                    if pd.notna(check_in):
                        in_dt = datetime.strptime(str(check_in), "%H:%M:%S")
                        out_dt = datetime.strptime(time_str, "%H:%M:%S")
                        hours = (out_dt - in_dt).total_seconds() / 3600
                        df.loc[idx, 'Hours'] = float(round(hours, 2))
                        
                        # Calculate overtime
                        std_out = datetime.strptime(settings.get("standard_check_out", "17:00"), "%H:%M").time()
                        if out_dt.time() > std_out:
                            std_out_dt = out_dt.replace(hour=std_out.hour, minute=std_out.minute, second=0)
                            ot_hours = (out_dt - std_out_dt).total_seconds() / 3600
                            if ot_hours >= settings.get("overtime_threshold", 1.0):
                                df.loc[idx, 'Overtime'] = float(round(ot_hours, 2))
            else:
                # Create new row
                new_row = {
                    'Name': name,
                    'Date': date_str,
                    'Check-In': time_str if log_type == 'check_in' else None,
                    'Check-Out': time_str if log_type == 'check_out' else None,
                    'Hours': 0,
                    'Overtime': 0
                }
                df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            
            df.to_excel(self.attendance_file, index=False)
            self.log(f"Marked {name} ({log_type})")
        except Exception as e:
            self.log(f"Excel Error: {e}")
        
        self.backup_manager.save_daily_attendance(name, date_str, time_str, log_type)
        self.success_msg_timer = 2.0
        return True

    def get_today_status(self):
        """Get status of all unique registered employees for today"""
        today = datetime.now().strftime("%Y-%m-%d")
        unique_names = sorted(list(set(self.known_face_names)))
        status_dict = {name: "Absent" for name in unique_names}
        
        try:
            if os.path.exists(self.attendance_file):
                df = pd.read_excel(self.attendance_file)
                today_df = df[df['Date'] == today]
                for name in today_df['Name'].unique():
                    if name in status_dict:
                        # Check if they have a check-in
                        emp_today = today_df[today_df['Name'] == name]
                        if emp_today['Check-In'].notna().any():
                            status_dict[name] = "Present"
        except Exception as e:
            print(f"Error fetching status: {e}")
        return status_dict

    def calculate_stats(self, start_date=None, end_date=None):
        """Calculate work hours, late arrivals, and overtime from excel with date filtering"""
        if not os.path.exists(self.attendance_file):
            return "No attendance data found."

        try:
            df = pd.read_excel(self.attendance_file)
            
            # Filter by date if provided
            if start_date:
                df = df[df['Date'] >= start_date]
            if end_date:
                df = df[df['Date'] <= end_date]

            if df.empty:
                return "No data found for the selected range."

            settings = self.settings_manager.data
            std_in = datetime.strptime(settings["standard_check_in"], "%H:%M").time()
            std_out = datetime.strptime(settings["standard_check_out"], "%H:%M").time()
            ov_thresh = settings["overtime_threshold"]

            summary = []
            grouped = df.groupby(['Name', 'Date'])

            for (name, date), group in grouped:
                # Sort by time to find first check-in and last check-out
                group = group.sort_values(by='Time')
                check_in_row = group[group['Type'] == 'check_in'].iloc[0] if not group[group['Type'] == 'check_in'].empty else None
                check_out_row = group[group['Type'] == 'check_out'].iloc[-1] if not group[group['Type'] == 'check_out'].empty else None

                if check_in_row is None: continue

                actual_in = datetime.strptime(str(check_in_row['Time']), "%H:%M:%S").time()
                is_late = actual_in > std_in

                hours_worked = 0
                overtime = 0
                if check_out_row is not None:
                    actual_out = datetime.strptime(str(check_out_row['Time']), "%H:%M:%S")
                    in_time = datetime.strptime(str(check_in_row['Time']), "%H:%M:%S")
                    hours_worked = (actual_out - in_time).total_seconds() / 3600
                    
                    # Overtime calculation
                    std_out_dt = actual_out.replace(hour=std_out.hour, minute=std_out.minute, second=0)
                    if actual_out > std_out_dt:
                        ot_val = (actual_out - std_out_dt).total_seconds() / 3600
                        if ot_val >= ov_thresh:
                            overtime = ot_val

                summary.append({
                    "Name": name, "Date": date, "Check-In": actual_in.strftime("%H:%M:%S"),
                    "Check-Out": actual_out.strftime("%H:%M:%S") if check_out_row is not None else "N/A",
                    "Hours": round(hours_worked, 2), "Late": "Yes" if is_late else "No",
                    "Overtime": round(overtime, 2)
                })

            report_df = pd.DataFrame(summary)
            report_name = f"attendance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            report_df.to_excel(report_name, index=False)
            return f"Report generated: {report_name}"

        except Exception as e:
            return f"Error: {e}"

    def get_employee_summary(self):
        """Get quick summary of all employees"""
        if not os.path.exists(self.attendance_file):
            return "No data."
        
        try:
            df = pd.read_excel(self.attendance_file)
            names = df['Name'].unique()
            result = "EMPLOYEE SUMMARY:\n"
            for name in names:
                emp_df = df[df['Name'] == name]
                days = emp_df['Date'].nunique()
                result += f"• {name}: {days} days present\n"
            return result
        except:
            return "Error reading summary."

    def run_attendance_loop(self, label_widget):
        """Main attendance loop to be run in a thread"""
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.running = True
        self.last_time = time.time()
        
        while self.running:
            ret, frame = self.cap.read()
            if not ret: continue
            
            self.last_frame = frame.copy()
            display_frame = frame.copy()
            
            # Display info on feed
            cv2.putText(display_frame, f"Registered: {len(self.known_face_names)}", 
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            present_count = sum(1 for state in self.employee_state.values() if state['today_date'] == datetime.now().strftime("%Y-%m-%d") and state['status'] == 'in')
            cv2.putText(display_frame, f"Today Present: {present_count}", 
                       (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Time delta calculation for countdowns
            curr_time = time.time()
            dt = curr_time - self.last_time
            self.last_time = curr_time

            if self.registration_mode:
                # Registration Logic
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.face_detection.process(rgb_frame)
                
                results = self.face_detection.process(rgb_frame)
                
                msg = f"Registering: {self.reg_name}"
                color = (0, 255, 255)
                
                if self.reg_countdown > 0:
                    msg += f" | Capturing in {int(self.reg_countdown + 1)}s"
                    self.reg_countdown -= dt
                    if self.reg_countdown <= 0:
                        # Capture logic
                        face_locations = face_recognition.face_locations(rgb_frame)
                        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
                        if face_encodings:
                            self.known_face_encodings.append(face_encodings[0])
                            self.known_face_names.append(self.reg_name)
                            self.save_encodings()
                            messagebox.showinfo("Success", f"Registered {self.reg_name}")
                            self.registration_mode = False
                        else:
                            messagebox.showerror("Error", "No face detected. Try again.")
                            self.registration_mode = False
                
                cv2.putText(display_frame, msg, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                if results.detections:
                    for detection in results.detections:
                        self.mp_drawing.draw_detection(display_frame, detection)
            else:
                # Normal Attendance Logic (Runs every frame for visual feedback)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Show detection boxes every frame for feedback, but process name less often
                if self.frame_count % self.PROCESS_STRIDE == 0:
                    self.last_face_locations = []
                    self.last_face_names = []
                    results = self.face_detection.process(rgb_frame)
                    
                    if results.detections:
                        h, w, _ = frame.shape
                        raw_face_locations = []
                        for detection in results.detections:
                            bbox = detection.location_data.relative_bounding_box
                            top = max(0, int(bbox.ymin * h))
                            right = min(w, int((bbox.xmin + bbox.width) * w))
                            bottom = min(h, int((bbox.ymin + bbox.height) * h))
                            left = max(0, int(bbox.xmin * w))
                            raw_face_locations.append((top, right, bottom, left))
                        
                        self.last_face_locations = raw_face_locations
                        if raw_face_locations:
                            encodings = face_recognition.face_encodings(rgb_frame, raw_face_locations)
                            for encoding in encodings:
                                matches = face_recognition.compare_faces(self.known_face_encodings, encoding, tolerance=0.6)
                                name = "Unknown"
                                if True in matches:
                                    best_match = np.argmin(face_recognition.face_distance(self.known_face_encodings, encoding))
                                    if matches[best_match]:
                                        name = self.known_face_names[best_match]
                                self.last_face_names.append(name)

                h, w, _ = display_frame.shape

                # Handle Attendance Trigger & Countdown
                if self.attendance_trigger:
                    self.attendance_countdown -= dt
                    
                    # Display HUGE countdown
                    count_text = str(int(max(1, self.attendance_countdown + 1)))
                    cv2.putText(display_frame, count_text, (w//2-50, h//2+50), 
                               cv2.FONT_HERSHEY_SIMPLEX, 5.0, (0, 255, 255), 10)
                    cv2.putText(display_frame, "HOLD STILL...", (w//2-100, h//2+120), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 3)

                    if self.attendance_countdown <= 0:
                        self.attendance_trigger = False
                        # Now mark attendance for whoever is currently in names list
                        found_any = False
                        for name in self.last_face_names:
                            if name != "Unknown":
                                if self.mark_attendance(name):
                                    found_any = True
                                    self.log(f"CONFIRMED: {name}")
                        
                        if not found_any:
                            self.log("Marking failed: No recognized face in frame.")
                
                # Show Success Checkmark if active
                if self.success_msg_timer > 0:
                    self.success_msg_timer -= dt
                    h, w, _ = display_frame.shape
                    # Draw a big green checkmark (simplified as a large 'V' shape or text)
                    cv2.putText(display_frame, "DONE", (w//2-100, h//2), 
                               cv2.FONT_HERSHEY_SIMPLEX, 3.0, (0, 255, 0), 10)
                    # Drawing a checkmark with lines
                    pts = np.array([[w//2-50, h//2+50], [w//2, h//2+100], [w//2+100, h//2-50]], np.int32)
                    cv2.polylines(display_frame, [pts], False, (0, 255, 0), 15)
                
                if not self.attendance_trigger:
                    # Instructions
                    cv2.putText(display_frame, "Press SPACE to mark attendance", 
                               (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                self.frame_count += 1
                for (top, right, bottom, left), name in zip(self.last_face_locations, self.last_face_names):
                    color = (0, 0, 255) if name == "Unknown" else (0, 255, 0)
                    cv2.rectangle(display_frame, (left, top), (right, bottom), color, 2)
                    cv2.putText(display_frame, name, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1)

            # Update TK Image
            img = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(img)
            imgtk = ImageTk.PhotoImage(image=img)
            label_widget.imgtk = imgtk
            label_widget.configure(image=imgtk)
            time.sleep(0.01)

    def open_logs_folder(self):
        """Open the folder containing logs and reports"""
        path = os.getcwd()
        if os.name == 'nt': # Windows
            os.startfile(path)
        elif os.name == 'posix': # Linux/Mac
            import subprocess
            subprocess.Popen(['xdg-open', path])
        self.log("Opening App Directory...")

    def trigger_report_ui(self):
        """Ask for date range before generating report"""
        start = simpledialog.askstring("Report", "Start Date (YYYY-MM-DD) or leave blank:")
        end = simpledialog.askstring("Report", "End Date (YYYY-MM-DD) or leave blank:")
        self.log(self.calculate_stats(start, end))

    def trigger_registration(self):
        name = simpledialog.askstring("Register", "Enter Employee Name:")
        if name:
            if name in self.known_face_names:
                messagebox.showwarning("Warning", "Employee already exists.")
                return
            self.reg_name = name
            self.reg_countdown = 5.0
            self.registration_mode = True

    def add_manual_log(self):
        """Manually add an attendance entry"""
        if not self.known_face_names:
            messagebox.showerror("Error", "No employees registered.")
            return

        dialog = tk.Toplevel()
        dialog.title("Manual Entry")
        dialog.geometry("300x300")

        tk.Label(dialog, text="Select Employee:").pack(pady=5)
        name_var = tk.StringVar(value=self.known_face_names[0])
        name_cb = ttk.Combobox(dialog, textvariable=name_var, values=self.known_face_names)
        name_cb.pack()

        tk.Label(dialog, text="Date (YYYY-MM-DD):").pack(pady=5)
        ent_date = tk.Entry(dialog)
        ent_date.insert(0, datetime.now().strftime("%Y-%m-%d"))
        ent_date.pack()

        tk.Label(dialog, text="Time (HH:MM:SS):").pack(pady=5)
        ent_time = tk.Entry(dialog)
        ent_time.insert(0, datetime.now().strftime("%H:%M:%S"))
        ent_time.pack()

        tk.Label(dialog, text="Type:").pack(pady=5)
        type_var = tk.StringVar(value="check_in")
        ttk.Radiobutton(dialog, text="Check In", variable=type_var, value="check_in").pack()
        ttk.Radiobutton(dialog, text="Check Out", variable=type_var, value="check_out").pack()

        def submit():
            name = name_var.get()
            d_str = ent_date.get()
            t_str = ent_time.get()
            l_type = type_var.get()
            
            try:
                datetime.strptime(d_str, "%Y-%m-%d")
                datetime.strptime(t_str, "%H:%M:%S")
                
                # Append to Excel
                if os.path.exists(self.attendance_file):
                    df = pd.read_excel(self.attendance_file)
                else:
                    df = pd.DataFrame(columns=['Name', 'Date', 'Time', 'Type'])
                
                new_entry = pd.DataFrame({'Name': [name], 'Date': [d_str], 'Time': [t_str], 'Type': [l_type]})
                df = pd.concat([df, new_entry], ignore_index=True)
                df.to_excel(self.attendance_file, index=False)
                
                self.log(f"Manual Entry: {name} ({l_type}) on {d_str}")
                dialog.destroy()
            except Exception as e:
                messagebox.showerror("Error", f"Invalid format or error: {e}")

        tk.Button(dialog, text="Submit", command=submit, bg="#4CAF50", fg="white").pack(pady=20)

    def delete_employee(self):
        """Delete an employee and their face encodings"""
        if not self.known_face_names:
            return

        name = simpledialog.askstring("Delete", "Enter Name to Delete:")
        if name and name in self.known_face_names:
            if messagebox.askyesno("Confirm", f"Delete all data for {name}?"):
                indices = [i for i, x in enumerate(self.known_face_names) if x == name]
                for i in sorted(indices, reverse=True):
                    self.known_face_names.pop(i)
                    self.known_face_encodings.pop(i)
                self.save_encodings()
                self.log(f"Deleted Employee: {name}")

    def manage_hourly_rates(self):
        """UI to manage employee hourly rates"""
        if not self.known_face_names:
            messagebox.showerror("Error", "No employees registered.")
            return

        dialog = tk.Toplevel()
        dialog.title("Manage Hourly Rates")
        dialog.geometry("400x300")

        tk.Label(dialog, text="Select Employee:", font=("Arial", 12, "bold")).pack(pady=10)
        name_var = tk.StringVar(value=self.known_face_names[0])
        name_cb = ttk.Combobox(dialog, textvariable=name_var, values=self.known_face_names, width=30)
        name_cb.pack(pady=5)

        # Load existing rates if any
        def load_rates():
            try:
                df = pd.read_excel(self.rates_file)
                selected = name_var.get()
                row = df[df['Name'] == selected]
                if not row.empty:
                    ent_hourly.delete(0, tk.END)
                    ent_hourly.insert(0, str(row.iloc[0]['Hourly_Rate']))
                    ent_ot.delete(0, tk.END)
                    if pd.notna(row.iloc[0]['Overtime_Rate']):
                        ent_ot.insert(0, str(row.iloc[0]['Overtime_Rate']))
                else:
                    ent_hourly.delete(0, tk.END)
                    ent_ot.delete(0, tk.END)
            except:
                pass

        tk.Label(dialog, text="Hourly Rate ($):").pack(pady=5)
        ent_hourly = tk.Entry(dialog, width=20)
        ent_hourly.pack()

        tk.Label(dialog, text="Overtime Rate ($) [Optional]:").pack(pady=5)
        ent_ot = tk.Entry(dialog, width=20)
        ent_ot.pack()
        tk.Label(dialog, text="Leave blank to use standard rate", font=("Arial", 8), fg="gray").pack()

        name_cb.bind('<<ComboboxSelected>>', lambda e: load_rates())
        load_rates()  # Load initial

        def save_rate():
            try:
                df = pd.read_excel(self.rates_file)
                selected = name_var.get()
                hourly = float(ent_hourly.get()) if ent_hourly.get() else 0
                ot_rate = float(ent_ot.get()) if ent_ot.get() else hourly

                # Update or add
                existing = df[df['Name'] == selected]
                if not existing.empty:
                    idx = existing.index[0]
                    df.at[idx, 'Hourly_Rate'] = hourly
                    df.at[idx, 'Overtime_Rate'] = ot_rate
                else:
                    new_row = pd.DataFrame([{'Name': selected, 'Hourly_Rate': hourly, 'Overtime_Rate': ot_rate}])
                    df = pd.concat([df, new_row], ignore_index=True)

                df.to_excel(self.rates_file, index=False)
                self.log(f"Updated rates for {selected}")
                messagebox.showinfo("Success", f"Rates saved for {selected}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save: {e}")

        tk.Button(dialog, text="Save Rates", command=save_rate, bg="#4CAF50", fg="white", width=15).pack(pady=20)

    def generate_salary_sheet(self):
        """Generate salary sheet for a date range"""
        start_date = simpledialog.askstring("Salary Sheet", "Start Date (YYYY-MM-DD):")
        end_date = simpledialog.askstring("Salary Sheet", "End Date (YYYY-MM-DD):")
        
        if not start_date or not end_date:
            return
        
        try:
            # Read attendance and rates
            att_df = pd.read_excel(self.attendance_file)
            rates_df = pd.read_excel(self.rates_file)
            
            # Filter by date range
            att_df = att_df[(att_df['Date'] >= start_date) & (att_df['Date'] <= end_date)]
            
            if att_df.empty:
                messagebox.showwarning("No Data", "No attendance records in this range.")
                return
            
            # Calculate salaries
            salary_data = []
            for name in att_df['Name'].unique():
                emp_data = att_df[att_df['Name'] == name]
                total_hours = emp_data['Hours'].sum()
                total_ot = emp_data['Overtime'].sum()
                
                # Get rates
                rate_row = rates_df[rates_df['Name'] == name]
                if rate_row.empty:
                    self.log(f"No rate set for {name}, skipping...")
                    continue
                
                hourly_rate = rate_row.iloc[0]['Hourly_Rate']
                ot_rate = rate_row.iloc[0]['Overtime_Rate']
                if pd.isna(ot_rate):
                    ot_rate = hourly_rate
                
                # Calculate pay
                regular_pay = (total_hours - total_ot) * hourly_rate
                ot_pay = total_ot * ot_rate
                total_pay = regular_pay + ot_pay
                
                salary_data.append({
                    'Employee': name,
                    'Total Hours': round(total_hours, 2),
                    'Regular Hours': round(total_hours - total_ot, 2),
                    'Overtime Hours': round(total_ot, 2),
                    'Hourly Rate': hourly_rate,
                    'OT Rate': ot_rate,
                    'Regular Pay': round(regular_pay, 2),
                    'Overtime Pay': round(ot_pay, 2),
                    'Total Pay': round(total_pay, 2)
                })
            
            if not salary_data:
                messagebox.showwarning("Error", "No employees with rates found.")
                return
            
            # Save salary sheet
            salary_df = pd.DataFrame(salary_data)
            filename = f"salary_sheet_{start_date}_to_{end_date}.xlsx"
            salary_df.to_excel(filename, index=False)
            
            self.log(f"Salary sheet generated: {filename}")
            messagebox.showinfo("Success", f"Salary sheet saved:\n{filename}")
            
        except Exception as e:
            self.log(f"Salary generation error: {e}")
            messagebox.showerror("Error", f"Failed to generate salary sheet:\n{e}")

    def open_settings(self, root):
        settings_win = tk.Toplevel(root)
        settings_win.title("System Settings")
        settings_win.geometry("300x250")
        
        data = self.settings_manager.data
        
        tk.Label(settings_win, text="Check-In (HH:MM):").pack(pady=5)
        ent_in = tk.Entry(settings_win)
        ent_in.insert(0, data["standard_check_in"])
        ent_in.pack()
        
        tk.Label(settings_win, text="Check-Out (HH:MM):").pack(pady=5)
        ent_out = tk.Entry(settings_win)
        ent_out.insert(0, data["standard_check_out"])
        ent_out.pack()
        
        tk.Label(settings_win, text="Overtime Threshold (Hrs):").pack(pady=5)
        ent_ot = tk.Entry(settings_win)
        ent_ot.insert(0, str(data["overtime_threshold"]))
        ent_ot.pack()

        tk.Label(settings_win, text="Cooldown Period (Mins):").pack(pady=5)
        ent_cool = tk.Entry(settings_win)
        ent_cool.insert(0, str(data.get("cooldown_minutes", 10)))
        ent_cool.pack()

        cool_var = tk.BooleanVar(value=data.get("enable_cooldown", True))
        tk.Checkbutton(settings_win, text="Enable Cooldown", variable=cool_var).pack(pady=5)
        
        def save():
            try:
                new_data = {
                    "standard_check_in": ent_in.get(),
                    "standard_check_out": ent_out.get(),
                    "overtime_threshold": float(ent_ot.get()),
                    "cooldown_minutes": int(ent_cool.get()),
                    "enable_cooldown": cool_var.get()
                }
                self.settings_manager.save(new_data)
                self.log("Settings Updated")
                settings_win.destroy()
            except ValueError:
                messagebox.showerror("Error", "Invalid number format.")
            
        tk.Button(settings_win, text="Save", command=save, bg="#2196F3", fg="white").pack(pady=20)

class AttendanceApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Attendance Management System")
        self.root.geometry("1400x750")
        self.root.configure(bg="#1a1a2e")
        
        # Bind Space key
        self.root.bind('<space>', self.on_space_pressed)
        
        # Header
        header = tk.Frame(self.root, bg="#16213e", height=70)
        header.pack(fill=tk.X, side=tk.TOP)
        
        tk.Label(header, text="🏢 Attendance Management System", 
                font=("Segoe UI", 22, "bold"), bg="#16213e", fg="#ffffff").pack(side=tk.LEFT, padx=20, pady=15)
        
        date_label = tk.Label(header, text=datetime.now().strftime("%B %d, %Y"), 
                             font=("Segoe UI", 12), bg="#16213e", fg="#94a3b8")
        date_label.pack(side=tk.RIGHT, padx=20)
        
        # Main Container
        main_container = tk.Frame(self.root, bg="#1a1a2e")
        main_container.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        # ========== LEFT PANEL: Employee Status ==========
        left_panel = tk.Frame(main_container, bg="#0f3460", width=280, relief=tk.FLAT)
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 8))
        left_panel.pack_propagate(False)
        
        # Status Header
        status_header = tk.Frame(left_panel, bg="#16213e", height=60)
        status_header.pack(fill=tk.X)
        tk.Label(status_header, text="📊 Today's Attendance", 
                font=("Segoe UI", 14, "bold"), bg="#16213e", fg="#ffffff").pack(pady=15)
        
        # Scrollable Status List
        canvas_container = tk.Frame(left_panel, bg="#0f3460")
        canvas_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.status_canvas = tk.Canvas(canvas_container, bg="#0f3460", highlightthickness=0)
        status_scrollbar = ttk.Scrollbar(canvas_container, orient="vertical", command=self.status_canvas.yview)
        self.status_scrollable_frame = tk.Frame(self.status_canvas, bg="#0f3460")

        self.status_scrollable_frame.bind(
            "<Configure>",
            lambda e: self.status_canvas.configure(scrollregion=self.status_canvas.bbox("all"))
        )

        self.status_canvas.create_window((0, 0), window=self.status_scrollable_frame, anchor="nw")
        self.status_canvas.configure(yscrollcommand=status_scrollbar.set)

        self.status_canvas.pack(side="left", fill="both", expand=True)
        status_scrollbar.pack(side="right", fill="y")
        
        # ========== CENTER PANEL: Camera Feed ==========
        center_panel = tk.Frame(main_container, bg="#0f3460", width=700)
        center_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=8)
        
        # Camera Header
        cam_header = tk.Frame(center_panel, bg="#16213e", height=60)
        cam_header.pack(fill=tk.X)
        tk.Label(cam_header, text="📹 Live Camera Feed", 
                font=("Segoe UI", 14, "bold"), bg="#16213e", fg="#ffffff").pack(pady=15)
        
        # Camera Display
        cam_frame = tk.Frame(center_panel, bg="#000000")
        cam_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        self.cam_label = tk.Label(cam_frame, bg="#000000", bd=0)
        self.cam_label.pack(fill=tk.BOTH, expand=True)
        
        # Instruction Footer
        instruction_frame = tk.Frame(center_panel, bg="#16213e", height=50)
        instruction_frame.pack(fill=tk.X)
        tk.Label(instruction_frame, text="Press SPACEBAR to mark attendance", 
                font=("Segoe UI", 11), bg="#16213e", fg="#94a3b8").pack(pady=12)
        
        # ========== RIGHT PANEL: Control Panel ==========
        right_panel = tk.Frame(main_container, bg="#0f3460", width=320)
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(8, 0))
        right_panel.pack_propagate(False)
        
        # Control Header
        control_header = tk.Frame(right_panel, bg="#16213e", height=60)
        control_header.pack(fill=tk.X)
        tk.Label(control_header, text="⚙️ Control Panel", 
                font=("Segoe UI", 14, "bold"), bg="#16213e", fg="#ffffff").pack(pady=15)
        
        # Log Area
        log_container = tk.Frame(right_panel, bg="#0f3460")
        log_container.pack(fill=tk.BOTH, expand=True, padx=15, pady=(10, 15))
        
        tk.Label(log_container, text="Activity Log", 
                font=("Segoe UI", 10, "bold"), bg="#0f3460", fg="#94a3b8").pack(anchor=tk.W, pady=(0, 5))
        
        self.log_area = tk.Text(log_container, height=12, width=32, 
                               font=("Consolas", 9), bg="#1a1a2e", fg="#e0e0e0", 
                               relief=tk.FLAT, padx=8, pady=8, wrap=tk.WORD)
        self.log_area.pack(fill=tk.BOTH, expand=True)
        
        # Initialize Backend System
        self.system = AttendanceSystem(log_widget=self.log_area)
        
        # Buttons Container
        buttons_frame = tk.Frame(right_panel, bg="#0f3460")
        buttons_frame.pack(fill=tk.X, padx=15, pady=(0, 15))
        
        # Employee Management Section
        tk.Label(buttons_frame, text="Employee Management", 
                font=("Segoe UI", 9, "bold"), bg="#0f3460", fg="#94a3b8").pack(anchor=tk.W, pady=(5, 8))
        
        self.create_modern_button(buttons_frame, "➕ Register Employee", 
                                 self.system.trigger_registration, "#10b981")
        self.create_modern_button(buttons_frame, "✏️ Manual Entry", 
                                 self.system.add_manual_log, "#6366f1")
        self.create_modern_button(buttons_frame, "🗑️ Delete Employee", 
                                 self.system.delete_employee, "#ef4444")
        
        # HR & Payroll Section
        tk.Label(buttons_frame, text="HR & Payroll", 
                font=("Segoe UI", 9, "bold"), bg="#0f3460", fg="#94a3b8").pack(anchor=tk.W, pady=(15, 8))
        
        self.create_modern_button(buttons_frame, "💰 Hourly Rates", 
                                 self.system.manage_hourly_rates, "#f59e0b")
        self.create_modern_button(buttons_frame, "💵 Salary Sheet", 
                                 self.system.generate_salary_sheet, "#14b8a6")
        
        # Reports & Settings Section
        tk.Label(buttons_frame, text="Reports & Settings", 
                font=("Segoe UI", 9, "bold"), bg="#0f3460", fg="#94a3b8").pack(anchor=tk.W, pady=(15, 8))
        
        self.create_modern_button(buttons_frame, "📊 Generate Report", 
                                 self.system.trigger_report_ui, "#8b5cf6")
        self.create_modern_button(buttons_frame, "📁 Open Logs", 
                                 self.system.open_logs_folder, "#64748b")
        self.create_modern_button(buttons_frame, "📈 Employee Stats", 
                                 lambda: self.system.log(self.system.get_employee_summary()), "#ec4899")
        self.create_modern_button(buttons_frame, "⚙️ Settings", 
                                 lambda: self.system.open_settings(self.root), "#3b82f6")
        
        # Exit Button (Special styling)
        exit_btn = tk.Button(buttons_frame, text="🚪 Exit System", command=self.on_exit,
                            font=("Segoe UI", 10, "bold"), bg="#dc2626", fg="white",
                            relief=tk.FLAT, cursor="hand2", height=2)
        exit_btn.pack(fill=tk.X, pady=(15, 0))
        exit_btn.bind("<Enter>", lambda e: exit_btn.config(bg="#b91c1c"))
        exit_btn.bind("<Leave>", lambda e: exit_btn.config(bg="#dc2626"))
        
        self.system.log("System Initialized")
        
        # Start Backend Thread
        self.thread = threading.Thread(target=self.system.run_attendance_loop, args=(self.cam_label,), daemon=True)
        self.thread.start()
        
        # Start Status Refresh
        self.refresh_status_dashboard()
    
    def create_modern_button(self, parent, text, command, color):
        """Create a modern styled button"""
        btn = tk.Button(parent, text=text, command=command,
                       font=("Segoe UI", 10), bg=color, fg="white",
                       relief=tk.FLAT, cursor="hand2", height=1)
        btn.pack(fill=tk.X, pady=4)
        
        # Hover effect
        darker_color = self.darken_color(color)
        btn.bind("<Enter>", lambda e: btn.config(bg=darker_color))
        btn.bind("<Leave>", lambda e: btn.config(bg=color))
    
    def darken_color(self, hex_color):
        """Darken a hex color by 20%"""
        hex_color = hex_color.lstrip('#')
        rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        darker_rgb = tuple(int(c * 0.8) for c in rgb)
        return '#{:02x}{:02x}{:02x}'.format(*darker_rgb)

    def refresh_status_dashboard(self):
        """Update the status panel with modern card design"""
        for widget in self.status_scrollable_frame.winfo_children():
            widget.destroy()

        status = self.system.get_today_status()
        
        if not status:
            no_data = tk.Label(self.status_scrollable_frame, text="No employees registered", 
                             bg="#0f3460", fg="#94a3b8", font=("Segoe UI", 10, "italic"))
            no_data.pack(pady=20)
        else:
            for name, state in status.items():
                # Card frame
                card = tk.Frame(self.status_scrollable_frame, bg="#16213e", relief=tk.FLAT, bd=0)
                card.pack(fill=tk.X, padx=8, pady=6)
                
                # Inner padding frame
                inner = tk.Frame(card, bg="#16213e")
                inner.pack(fill=tk.X, padx=12, pady=10)
                
                # Name
                name_label = tk.Label(inner, text=name, 
                                     bg="#16213e", fg="#ffffff", 
                                     font=("Segoe UI", 11, "bold"), anchor="w")
                name_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
                
                # Status badge
                if state == "Present":
                    badge_bg = "#10b981"
                    badge_text = "✓ Present"
                else:
                    badge_bg = "#ef4444"
                    badge_text = "✗ Absent"
                
                badge = tk.Label(inner, text=badge_text, 
                               bg=badge_bg, fg="white", 
                               font=("Segoe UI", 9, "bold"),
                               padx=10, pady=4)
                badge.pack(side=tk.RIGHT)

        self.root.after(5000, self.refresh_status_dashboard)

    def on_exit(self):
        self.system.running = False
        self.root.destroy()

    def on_space_pressed(self, event):
        """Trigger attendance countdown on space press"""
        if not self.system.registration_mode and not self.system.attendance_trigger:
            self.system.attendance_trigger = True
            self.system.attendance_countdown = 2.0
            self.system.log("Attendance Triggered... Stand still.")

if __name__ == "__main__":
    root = tk.Tk()
    app = AttendanceApp(root)
    root.mainloop()