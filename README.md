# File Reorganization Tool

A desktop-style application for reorganizing files and folders on an HDD volume using drag-and-drop in a tree UI.

## Architecture

- **Backend**: FastAPI (Python 3) running on `http://localhost:8000`
- **Frontend**: React + TypeScript + Vite running on `http://localhost:5173`

## Features

- Scan HDD volume and display folder/file tree
- Drag & drop files and folders to reorganize structure
- Preview changes before applying (dry-run mode)
- Safe file operations (no overwrites, path validation)
- Efficient moves using `os.rename` (metadata-only on same filesystem)

## Setup

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure the root path:
   - Edit `backend/config.py` and set `ROOT_PATH` to your HDD volume path
   - Or set environment variable: `export HDD_ROOT_PATH=/Volumes/YourHDD`
   - Default: `/Volumes/MyHDD`

5. Run the backend:
   ```bash
   python main.py
   # Or with uvicorn directly:
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`

## Usage

1. Start both backend and frontend servers
2. Open `http://localhost:5173` in your browser
3. The left panel shows the current file structure (read-only)
4. The right panel shows a draft structure you can edit
5. Drag and drop files/folders in the right panel to reorganize
6. Click "Preview Changes" to see what moves will be performed (dry-run)
7. Click "Apply Changes" to confirm and perform the actual moves

## API Endpoints

- `GET /health` - Health check
- `GET /tree` - Get directory tree structure
- `POST /apply-moves` - Apply file/folder moves (supports dry-run)

## Safety Features

- **No overwrites**: Moves are skipped if destination already exists
- **Path validation**: All paths are validated to prevent escaping the root directory
- **Dry-run by default**: Preview changes before applying
- **Error handling**: Comprehensive error reporting for failed operations

## Testing

### Backend Tests

```bash
cd backend
pytest test_filesystem.py
```

### Frontend Tests

Note: Frontend tests require a test framework setup. Currently, a test file structure is provided but needs test runner configuration.

## Development

### Backend Structure
- `config.py` - Configuration and path validation
- `models.py` - Pydantic data models
- `filesystem.py` - Filesystem operations (scanning, moving)
- `main.py` - FastAPI application and endpoints
- `test_filesystem.py` - Unit tests

### Frontend Structure
- `src/api/` - API client functions
- `src/components/` - React components (TreeView, Toolbar, PreviewModal)
- `src/hooks/` - Custom React hooks (useTreeState)
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions (tree operations, computeMoves)
- `src/App.tsx` - Main application component

## Notes

- The application is designed to work within a single volume (same filesystem) for optimal performance
- File moves use `os.rename` when possible (fast, metadata-only operation)
- Falls back to `shutil.move` for cross-filesystem moves
- Symlinks are skipped during scanning

