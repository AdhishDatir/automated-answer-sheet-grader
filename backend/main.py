#backend/main.py for the project automated answer sheet grader


import json
import re
import sqlite3
import pytesseract

from uuid import uuid4

from fastapi.staticfiles import StaticFiles
from datetime import datetime
from pathlib import Path
from io import BytesIO

from fastapi import File, UploadFile
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError

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
LOW_CONFIDENCE_THRESHOLD = 60
SEMANTIC_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
SEMANTIC_MATCH_THRESHOLD = 0.75

semantic_model = None

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

TESSERACT_PATH = Path(
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

if TESSERACT_PATH.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESSERACT_PATH)


class RubricItem(BaseModel):
    point: str
    keywords: list[str]
    semantic_reference: str
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
    image_path: str | None = None
    needs_review: bool = False

class SubmissionUpdateRequest(BaseModel):
    student_name: str | None = None
    question_title: str | None = None
    student_answer: str | None = None
    final_score: float | None = None


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
            image_path TEXT,
            ai_score REAL NOT NULL,
            final_score REAL NOT NULL,
            max_marks REAL NOT NULL,
            needs_review INTEGER NOT NULL DEFAULT 0,
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
    if "image_path" not in column_names:
        cursor.execute(
            "ALTER TABLE submissions ADD COLUMN image_path TEXT"
        )
    if "needs_review" not in column_names:
        cursor.execute(
        "ALTER TABLE submissions ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0"
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

        # Save the original image with a unique name.
        extension = Path(file.filename or "answer.jpg").suffix.lower()
        stored_filename = f"{uuid4().hex}{extension}"
        stored_image_path = UPLOAD_DIR / stored_filename
        stored_image_path.write_bytes(file_bytes)

        # Preprocess a copy for OCR.
        image = ImageOps.exif_transpose(image)
        image = ImageOps.grayscale(image)
        image = ImageOps.autocontrast(image)
        image = ImageEnhance.Contrast(image).enhance(2)
        image = image.filter(ImageFilter.SHARPEN)

        if image.width < 1600:
            scale = 1600 / image.width
            image = image.resize(
                (int(image.width * scale), int(image.height * scale)),
                Image.Resampling.LANCZOS,
            )

        image = image.point(lambda pixel: 0 if pixel < 170 else 255)

        extracted_text = pytesseract.image_to_string(
            image,
            lang="eng",
            config="--psm 6",
        ).strip()

        return {
            "filename": file.filename,
            "extracted_text": extracted_text,
            "image_path": f"/uploads/{stored_filename}",
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

    semantic_scores = calculate_semantic_similarities(
    data.student_answer,
    [item.semantic_reference for item in data.rubric],
)

    for item, semantic_score in zip(data.rubric, semantic_scores):
        total_marks += item.marks

        matched_keywords = [
            keyword
            for keyword in item.keywords
            if clean_text(keyword) in student_text
        ]

        keyword_matched = len(matched_keywords) > 0
        semantic_matched = semantic_score >= SEMANTIC_MATCH_THRESHOLD

        matched = keyword_matched or semantic_matched
        awarded_marks = item.marks if matched else 0
        score += awarded_marks

        if keyword_matched and semantic_matched:
            match_method = "Keyword and semantic match"
        elif keyword_matched:
            match_method = "Keyword match"
        elif semantic_matched:
            match_method = "Semantic match"
        else:
            match_method = "No match"

        breakdown.append({
            "point": item.point,
            "marks": item.marks,
            "awarded_marks": awarded_marks,
            "matched": matched,
            "matched_keywords": matched_keywords,
            "semantic_similarity": round(semantic_score * 100, 1),
            "match_method": match_method,
        })

    confidence = round((score / total_marks) * 100, 1) if total_marks else 0

    return {
    "score": round(score, 1),
    "max_marks": round(total_marks, 1),
    "confidence": confidence,
    "needs_review": confidence < LOW_CONFIDENCE_THRESHOLD,
    "review_reason": (
        "Low rubric coverage. Teacher review is required."
        if confidence < LOW_CONFIDENCE_THRESHOLD
        else "Rubric coverage is acceptable."
    ),
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
        "semantic_reference": item.semantic_reference,
        "marks": item.marks,
    }
    for item in data.rubric
]

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
    """
    INSERT INTO submissions
    (
        student_name,
        question_title,
        model_answer,
        student_answer,
        rubric_json,
        image_path,
        ai_score,
        final_score,
        max_marks,
        needs_review,
        created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
    (
        data.student_name,
        data.question_title,
        data.model_answer,
        data.student_answer,
        json.dumps(rubric_data),
        data.image_path,
        data.ai_score,
        data.final_score,
        data.max_marks,
        int(data.needs_review),
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


@app.put("/submissions/{submission_id}")
def update_submission(
    submission_id: int,
    data: SubmissionUpdateRequest,
):
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()

    submission = cursor.execute(
        "SELECT * FROM submissions WHERE id = ?",
        (submission_id,),
    ).fetchone()

    if not submission:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Submission not found.",
        )

    if (
        data.final_score is not None
        and (data.final_score < 0 or data.final_score > submission["max_marks"])
    ):
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="Final score must be between 0 and maximum marks.",
        )

    updates = {}
    if data.student_name is not None:
        updates["student_name"] = data.student_name
    if data.question_title is not None:
        updates["question_title"] = data.question_title
    if data.student_answer is not None:
        updates["student_answer"] = data.student_answer
    if data.final_score is not None:
        updates["final_score"] = data.final_score

    if not updates:
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="Provide at least one field to update.",
        )

    assignments = ", ".join(f"{column} = ?" for column in updates)
    values = list(updates.values()) + [submission_id]

    cursor.execute(
        f"UPDATE submissions SET {assignments} WHERE id = ?",
        values,
    )

    connection.commit()
    connection.close()

    return {"message": "Submission updated successfully."}


@app.delete("/submissions/{submission_id}")
def delete_submission(submission_id: int):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "DELETE FROM submissions WHERE id = ?",
        (submission_id,),
    )

    if cursor.rowcount == 0:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Submission not found.",
        )

    connection.commit()
    connection.close()

    return {"message": "Submission deleted successfully."}



def get_semantic_model():
    global semantic_model

    if semantic_model is None:
        try:
            from sentence_transformers import SentenceTransformer

            semantic_model = SentenceTransformer(SEMANTIC_MODEL_NAME)
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="sentence-transformers is not installed.",
            )
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Could not load the SBERT model. Check your internet connection.",
            )

    return semantic_model


def calculate_semantic_similarities(student_answer, references):
    model = get_semantic_model()

    embeddings = model.encode(
        [student_answer, *references],
        normalize_embeddings=True,
    )

    student_embedding = embeddings[0]
    reference_embeddings = embeddings[1:]

    return [
        float(student_embedding @ reference_embedding)
        for reference_embedding in reference_embeddings
    ]


@app.get("/analytics/evaluation")
def get_evaluation_metrics():
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()

    rows = cursor.execute("""
        SELECT ai_score, final_score, needs_review
        FROM submissions
    """).fetchall()

    connection.close()

    if not rows:
        return {
            "total_submissions": 0,
            "mean_absolute_error": 0,
            "exact_score_agreement": 0,
            "review_flag_rate": 0,
        }

    absolute_errors = [
        abs(row["ai_score"] - row["final_score"])
        for row in rows
    ]

    exact_matches = [
        row for row in rows
        if abs(row["ai_score"] - row["final_score"]) < 0.01
    ]

    review_flags = [
        row for row in rows
        if row["needs_review"] == 1
    ]

    return {
        "total_submissions": len(rows),
        "mean_absolute_error": round(
            sum(absolute_errors) / len(absolute_errors),
            2,
        ),
        "exact_score_agreement": round(
            (len(exact_matches) / len(rows)) * 100,
            1,
        ),
        "review_flag_rate": round(
            (len(review_flags) / len(rows)) * 100,
            1,
        ),
    }