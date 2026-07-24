
import os
from dotenv import load_dotenv
load_dotenv()
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL =os.getenv("DATABASE_URL")

# ── Auth ──────────────────────────────────────────────────────────────────────
SECRET_KEY  = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PROD     = ENVIRONMENT == "production"

# ── Razorpay ──────────────────────────────────────────────────────────────────
RAZORPAY_KEY_ID     = os.getenv ("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

# ── Backblaze B2 ──────────────────────────────────────────────────────────────
B2_KEY_ID          = os.getenv("B2_KEY_ID", "")
B2_APPLICATION_KEY = os.getenv("B2_APPLICATION_KEY", "")
B2_BUCKET_NAME     = os.getenv("B2_BUCKET_NAME", "examprep-uploads")
B2_BUCKET_ID       = os.getenv("B2_BUCKET_ID", "")
B2_ENDPOINT        = os.getenv("B2_ENDPOINT", "")   
USE_B2             = bool(B2_KEY_ID and B2_APPLICATION_KEY)