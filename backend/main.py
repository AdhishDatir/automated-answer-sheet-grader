import json
import re
import sqlite3
import pytesseract

from datetime import datetime
from pathlib import Path
from io import BytesIO

from fastapi import File, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

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

TESSERACT_PATH = Path(
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

if TESSERACT_PATH.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESSERACT_PATH)


class RubricItem(BaseModel):
    point: str
    keywords: list[str]
    marks: float


class GradeRequest(BaseModel):
    model_answer: str
    student_answer: str
    rubric: list[RubricItem]


class SubmissionRequest(BaseModel):
    student_name: str
    question_title: str
    model_answer: str
    student_answer: str
    rubric: list[RubricItem]
    ai_score: float
    final_score: float
    max_marks: float


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
            rubric_json TEXT NOT NULL,
            ai_score REAL NOT NULL,
            final_score REAL NOT NULL,
            max_marks REAL NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    connection.commit()
    connection.close()


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

    if "rubric_json" not in column_names:
        cursor.execute(
            "ALTER TABLE submissions ADD COLUMN rubric_json TEXT NOT NULL DEFAULT '[]'"
        )

    connection.commit()
    connection.close()


@app.on_event("startup")
def startup():
    create_database()
    upgrade_database()


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", text.lower())).strip()


@app.get("/")
def welcome():
    return {"message": "Answer Sheet Grader backend is running"}

@app.post("/ocr")
async def extract_text_from_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Upload an image file such as PNG, JPG, or JPEG.",
        )

    try:
        file_bytes = await file.read()
        image = Image.open(BytesIO(file_bytes))

        # Converts the image to grayscale, which can help OCR.
        image = ImageOps.grayscale(image)

        # --psm 6 means: treat the image as one block of text.
        extracted_text = pytesseract.image_to_string(
            image,
            lang="eng",
            config="--psm 6",
        ).strip()

        return {
            "filename": file.filename,
            "extracted_text": extracted_text,
        }

    except UnidentifiedImageError:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a readable image.",
        )
    except pytesseract.TesseractNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Tesseract is not installed or its path is incorrect.",
        )

@app.post("/grade")
def grade_answer(data: GradeRequest):
    if not data.rubric:
        raise HTTPException(status_code=400, detail="Add at least one rubric point.")

    student_text = clean_text(data.student_answer)
    score = 0
    total_marks = 0
    breakdown = []

    for item in data.rubric:
        total_marks += item.marks

        matched_keywords = [
            keyword
            for keyword in item.keywords
            if clean_text(keyword) in student_text
        ]

        matched = len(matched_keywords) > 0
        awarded_marks = item.marks if matched else 0
        score += awarded_marks

        breakdown.append({
            "point": item.point,
            "marks": item.marks,
            "awarded_marks": awarded_marks,
            "matched": matched,
            "matched_keywords": matched_keywords,
        })

    confidence = round((score / total_marks) * 100, 1) if total_marks else 0

    return {
        "score": round(score, 1),
        "max_marks": round(total_marks, 1),
        "confidence": confidence,
        "rubric_breakdown": breakdown,
    }


@app.post("/submissions")
def save_submission(data: SubmissionRequest):
    if data.final_score < 0 or data.final_score > data.max_marks:
        raise HTTPException(
            status_code=400,
            detail="Final score must be between 0 and maximum marks.",
        )

    rubric_data = [
        {
            "point": item.point,
            "keywords": item.keywords,
            "marks": item.marks,
        }
        for item in data.rubric
    ]

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO submissions
        (student_name, question_title, model_answer, student_answer,
         rubric_json, ai_score, final_score, max_marks, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data.student_name,
            data.question_title,
            data.model_answer,
            data.student_answer,
            json.dumps(rubric_data),
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

    submissions = []

    for row in rows:
        submission = dict(row)
        submission["rubric"] = json.loads(submission.pop("rubric_json", "[]"))
        submissions.append(submission)

    return submissions