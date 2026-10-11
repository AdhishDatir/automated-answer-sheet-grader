# Automated Answer Sheet Grader 🎓

An AI-assisted web application for evaluating short subjective answers in a teacher-controlled workflow. The app extracts typed text from answer-sheet images, lets the teacher review and correct the OCR result, grades the answer against a rubric, and stores the reviewed outcome for later analysis.

> 👩‍🏫 Teacher-in-control: the system suggests a score using keyword and semantic matching, but the teacher can approve, override, and save the final grade.

## 🚀 Overview

Manual evaluation of subjective answers is time-consuming and inconsistent. This project provides a local workflow for teachers to:

- upload a typed answer-sheet image,
- review and correct OCR text,
- select or save a question with a rubric,
- grade the answer with AI assistance,
- approve or edit the final score,
- save results to SQLite, and
- export analytics and final grades.

It is designed for classroom or small-scale use, with a simple React + FastAPI stack and local file storage.

## ✨ Features

- 📄 Upload typed English answer-sheet images (`.png`, `.jpg`, or `.jpeg`)
- 🖼️ Preview the uploaded answer sheet beside editable OCR text
- 🔎 Improve images before OCR with grayscale, contrast boosting, sharpening, resizing, and thresholding
- 🔤 Extract text locally with Tesseract OCR
- 📋 Create and save a reusable question bank with title, model answer, and rubric
- 🤖 Grade answers using keyword matching plus semantic similarity via `sentence-transformers`
- 🧠 Show a rubric-by-rubric breakdown with match method and semantic similarity percent
- ✏️ Let teachers review and override the final score before saving
- 💾 Save submissions, rubric data, scores, and image paths in SQLite
- 📊 Load saved records, edit scores, delete entries, and view evaluation analytics
- 📤 Export final grades as a CSV file filtered by question
- 🔄 Connect the React frontend and FastAPI backend through REST APIs

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
     ┌──────────┼────────────┐
     ▼          ▼            ▼
 Image       OCR +        Semantic
 Upload     Tesseract    Similarity
     │          │            │
     └──────────┴────────────┘
                │
                ▼
         SQLite Database
                │
     ┌──────────▼──────────┐
     ▼                     ▼
 Final Score +        Question Bank
 Teacher Review       + Analytics
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

### OCR, AI, Database, and Image Processing

- Tesseract OCR
- pytesseract
- Pillow
- SQLite
- sentence-transformers

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
│   │   ├── App.jsx            # Grading, OCR, analytics, and review UI
│   │   └── App.css            # Frontend styles
│   ├── package.json
│   └── vite.config.js
│
├── backend/                   # FastAPI backend
│   ├── main.py                # OCR, grading, SQLite, exports, and API logic
│   ├── requirements.txt      # Python dependencies
│   ├── grader.db              # Created automatically
│   └── uploads/               # Uploaded answer-sheet images
│
├── .gitignore
├── README.md
└── .venv/                     # Optional local Python virtual environment
```

## ⚙️ Installation

### 1. Install prerequisites

Install Python 3.11+, Node.js LTS, and Tesseract OCR.

On Windows, install Tesseract with:

```powershell
winget install -e --id UB-Mannheim.TesseractOCR
```

Verify the install:

```powershell
& "C:\Program Files\Tesseract-OCR\tesseract.exe" --version
```

### 2. Backend setup 🐍

Open a terminal in the project root:

```powershell
cd "C:\Automated Answer Sheet Grader\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Start the backend:

```powershell
python -m uvicorn main:app --reload
```

The backend normally runs at:

```text
http://127.0.0.1:8000
```

FastAPI interactive docs:

```text
http://127.0.0.1:8000/docs
```

> Note: The first time semantic grading is used, `sentence-transformers` may download the model from Hugging Face. An internet connection is required the first time.

### 3. Frontend setup 🎨

Open another terminal:

```powershell
cd "C:\Automated Answer Sheet Grader\frontend"
npm install
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

## 📋 Rubric Format

Use one rubric item per line:

```text
Rubric point | keywords | expected meaning | marks
```

Example:

```text
Uses sunlight | sunlight | Plants use sunlight for photosynthesis. | 1
Uses water | water | Plants need water during photosynthesis. | 1
Uses carbon dioxide | carbon dioxide, carbon | Plants use carbon dioxide from air. | 1
Produces glucose or food | glucose, food | Plants make glucose or food. | 1
Releases oxygen | oxygen | Oxygen is released during photosynthesis. | 1
```

The grader awards marks when either a keyword is found or a semantic similarity check indicates the expected meaning is present. This can handle paraphrased answers better than raw keyword matching alone.

## 🧩 Question Bank

The app supports saving reusable question records in SQLite:

- question title
- model answer
- rubric
- maximum marks

You can then:

- load saved questions,
- select one from a dropdown,
- reuse the rubric for a new grading session,
- and save or export final results for that question.

## 📡 API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Check whether the backend is running |
| `POST` | `/ocr` | Upload a typed image and extract text |
| `POST` | `/grade` | Grade text against a rubric |
| `POST` | `/questions` | Save a reusable question to the bank |
| `GET` | `/questions` | Load saved questions |
| `POST` | `/submissions` | Save a teacher-reviewed submission |
| `GET` | `/submissions` | Load saved submissions |
| `PUT` | `/submissions/{submission_id}` | Update a saved submission score |
| `DELETE` | `/submissions/{submission_id}` | Delete a saved submission |
| `GET` | `/exports/final-grades.csv` | Export final grades as CSV |
| `GET` | `/analytics/evaluation` | Get evaluation analytics |
| `GET` | `/uploads/{filename}` | Open an uploaded answer-sheet image |

## 🔄 Current Workflow

```text
Upload typed answer-sheet image
        ↓
Image preprocessing + Tesseract OCR
        ↓
Teacher corrects OCR text if needed
        ↓
Select or save question + rubric
        ↓
AI grading with keyword + semantic checks
        ↓
Teacher approves or overrides the score
        ���
SQLite saves the complete record
        ↓
Analytics and CSV export for review
```

## 📊 Analytics and Export Features

The application includes:

- total number of saved submissions,
- mean absolute error between AI and final teacher score,
- exact agreement rate,
- review flag rate,
- and CSV export of final grades for later analysis.

This makes it easier to assess grading quality over time and review cases flagged for teacher attention.

## ⚠️ Current Limitations

- OCR is intended for typed English text.
- Handwriting recognition is not included yet.
- Semantic matching depends on the `sentence-transformers` model and requires the model to be downloaded once.
- Uploaded scans are stored locally, so this version is intended for development and classroom testing.
- Login and user authentication are not included yet.

## 🔮 Future Improvements

1. ✂️ Question-wise answer segmentation
2. 🧠 More advanced semantic grading and rubric calibration
3. ✍️ Handwriting OCR with TrOCR or other recognition models
4. 🔐 Teacher login and student records
5. 📈 Class performance dashboards and trend analysis
6. 🐘 PostgreSQL for multi-user deployment
7. ☁️ Deployment, tests, and project documentation

## ✅ Summary

This project is a practical local-grade assistant for teachers. It combines OCR, rubric-based scoring, semantic similarity matching, question storage, analytics, and teacher review into a single workflow designed for fast and transparent subjective-answer evaluation.
