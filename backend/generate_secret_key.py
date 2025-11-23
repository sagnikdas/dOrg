"""Generate a secure random secret key for JWT."""

import secrets

# Generate a 32-byte (256-bit) random secret key
secret_key = secrets.token_urlsafe(32)

print("Generated JWT_SECRET_KEY:")
print(secret_key)
print("\nAdd this to your .env file:")
print(f"JWT_SECRET_KEY={secret_key}")

