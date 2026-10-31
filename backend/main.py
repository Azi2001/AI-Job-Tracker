
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from pwdlib import PasswordHash
from fastapi.staticfiles import StaticFiles
import shutil
import uuid
from pypdf import PdfReader

from database import Base, engine, SessionLocal
from models import Application, User, ResumeAnalysis
import os
from datetime import datetime, timedelta, timezone
from jose import jwt
from fastapi.security import OAuth2PasswordBearer
import ollama



# Create a database session for each request.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base.metadata.create_all(bind=engine)
password_hash = PasswordHash.recommended()

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise ValueError("SECRET_KEY is missing from the .env file")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=True,
)
bearer_scheme = HTTPBearer()

def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)



def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

        user_id = int(user_id)

    except (jwt.JWTError, ValueError, TypeError):
        raise credentials_exception

    current_user = db.query(User).filter(User.id == user_id).first()

    if current_user is None or not current_user.is_active:
        raise credentials_exception

    return current_user



app = FastAPI(title="Job Application Tracker API")

PROFILE_PICTURES_DIR = "uploads/profile_pictures"
os.makedirs(PROFILE_PICTURES_DIR, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Describes the information needed to create an application.
class ApplicationCreate(BaseModel):
    company: str
    position: str
    status: str = "Applied"
    location: str = ""
    job_type: str = "Internship"


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    is_active: bool

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ApplicationStatusUpdate(BaseModel):
    status: str


class ApplicationUpdate(BaseModel):
    company: str | None = None
    position: str | None = None
    status: str | None = None
    location: str | None = None
    job_type: str | None = None



# Convert a database record to the format expected by React.
def application_to_dict(application):
    return {
        "id": application.id,
        "company": application.company,
        "position": application.position,
        "status": application.status,
        "location": application.location,
        "jobType": application.job_type,
    }


@app.get("/")
def home():
    return {
        "message": "Job Application Tracker API is running!"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/db-test")
def test_database_connection():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {
            "database": "connected",
            "test_result": result.scalar(),
        }


# Retrieve all applications from PostgreSQL.

@app.get("/applications")
def get_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    applications = (
        db.query(Application)
        .filter(Application.user_id == current_user.id)
        .order_by(Application.id)
        .all()
    )

    return [
        application_to_dict(application)
        for application in applications
    ]


# Save a new application to PostgreSQL.
@app.post("/applications", status_code=201)
def create_application(
    application: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_application = Application(
        user_id=current_user.id,
        company=application.company,
        position=application.position,
        status=application.status,
        location=application.location,
        job_type=application.job_type,
    )

    db.add(new_application)
    db.commit()
    db.refresh(new_application)

    return application_to_dict(new_application)


# Update an application's details in PostgreSQL.
@app.patch("/applications/{application_id}")
def update_application(
    application_id: int,
    update: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = (
        db.query(Application)
        .filter(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
        .first()
    )

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    update_data = update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)

    return application_to_dict(application)

# Delete an application from PostgreSQL.
@app.delete("/applications/{application_id}")
def delete_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = (
        db.query(Application)
        .filter(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
        .first()
    )

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    db.delete(application)
    db.commit()

    return {
        "message": "Application deleted successfully",
        "id": application_id,
    }


@app.post("/auth/register", response_model=UserResponse, status_code=201)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    full_name = user.full_name.strip()
    email = str(user.email).strip().lower()

    if not full_name:
        raise HTTPException(
            status_code=422,
            detail="Full name cannot be empty"
        )

    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )

    new_user = User(
        full_name=full_name,
        email=email,
        password_hash=password_hash.hash(user.password),
    )

    db.add(new_user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )

    db.refresh(new_user)

    return new_user


@app.post("/auth/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    email = str(user.email).strip().lower()

    existing_user = db.query(User).filter(User.email == email).first()

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not password_hash.verify(
        user.password,
        existing_user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not existing_user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is inactive"
        )

    access_token = create_access_token(existing_user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": existing_user.id,
            "full_name": existing_user.full_name,
            "email": existing_user.email,
        }
    }

    
@app.get("/auth/profile")
def get_profile(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "profile_picture": current_user.profile_picture,
        "preferred_job_title": current_user.preferred_job_title,
        "preferred_location": current_user.preferred_location,
        "preferred_job_type": current_user.preferred_job_type,
    }
class ProfilePreferencesUpdate(BaseModel):
    preferred_job_title: str | None = None
    preferred_location: str | None = None
    preferred_job_type: str | None = None


@app.put("/auth/profile")
def update_profile(
    preferences: ProfilePreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.preferred_job_title = preferences.preferred_job_title
    current_user.preferred_location = preferences.preferred_location
    current_user.preferred_job_type = preferences.preferred_job_type

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Career preferences updated successfully.",
        "preferred_job_title": current_user.preferred_job_title,
        "preferred_location": current_user.preferred_location,
        "preferred_job_type": current_user.preferred_job_type,
    }




@app.post("/auth/profile/picture")
def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, PNG, or WebP image."
        )

    extension = allowed_types[file.content_type]
    filename = f"{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(PROFILE_PICTURES_DIR, filename)

    try:
        content = file.file.read(2 * 1024 * 1024 + 1)

        if len(content) > 2 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Image must be 2 MB or smaller."
            )

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty."
            )

        with open(file_path, "wb") as image_file:
            image_file.write(content)

        old_picture = current_user.profile_picture

        current_user.profile_picture = (
            f"/uploads/profile_pictures/{filename}"
        )
        db.commit()
        db.refresh(current_user)

        if old_picture and old_picture.startswith(
            "/uploads/profile_pictures/"
        ):
            old_path = os.path.join(
                PROFILE_PICTURES_DIR,
                os.path.basename(old_picture)
            )
            if os.path.isfile(old_path):
                os.remove(old_path)

        return {
            "message": "Profile picture updated successfully.",
            "profile_picture": current_user.profile_picture,
        }

    except HTTPException:
        if os.path.isfile(file_path):
            os.remove(file_path)
        raise
    except Exception:
        db.rollback()
        if os.path.isfile(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=500,
            detail="Could not save the profile picture."
        )
    finally:
        file.file.close()


@app.get("/auth/me")
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
    }

  
