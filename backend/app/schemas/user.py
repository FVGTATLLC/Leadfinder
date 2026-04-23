import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    admin = "admin"
    manager = "manager"
    sales_rep = "sales_rep"
    branch_manager = "branch_manager"
    ops = "ops"
    reviewer = "reviewer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = UserRole.sales_rep


class UserCreateSelfRegister(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = UserRole.sales_rep


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    team_id: uuid.UUID | None = None
    is_active: bool
    created_at: datetime
    must_change_password: bool = False
    sender_title: str | None = None
    sender_phone: str | None = None
    last_login_at: datetime | None = None
    last_active_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    team_id: uuid.UUID | None = None
    is_active: bool | None = None
    sender_title: str | None = None
    sender_phone: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    must_change_password: bool = False


class TokenPayload(BaseModel):
    sub: str  # user_id as string
    role: str
    exp: int
