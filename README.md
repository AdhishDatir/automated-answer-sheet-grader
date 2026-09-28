# Automated Answer Sheet Grader 🎓

An AI-assisted web application that helps teachers evaluate short subjective answers. It extracts typed text from answer-sheet images, grades it against a teacher-defined rubric, and lets the teacher review and save the final score.

> 👩‍🏫 **Teacher-in-control:** the system suggests a grade, but the teacher approves or overrides it.

## 🚀 Overview

Manual answer-sheet evaluation takes time. This project provides a local workflow where a teacher uploads a typed answer-sheet image, checks the OCR result, applies a rubric, and stores the reviewed final score.

## ✨ Features

- 📄 Upload typed English answer-sheet images (`.png`, `.jpg`, or `.jpeg`)
- 🖼️ Preview the original answer sheet beside editable OCR text
- 🔎 Improve images before OCR with rotation correction, contrast, sharpening, resizing, and thresholding
- 🔤 Extract text locally with Tesseract OCR
- 📋 Create a custom rubric with key points and marks
- 🤖 Generate an AI-suggested score with a point-by-point rubric breakdown
- ✏️ Let teachers adjust and approve the final score
- 💾 Save submissions, rubric data, scores, and image paths in SQLite
- 📊 Load saved records and reopen original uploaded scans
- 🔄 Connect React frontend and FastAPI backend through REST APIs

## 🏗️ Application Architecture

```text
             Teacher
                │
                ▼
        React Frontend
        localhost:5173
                │
          HTTP / REST API
                │
                ▼
         FastAPI Backend
        127.0.0.1:8000
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
 Image      OCR Engine   Rubric
 Upload     Tesseract    Grader
     │          │          │
     └──────────┴──────────┘
                │
                ▼
        SQLite Database
                │
                ▼
   Final Score + Teacher Review
```

## 🛠️ Technologies Used

### Frontend

- React
- Vite
- JavaScript
- HTML and CSS

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn

### OCR, Database, and Image Processing

- Tesseract OCR
- pytesseract
- Pillow
- SQLite

### Development Tools

- Git and GitHub
- npm
- Python virtual environments

## 📁 Project Structure

```text
Automated Answer Sheet Grader/
│
├── frontend/                  # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx            # Grading and teacher-review interface
│   │   └── App.css            # Frontend styles
│   ├── package.json
│   └── vite.config.js
│
├── backend/                   # FastAPI backend
│   ├── main.py                # OCR, grading, SQLite, and API logic
│   ├── requirements.txt
│   ├── grader.db              # Created automatically
│   └── uploads/               # Uploaded answer-sheet images
│
├── .gitignore
└── README.md
```

## ⚙️ Installation

### 1. Install prerequisites

Install Python 3.11+, Node.js LTS, and Tesseract OCR.

On Windows, install Tesseract with:

```powershell
winget install -e --id UB-Mannheim.TesseractOCR
```

Verify the installation:

```powershell
& "C:\Program Files\Tesseract-OCR\tesseract.exe" --version
```

### 2. Frontend setup 🎨

```powershell
cd "C:\Automated Answer Sheet Grader\frontend"
npm install
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

### 3. Backend setup 🐍

Open another terminal:

```powershell
cd "C:\Automated Answer Sheet Grader\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install fastapi "uvicorn[standard]" pytesseract Pillow python-multipart
python -m uvicorn main:app --reload
```

The backend normally runs at:

```text
http://127.0.0.1:8000
```

FastAPI interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

## 📋 Rubric Format

Enter one rubric item per line:

```text
Rubric point | matching keywords | marks
```

Example: five-mark photosynthesis question

```text
Uses sunlight | sunlight | 1
Uses water | water | 1
Uses carbon dioxide | carbon dioxide, carbon | 1
Produces glucose or food | glucose, food | 1
Releases oxygen | oxygen | 1
```

The current grader awards marks when matching keywords are found in the student answer. This makes the score easy to explain, though it does not yet understand all paraphrased answers.

## 📡 API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Check whether the backend is running |
| `POST` | `/ocr` | Upload a typed image and extract text |
| `POST` | `/grade` | Grade text against a rubric |
| `POST` | `/submissions` | Save a teacher-reviewed submission |
| `GET` | `/submissions` | Load saved submissions |
| `GET` | `/uploads/{filename}` | Open an uploaded answer-sheet image |

## 🔄 Current Workflow

```text
Upload typed answer-sheet image
        ↓
Image preprocessing + Tesseract OCR
        ↓
Teacher corrects OCR text if needed
        ↓
Rubric-based scoring
        ↓
Teacher approves or overrides score
        ↓
SQLite saves the complete record
```

## ⚠️ Current Limitations

- OCR is currently intended for typed English text.
- Handwriting recognition is not included yet.
- Keyword matching can miss correct answers written using different words.
- Login and authentication are not included yet.
- Uploaded scans are stored locally, so this version is for development and testing.

## 🔮 Future Improvements

1. ✂️ Question-wise answer segmentation
2. 🧠 SBERT semantic similarity for paraphrased answers
3. ✍️ Handwriting OCR with TrOCR
4. 🔐 Teacher login and student records
5. 📈 Class performance and question analytics
6. 🐘 PostgreSQL for multi-user deployment
7. ☁️ Deployment, tests, and project documentation
