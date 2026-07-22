
import os

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///./data/examapp.db"   # fallback for local dev
)

# For PostgreSQL, psycopg2 expects the scheme "postgresql+psycopg2://"
# Heroku/Render set DATABASE_URL with "postgres://" — fix that here:
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

# ── Auth ──────────────────────────────────────────────────────────────────────
SECRET_KEY  = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
IS_PROD     = ENVIRONMENT == "production"

# ── Razorpay ──────────────────────────────────────────────────────────────────
RAZORPAY_KEY_ID     = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

# ── Backblaze B2 ──────────────────────────────────────────────────────────────
B2_KEY_ID          = os.environ.get("B2_KEY_ID", "")
B2_APPLICATION_KEY = os.environ.get("B2_APPLICATION_KEY", "")
B2_BUCKET_NAME     = os.environ.get("B2_BUCKET_NAME", "examprep-uploads")
B2_BUCKET_ID       = os.environ.get("B2_BUCKET_ID", "")
B2_ENDPOINT        = os.environ.get("B2_ENDPOINT", "")   # e.g. s3.us-west-004.backblazeb2.com
USE_B2             = bool(B2_KEY_ID and B2_APPLICATION_KEY)