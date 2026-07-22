from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from backend.models.db import get_db, User
from backend import schemas
from backend.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, user_has_active_premium
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        # Check if user exists
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered.")

        # Hash the password (now using Argon2 - no 72-byte limit)
        hashed_password = hash_password(payload.password)
        
        # Create user
        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hashed_password,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create token
        token = create_access_token({"sub": str(user.id)})
        user_out = schemas.UserOut.model_validate(user)
        user_out.is_premium = False
        
        logger.info(f"User registered successfully: {user.email}")
        return schemas.Token(access_token=token, user=user_out)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    try:
        # Find user
        user = db.query(User).filter(User.email == payload.email).first()
        
        # Verify password (now handles bcrypt fallback gracefully)
        if not user or not verify_password(payload.password, user.hashed_password):
            logger.warning(f"Failed login attempt for email: {payload.email}")
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        # Create token
        token = create_access_token({"sub": str(user.id)})
        user_out = schemas.UserOut.model_validate(user)
        user_out.is_premium = user_has_active_premium(user, db)
        
        logger.info(f"User logged in successfully: {user.email}")
        return schemas.Token(access_token=token, user=user_out)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        user_out = schemas.UserOut.model_validate(current_user)
        user_out.is_premium = user_has_active_premium(current_user, db)
        return user_out
    except Exception as e:
        logger.error(f"Get user error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user info: {str(e)}")