@app.get("/test-ai")
def test_ai():
    response = ollama.chat(
        model="qwen2.5:3b",
        messages=[
            {
                "role": "user",
                "content": "Reply with: JobTrack AI connection successful"
            }
        ]
    )

    return {
        "message": response["message"]["content"]
    }
@app.post("/resume/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    # 1. Check the uploaded file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF resume."
        )

    # 2. Read the PDF and enforce the 5 MB limit
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
    pdf_bytes = await file.read(MAX_FILE_SIZE + 1)

    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Resume file must be 5 MB or smaller."
        )

    if not pdf_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF is empty."
        )

    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PDF."
        )


    # 3. Extract text from the PDF
    import io

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        resume_text = "\n".join(
            page.extract_text() or "" for page in reader.pages
        ).strip()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read this PDF. Please upload a valid PDF resume."
        )
    finally:
        await file.close()

    if not resume_text:
        raise HTTPException(
            status_code=400,
            detail="No readable text found. Scanned PDFs may require OCR."
        )

    if len(resume_text) > 20000:
        resume_text = resume_text[:20000]

    # 4. Ask the local AI model to analyze the resume
    try:
        
        response = ollama.chat(
            model="qwen2.5:3b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful resume reviewer. Analyze resumes "
                        "fairly and constructively. Identify technical skills, "
                        "strengths, missing or weak sections, and actionable "
                        "improvements. Do not invent qualifications or facts. "
                        "Be concise. Use clear headings and bullet points. "
                        "Limit the response to about 400 words."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        "Review this resume and provide:\n"
                        "1. Summary\n"
                        "2. Technical skills identified\n"
                        "3. Strengths\n"
                        "4. Areas to improve\n"
                        "5. Actionable suggestions\n\n"
                        f"Resume text:\n{resume_text}"
                    )
                }
            ],
            keep_alive="30m",
            options={
                "num_predict": 600
            }
        )

    except Exception:
        raise HTTPException(
            status_code=503,
            detail=(
                "The local AI model is unavailable. "
                "Please make sure Ollama is running."
            )
        )

   
    # Save the analysis to the database
    db = SessionLocal()

    try:
        saved_analysis = ResumeAnalysis(
            user_id=current_user.id,
            filename=file.filename,
            analysis=response["message"]["content"]
        )

        db.add(saved_analysis)
        db.commit()
        db.refresh(saved_analysis)

        return {
            "id": saved_analysis.id,
            "filename": saved_analysis.filename,
            "analysis": saved_analysis.analysis,
            "created_at": saved_analysis.created_at.isoformat()
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="The resume was analyzed, but its result could not be saved."
        )

    finally:
        db.close()


