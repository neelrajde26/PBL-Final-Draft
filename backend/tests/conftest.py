"""Isolate auth state: tests get a throwaway user store and a known admin."""
import os
import tempfile

os.environ.setdefault("MDIS_AUTH_DIR", tempfile.mkdtemp(prefix="mdis-auth-"))
os.environ.setdefault("MDIS_ADMIN_EMAIL", "admin@example.org")
os.environ.setdefault("MDIS_ADMIN_PASSWORD", "test-admin-password-123")
