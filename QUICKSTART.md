# Quick Start Guide

## Prerequisites

- Python 3.8+
- Node.js 18+ and npm

## Step 1: Configure Backend

Edit `backend/config.py` and set `ROOT_PATH` to your HDD volume:

```python
ROOT_PATH = "/Volumes/YourHDD"  # Change this to your HDD path
```

Or set environment variable:

```bash
export HDD_ROOT_PATH=/Volumes/YourHDD
```

## Step 2: Start Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend will be available at `http://localhost:8000`

## Step 3: Start Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173`

## Step 4: Use the Application

1. Open `http://localhost:5173` in your browser
2. The left panel shows the current file structure
3. The right panel is editable - drag and drop files/folders to reorganize
4. Click "Preview Changes" to see what will happen (dry-run)
5. Click "Apply Changes" to confirm and perform the moves

## Troubleshooting

- **Backend won't start**: Check that `ROOT_PATH` points to a valid directory
- **Tree is empty**: Verify the `ROOT_PATH` directory exists and is readable
- **CORS errors**: Ensure backend is running on port 8000 and frontend on port 5173
- **Moves fail**: Check that the destination paths are valid and don't already exist