@app.post("/resume/match")
async def match_resume_to_job(
    file: UploadFile = File(...),
    job_description: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    # Validate the resume
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF resume."
        )

    if not job_description.strip():
        raise HTTPException(
            status_code=400,
            detail="Please enter a job description."
        )

    if len(job_description) > 15000:
        raise HTTPException(
            status_code=400,
            detail="Job description must be 15,000 characters or less."
        )

    # Read PDF
    pdf_bytes = await file.read(5 * 1024 * 1024 + 1)
    await file.close()

    if len(pdf_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Resume must be 5 MB or smaller."
        )

    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid PDF."
        )

    # Extract resume text
    import io

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        resume_text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        ).strip()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read the PDF."
        )

    if not resume_text:
        raise HTTPException(
            status_code=400,
            detail="No readable text found in this PDF."
        )

    resume_text = resume_text[:20000]

    # Compare resume against job description using local Ollama
    try:
        response = ollama.chat(
            model="qwen2.5:3b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert recruitment and resume "
                        "matching assistant. Compare the candidate's "
                        "resume against the supplied job description. "
                        "Be fair, accurate and constructive. Never "
                        "invent skills or qualifications. "
                        "Do not claim the score is an actual employer "
                        "or ATS decision. Give a practical estimate."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        "Compare this resume with the job description.\n\n"
                        "Provide these sections:\n"
                        "1. Overall Match Score: a percentage from 0 to 100 "
                        "with a brief explanation.\n"
                        "2. Matching Skills: skills supported by the resume.\n"
                        "3. Missing or Weak Skills: requirements not clearly "
                        "demonstrated in the resume.\n"
                        "4. Relevant Experience: how the candidate's "
                        "experience relates to the role.\n"
                        "5. Recommendations: specific improvements to "
                        "tailor the resume for this position.\n"
                        "6. Important Keywords: useful job-description "
                        "keywords that are missing from the resume.\n\n"
                        f"RESUME:\n{resume_text}\n\n"
                        f"JOB DESCRIPTION:\n{job_description}"
                    )
                }
            ],
            keep_alive="30m",
            options={"num_predict": 700}
        )

        return {
            "filename": file.filename,
            "match_report": response["message"]["content"]
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail=(
                "The local AI model is unavailable. "
                "Please make sure Ollama is running."
            )
        )


@app.get("/resume/history")
def get_resume_history(
    current_user: User = Depends(get_current_user),
):
    db = SessionLocal()

    try:
        analyses = (
            db.query(ResumeAnalysis)
            .filter(ResumeAnalysis.user_id == current_user.id)
            .order_by(ResumeAnalysis.created_at.desc())
            .all()
        )

        return [
            {
                "id": item.id,
                "filename": item.filename,
                "analysis": item.analysis,
                "created_at": (
                    item.created_at.isoformat()
                    if item.created_at
                    else None
                ),
            }
            for item in analyses
        ]

    finally:
        db.close()

