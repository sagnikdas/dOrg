# Backend API

FastAPI backend for file reorganization operations.

## Configuration

Set the `ROOT_PATH` in `config.py` or via environment variable:

```bash
export HDD_ROOT_PATH=/Volumes/YourHDD
```

## Running

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
# Or
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Testing

```bash
pytest test_filesystem.py -v
```

