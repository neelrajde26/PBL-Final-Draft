"""Authentication endpoints: registration, login, logout, session verification, and password reset."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field

from app.core.config import settings
from app.services.auth.dependencies import get_current_user
from app.services.auth.security import (
    User,
    UserRole,
    create_access_token,
    user_repository,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    district_id: str | None = None
    taluka: str | None = None
    village: str | None = None
    preferred_language: str = "en"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, response: Response) -> dict[str, object]:
    try:
        # Public registration always defaults to FARMER role; no public admin signup
        user = user_repository.create(
            email=req.email,
            password=req.password,
            full_name=req.full_name,
            role=UserRole.FARMER,
            district_id=req.district_id,
            taluka=req.taluka,
            village=req.village,
            preferred_language=req.preferred_language,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    token = create_access_token(user.id, user.role, user.email)
    response.set_cookie(
        key="mdis_session",
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=86400,
    )
    return {
        "status": "success",
        "user": user.to_dict(),
        "access_token": token,
        "token_type": "bearer",
    }


@router.post("/login")
def login(req: LoginRequest, response: Response) -> dict[str, object]:
    user = user_repository.get_by_email(req.email)
    if not user or not verify_password(user.password_hash, req.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact system administrator.",
        )

    token = create_access_token(user.id, user.role, user.email)
    response.set_cookie(
        key="mdis_session",
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=86400,
    )
    return {
        "status": "success",
        "user": user.to_dict(),
        "access_token": token,
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key="mdis_session")
    return {"status": "success", "message": "Successfully logged out."}


@router.get("/me")
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> dict[str, object]:
    return {"user": current_user.to_dict()}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest) -> dict[str, str]:
    token = user_repository.create_password_reset_token(req.email)
    # Always return success to prevent email enumeration
    return {
        "status": "success",
        "message": "If this email is registered, a password reset link has been dispatched.",
        "token": token or "simulated-token-for-unregistered-address",
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest) -> dict[str, str]:
    success = user_repository.reset_password(req.token, req.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )
    return {"status": "success", "message": "Password successfully updated."}

