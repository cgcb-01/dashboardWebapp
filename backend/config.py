
import os
from dotenv import load_dotenv
load_dotenv()
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///./data/examapp.db"   
)

DATABASE_URL =os.getenv("DATABASE_URL")

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
B2_ENDPOINT        = os.environ.get("B2_ENDPOINT", "")   
USE_B2             = bool(B2_KEY_ID and B2_APPLICATION_KEY)