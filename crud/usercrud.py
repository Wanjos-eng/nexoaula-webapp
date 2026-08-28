import bcrypt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.user import User
from schemas.userschema import UserCreate, UserLogin

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate) -> User | None:
    if get_user_by_email(db, user.email):
        return None

    hashed_password = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
    db_user = User(email=user.email, hashed_password=hashed_password, full_name=user.full_name)
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except IntegrityError:
        db.rollback()
        return None

def login_user(db: Session, credentials: UserLogin) -> User | None:
    user = get_user_by_email(db, credentials.email)
    if user and bcrypt.checkpw(credentials.password.encode(), user.hashed_password.encode()):
        return user
    return None
