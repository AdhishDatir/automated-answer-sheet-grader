import re

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Automated Answer Sheet Grader")

STOP_WORDS = {
    "a", "an", "the", "and", "or", "is", "are", "was", "were",
    "in", "on", "at", "to", "of", "for", "with", "by", "into",
    "from", "that", "this", "it", "as"
}


class GradeRequest(BaseModel):
    model_answer: str
    student_answer: str
    max_marks: int = 5


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
        return {"error": "Model answer needs meaningful words"}

    matched_words = model_words.intersection(student_words)
    missing_words = model_words - student_words

    similarity = len(matched_words) / len(model_words)
    score = round(similarity * data.max_marks, 1)

    return {
        "score": score,
        "max_marks": data.max_marks,
        "confidence": round(similarity * 100, 1),
        "matched_words": sorted(matched_words),
        "missing_words": sorted(missing_words),
    }