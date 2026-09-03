# Automated Answer Sheet Grader 🎓

An AI-powered web application designed to automatically evaluate student answer sheets, assign marks, and provide meaningful feedback.

## 🚀 Overview

The **Automated Answer Sheet Grader** aims to reduce the time and effort required for manual answer-sheet evaluation.

The system allows users to upload or submit student answers, processes the answers through the backend, evaluates them based on the expected answer or grading criteria, and displays the resulting marks and feedback.

## ✨ Features

- 📄 Upload and process answer sheets
- 🤖 Automated answer evaluation
- 📝 Automatic marks generation
- 💬 Feedback for student answers
- 🌐 Web-based user interface
- ⚡ Fast API backend
- 📊 Display grading results
- 🔄 Frontend-backend API communication

## 🏗️ Project Structure

```text
Automated Answer Sheet Grader/
│
├── frontend/              # React + Vite frontend
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
├── backend/               # FastAPI backend
│   ├── main.py
│   └── requirements.txt
│
├── .gitignore
└── README.md
```

## 🛠️ Technologies Used

### Frontend

- React
- Vite
- JavaScript
- HTML
- CSS

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn

### Development Tools

- Git
- GitHub
- npm

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/automated-answer-sheet-grader.git
```

Move into the project directory:

```bash
cd automated-answer-sheet-grader
```

---

## 🎨 Frontend Setup

Go to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

## 🐍 Backend Setup

Open another terminal and navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install the required packages:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
python -m uvicorn main:app --reload
```

The backend will normally run at:

```text
http://127.0.0.1:8000
```

FastAPI automatically provides interactive API documentation at:

```text
http://127.0.0.1:8000/docs
```

## 🔄 Application Architecture

```text
                User
                  │
                  ▼
          React Frontend
          localhost:5173
                  │
                  │ HTTP / REST API
                  ▼
           FastAPI Backend
          127.0.0.1:8000
                  │
                  ▼
        Answer Processing
                  │
                  ▼
          Grading / AI Logic
                  │
                  ▼
         Marks + Feedback
                  │
                  ▼
          React Frontend
```

## 📡 Example API

Example endpoint:

```http
GET /
```

Example response:

```json
{
  "message": "API is running"
}
```

An answer evaluation endpoint can be implemented as:

```http
POST /grade
```

Example request:

```json
{
  "student_answer": "Photosynthesis is the process by which plants make food."
}
```

Example response:

```json
{
  "score": 8,
  "feedback": "Good answer with the main concept correctly explained."
}
```

## 🔮 Future Improvements

- OCR-based answer-sheet text extraction
- AI-based semantic answer evaluation
- PDF/image answer-sheet processing
- Question and answer database
- Teacher dashboard
- Student performance analytics
- Automatic report generation
- Authentication and user accounts
- Database integration
- Improved grading accuracy

## 🎯 Project Goal

The primary goal of this project is to create a reliable and efficient system that can assist teachers and educational institutions by automating repetitive answer-sheet evaluation tasks while providing useful feedback to students.

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Commit your changes
5. Push the branch
6. Create a Pull Request

## 📄 License

This project is currently intended for educational and development purposes.
hello changes made
