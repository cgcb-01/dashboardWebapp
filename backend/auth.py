"""Authentication: password hashing, JWT issuance/verification, and
dependency helpers for 'current user' and 'premium-required' routes."""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.models.db import get_db, User, Subscription, SubscriptionStatus

# NOTE: in production move SECRET_KEY to an environment variable / secrets manager.
SECRET_KEY = "dev-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7   # 7 days

# FIXED: Use Argon2 as primary, bcrypt as fallback for existing users
# Argon2 has NO 72-byte limit and is more secure
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],  # Try argon2 first, fallback to bcrypt
    deprecated="auto",
    argon2__memory_cost=102400,    # 100 MB
    argon2__time_cost=3,
    argon2__parallelism=8,
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    """Hash a password using Argon2 (no 72-byte limit)."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its hash.
    Works with both Argon2 and bcrypt hashes."""
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError as e:
        # If bcrypt fails due to length, try truncating
        if "72 bytes" in str(e):
            truncated = plain.encode('utf-8')[:72].decode('utf-8', errors='ignore')
            return pwd_context.verify(truncated, hashed)
        raise e


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """For routes that work for both guests and logged-in users
    (e.g. browsing free PYQ categories)."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    return db.query(User).filter(User.id == int(user_id)).first()


def user_has_active_premium(user: User, db: Session) -> bool:
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.current_period_end >= datetime.utcnow(),
        )
        .order_by(Subscription.current_period_end.desc())
        .first()
    )
    return sub is not None


def require_premium(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if current_user.is_admin:
        return current_user
    if not user_has_active_premium(current_user, db):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="An active premium subscription is required to access this content.",
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user