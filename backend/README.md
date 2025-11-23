# Backend API

FastAPI backend for file reorganization operations with Google SSO authentication.

## Configuration

### Environment Variables

Create a `.env` file in the backend directory (see `.env.example`):

```bash
# JWT Secret Key
JWT_SECRET_KEY=your-secret-key-change-in-production

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback

# Default root path
HDD_ROOT_PATH=/Users/sagnikdas/Downloads
```

### Setting up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8000/auth/callback`
6. Copy the Client ID and Client Secret to your `.env` file

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

## Authentication Endpoints

- `GET /auth/google` - Initiate Google OAuth login
- `GET /auth/callback` - OAuth callback (handled automatically)
- `GET /auth/me` - Get current user info (requires authentication)
- `POST /auth/verify` - Verify a JWT token

## Testing

```bash
pytest test_filesystem.py -v
```

