from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Study Mate API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Secret for session tokens
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    streak_days: int = 0
    total_study_hours: float = 0.0
    
class UserLogin(BaseModel):
    session_token: str
    user_data: Dict[str, Any]

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudySession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject: str
    duration_minutes: int
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: Optional[str] = None

class Quiz(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject: str
    questions: List[Dict[str, Any]]
    score: Optional[float] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Reminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    description: Optional[str] = None
    scheduled_time: datetime
    completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivityLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    activity_type: str  # upload, quiz, tutor_ask, reminder_set
    description: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper functions
def prepare_for_mongo(data):
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    """Parse datetime strings back from MongoDB"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and key.endswith('_at'):
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
    return item

# Authentication dependency
async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or header)"""
    session_token = None
    
    # Try to get from cookie first
    session_token = request.cookies.get('session_token')
    
    # If not in cookie, try Authorization header
    if not session_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header.split(' ')[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="No session token provided")
    
    # Find session in database
    session = await db.sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session token")
    
    # Check if session is expired
    expires_at = datetime.fromisoformat(session['expires_at']) if isinstance(session['expires_at'], str) else session['expires_at']
    if expires_at < datetime.now(timezone.utc):
        await db.sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"id": session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**parse_from_mongo(user))

# Authentication routes
@api_router.post("/auth/login")
async def login(user_login: UserLogin, response: Response):
    """Handle login with Emergent auth session data"""
    try:
        session_data = user_login.user_data
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": session_data["email"]})
        
        if not existing_user:
            # Create new user
            user = User(
                id=session_data["id"],
                email=session_data["email"],
                name=session_data["name"],
                picture=session_data.get("picture")
            )
            user_dict = prepare_for_mongo(user.dict())
            await db.users.insert_one(user_dict)
        else:
            user = User(**parse_from_mongo(existing_user))
        
        # Create session
        session = Session(
            user_id=user.id,
            session_token=user_login.session_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        session_dict = prepare_for_mongo(session.dict())
        await db.sessions.insert_one(session_dict)
        
        # Set httpOnly cookie
        response.set_cookie(
            key="session_token",
            value=user_login.session_token,
            max_age=7 * 24 * 60 * 60,  # 7 days
            httponly=True,
            secure=True,
            samesite="none",
            path="/"
        )
        
        return {"message": "Login successful", "user": user}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logout successful"}

# Dashboard data routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    """Get user dashboard statistics"""
    
    # Get recent quiz scores
    recent_quizzes = await db.quizzes.find(
        {"user_id": current_user.id, "score": {"$ne": None}}
    ).sort("completed_at", -1).limit(5).to_list(length=None)
    
    quiz_scores = [quiz.get("score", 0) for quiz in recent_quizzes]
    avg_score = sum(quiz_scores) / len(quiz_scores) if quiz_scores else 0
    
    # Get study sessions this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    weekly_sessions = await db.study_sessions.find({
        "user_id": current_user.id,
        "date": {"$gte": week_ago.isoformat()}
    }).to_list(length=None)
    
    weekly_hours = sum([session.get("duration_minutes", 0) for session in weekly_sessions]) / 60
    
    # Get upcoming reminders
    upcoming_reminders = await db.reminders.find({
        "user_id": current_user.id,
        "completed": False,
        "scheduled_time": {"$gte": datetime.now(timezone.utc).isoformat()}
    }).sort("scheduled_time", 1).limit(3).to_list(length=None)
    
    # Get recent activities
    recent_activities = await db.activity_logs.find({
        "user_id": current_user.id
    }).sort("timestamp", -1).limit(5).to_list(length=None)
    
    return {
        "overall_score": round(avg_score, 1),
        "quiz_scores": quiz_scores,
        "weekly_hours": round(weekly_hours, 1),
        "streak_days": current_user.streak_days,
        "strengths": ["Algebra", "Probability"],  # Mock data for now
        "weaknesses": ["Geometry", "Trigonometry"],  # Mock data for now
        "upcoming_reminders": [parse_from_mongo(r) for r in upcoming_reminders],
        "recent_activities": [parse_from_mongo(a) for a in recent_activities]
    }

# Study session routes
@api_router.post("/study-sessions", response_model=StudySession)
async def create_study_session(
    session_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Create a new study session"""
    study_session = StudySession(
        user_id=current_user.id,
        **session_data
    )
    session_dict = prepare_for_mongo(study_session.dict())
    await db.study_sessions.insert_one(session_dict)
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.id,
        activity_type="study_session",
        description=f"Studied {session_data.get('subject', 'Unknown')} for {session_data.get('duration_minutes', 0)} minutes"
    )
    activity_dict = prepare_for_mongo(activity.dict())
    await db.activity_logs.insert_one(activity_dict)
    
    return study_session

# Quiz routes
@api_router.post("/quizzes", response_model=Quiz)
async def create_quiz(
    quiz_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Create a new quiz"""
    quiz = Quiz(
        user_id=current_user.id,
        **quiz_data
    )
    quiz_dict = prepare_for_mongo(quiz.dict())
    await db.quizzes.insert_one(quiz_dict)
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.id,
        activity_type="quiz",
        description=f"Created quiz: {quiz_data.get('subject', 'Unknown')}"
    )
    activity_dict = prepare_for_mongo(activity.dict())
    await db.activity_logs.insert_one(activity_dict)
    
    return quiz

@api_router.put("/quizzes/{quiz_id}/complete")
async def complete_quiz(
    quiz_id: str,
    completion_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Complete a quiz with score"""
    quiz = await db.quizzes.find_one({"id": quiz_id, "user_id": current_user.id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    update_data = {
        "score": completion_data.get("score"),
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quizzes.update_one(
        {"id": quiz_id},
        {"$set": update_data}
    )
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.id,
        activity_type="quiz_completed",
        description=f"Completed quiz with score: {completion_data.get('score', 0)}%"
    )
    activity_dict = prepare_for_mongo(activity.dict())
    await db.activity_logs.insert_one(activity_dict)
    
    return {"message": "Quiz completed successfully"}

# Reminder routes
@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(
    reminder_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Create a new reminder"""
    reminder = Reminder(
        user_id=current_user.id,
        **reminder_data
    )
    reminder_dict = prepare_for_mongo(reminder.dict())
    await db.reminders.insert_one(reminder_dict)
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.id,
        activity_type="reminder_set",
        description=f"Set reminder: {reminder_data.get('title', '')}"
    )
    activity_dict = prepare_for_mongo(activity.dict())
    await db.activity_logs.insert_one(activity_dict)
    
    return reminder

# AI Tutor routes (placeholder for now)
@api_router.post("/ai-tutor/ask")
async def ask_tutor(
    question_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Ask AI tutor a question"""
    # Placeholder - will implement OpenAI integration later
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.id,
        activity_type="tutor_ask",
        description=f"Asked tutor: {question_data.get('question', '')[:50]}..."
    )
    activity_dict = prepare_for_mongo(activity.dict())
    await db.activity_logs.insert_one(activity_dict)
    
    return {
        "question": question_data.get("question"),
        "answer": "AI tutor functionality will be available soon! This is a placeholder response.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()