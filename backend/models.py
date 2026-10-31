

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    company = Column(String(150), nullable=False)
    position = Column(String(150), nullable=False)
    status = Column(String(50), nullable=False, default="Applied")
    location = Column(String(150), nullable=False, default="")
    job_type = Column(String(50), nullable=False, default="Internship")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    profile_picture = Column(String(500), nullable=True)
    preferred_job_title = Column(String(150), nullable=True)
    preferred_location = Column(String(150), nullable=True)
    preferred_job_type = Column(String(50), nullable=True)

class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    filename = Column(String(255), nullable=False)
    analysis = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
