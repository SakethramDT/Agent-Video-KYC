import psycopg2
from fastapi import FastAPI,HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
import concurrent.futures
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React frontend URL
        "http://127.0.0.1:3000"   # Also add localhost with IP just in case
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# PostgreSQL connection details
DB_CONFIG = {
    "host": "164.52.217.141",
    "port": 6432,
    "user": "postgres",
    "password": "admin@753",
    "database": "video_kyc",
}

# Pydantic user model
class User(BaseModel):
    user_id: int
    kyc_id: Optional[str]
    name: str
    date_of_birth: Optional[date]
    gender: Optional[str]
    nationality: Optional[str]
    id_number: str
    id_issue_date: Optional[date]
    id_expiry_date: Optional[date]
    document_url: Optional[str]
    status: Optional[str]
    assigned_to: Optional[str]

class AssignSessionRequest(BaseModel):
    agent_name: str
    status: str 


class UpdateStatusRequest(BaseModel):
    status: str

def fetch_users_from_db() -> List[User]:
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, kyc_id, name, date_of_birth, gender, nationality, id_number,
               id_issue_date, id_expiry_date, document_url, status, assigned_to
        FROM users
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    users = []
    for row in rows:
        users.append(User(
            user_id=row[0],
            kyc_id=row[1],
            name=row[2],
            date_of_birth=row[3],
            gender=row[4],
            nationality=row[5],
            id_number=row[6],
            id_issue_date=row[7],
            id_expiry_date=row[8],
            document_url=row[9],
            status=row[10],
            assigned_to=row[11],
        ))
    return users

import asyncio

@app.get("/users/", response_model=List[User])
async def read_users():
    # Run the blocking DB call in a threadpool to avoid blocking event loop
    loop = asyncio.get_running_loop()
    users = await loop.run_in_executor(None, fetch_users_from_db)
    return users

@app.put("/users/{user_id}/assign")
def assign_session(user_id: int, assignment: AssignSessionRequest):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Update user record
        cursor.execute("""
            UPDATE users
            SET assigned_to = %s, status = %s
            WHERE user_id = %s
        """, (assignment.agent_name, assignment.status, user_id))

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")

        conn.commit()
        cursor.close()
        conn.close()

        return {"message": "Session successfully assigned."}
    except Exception as e:
        import traceback
        traceback.print_exc()  # Logs full stack trace in your terminal
        raise HTTPException(status_code=500, detail=str(e))



@app.put("/users/{user_id}/status")
def update_status(user_id: int, update: UpdateStatusRequest):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE users
            SET status = %s
            WHERE user_id = %s
        """, (update.status, user_id))

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")

        conn.commit()
        cursor.close()
        conn.close()

        return {"message": "Status updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users/stats")
def get_user_stats():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM users;")
    total_sessions = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'pending';")
    pending_sessions = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM users
        WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE;
    """)
    completed_today = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM users WHERE status = 'rejected';
    """)
    rejected = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE status IS NOT NULL;")
    total_with_status = cursor.fetchone()[0]

    cursor.close()
    conn.close()

    rejection_rate = (
        round((rejected / total_with_status) * 100, 2)
        if total_with_status else 0.0
    )

    return {
        "total_sessions": total_sessions,
        "pending_sessions": pending_sessions,
        "completed_today": completed_today,
        "rejection_rate": f"{rejection_rate}%",
    }