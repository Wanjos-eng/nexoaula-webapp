from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from schemas.userschema import UserCreate, UserLogin, UserResponse
from crud.usercrud import login_user, create_user
from database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=UserResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = login_user(db, credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )
    return user

@router.post("/criar_conta", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def criar_conta(user: UserCreate, db: Session = Depends(get_db)):
    created_user = create_user(db, user)
    if(created_user is None):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma conta com esse e-mail",
        )
    return created_user

