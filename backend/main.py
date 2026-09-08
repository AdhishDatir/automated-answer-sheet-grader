import re
import sqlite3
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Automated Answer Sheet Grader")

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

DATABASE_FILE = Path(__file__).resolve().parent / "grader.db"

STOP_WORDS = {
    "a", "an", "the", "and", "or", "is", "are", "was", "were",
    "in", "on", "at", "to", "of", "for", "with", "by", "into",
    "from", "that", "this", "it", "as"
}


class GradeRequest(BaseModel):
    model_answer: str
    student_answer: str
    max_marks: int = 5


class SubmissionRequest(BaseModel):
    student_name: str
    question_title: str
    model_answer: str
    student_answer: str
    ai_score: float
    final_score: float
    max_marks: int

def get_connection():
    return sqlite3.connect(DATABASE_FILE)


def create_database():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT NOT NULL,
            question_title TEXT NOT NULL,
            model_answer TEXT NOT NULL,
            student_answer TEXT NOT NULL,
            ai_score REAL NOT NULL,
            final_score REAL NOT NULL,
            max_marks INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    connection.commit()
    connection.close()


@app.on_event("startup")
def startup():
    create_database()
    upgrade_database()


def important_words(text: str) -> set[str]:
    words = re.findall(r"\b[a-zA-Z]+\b", text.lower())
    return {word for word in words if word not in STOP_WORDS}


@app.get("/")
def welcome():
    return {"message": "Answer Sheet Grader backend is running"}


@app.post("/grade")
def grade_answer(data: GradeRequest):
    model_words = important_words(data.model_answer)
    student_words = important_words(data.student_answer)

    if not model_words:
        raise HTTPException(
            status_code=400,
            detail="Model answer needs meaningful words.",
        )

    matched_words = model_words.intersection(student_words)
    missing_words = model_words - student_words
    similarity = len(matched_words) / len(model_words)

    return {
        "score": round(similarity * data.max_marks, 1),
        "max_marks": data.max_marks,
        "confidence": round(similarity * 100, 1),
        "matched_words": sorted(matched_words),
        "missing_words": sorted(missing_words),
    }


@app.post("/submissions")
def save_submission(data: SubmissionRequest):
    if data.final_score < 0 or data.final_score > data.max_marks:
        raise HTTPException(
            status_code=400,
            detail="Final score must be between 0 and maximum marks.",
        )

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO submissions
        (student_name, question_title, model_answer, student_answer,
        ai_score, final_score, max_marks, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data.student_name,
            data.question_title,
            data.model_answer,
            data.student_answer,
            data.ai_score,
            data.final_score,
            data.max_marks,
            datetime.now().isoformat(timespec="seconds"),
        ),
    )

    submission_id = cursor.lastrowid
    connection.commit()
    connection.close()

    return {
        "message": "Grade saved successfully",
        "submission_id": submission_id,
    }


@app.get("/submissions")
def get_submissions():
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()

    rows = cursor.execute(
        "SELECT * FROM submissions ORDER BY id DESC"
    ).fetchall()

    connection.close()
    return [dict(row) for row in rows]

def upgrade_database():
    connection = get_connection()
    cursor = connection.cursor()

    columns = cursor.execute("PRAGMA table_info(submissions)").fetchall()
    column_names = [column[1] for column in columns]

    if "student_name" not in column_names:
        cursor.execute(
            "ALTER TABLE submissions ADD COLUMN student_name TEXT NOT NULL DEFAULT 'Unknown student'"
        )

    if "question_title" not in column_names:
        cursor.execute(
            "ALTER TABLE submissions ADD COLUMN question_title TEXT NOT NULL DEFAULT 'Untitled question'"
        )

    connection.commit()
    connection.close()