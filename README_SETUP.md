# Local Attendance System - Setup Guide

This guide will help you set up the attendance system on a new PC.

## 1. Install System Dependencies

### Windows:
1. Install **Python 3.10+**.
2. Install **Visual Studio** (Community Edition) and select the **"Desktop development with C++"** workload. This is required for the `face-recognition` library (to compile `dlib`).
3. (Optional) Install `git` if you want to clone the repository.

### Linux (Debian/Ubuntu):
Run the following command to install the required system libraries for GUI and Face Recognition:
```bash
sudo apt update
sudo apt install -y python3-tk cmake build-essential libopenblas-dev liblapack-dev libx11-dev libgtk-3-dev
```

## 2. Clone or Copy the Files
Copy the following files to your project folder:
- `attendance_system.py`
- `requirements.txt`
- `face_encodings.pkl` (optional, if you want to bring existing employees)
- `settings.json` (optional)

## 3. Install Python Dependencies
Open your terminal/command prompt in the project folder and run:
```bash
pip install -r requirements.txt
```

## 4. Run the System
Launch the application:
```bash
python3 attendance_system.py
```

## Troubleshooting
- **Camera Error:** Ensure your camera is connected and not being used by another app (like Zoom or Teams).
- **dlib/face_recognition install fails:** Ensure CMake and C++ Build Tools (Windows) or build-essential (Linux) are installed.
