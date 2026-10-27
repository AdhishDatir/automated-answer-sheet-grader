import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

const RUBRIC_PLACEHOLDER = [
  "Uses sunlight | sunlight | Plants use sunlight for photosynthesis. | 1",
  "Uses water | water | Plants need water during photosynthesis. | 1",
  "Uses carbon dioxide | carbon dioxide, carbon | Plants use carbon dioxide from air. | 1",
  "Produces glucose or food | glucose, food | Plants make glucose or food. | 1",
  "Releases oxygen | oxygen | Oxygen is released during photosynthesis. | 1",
].join("\n");

const TABS = [
  { id: "single", label: "Grade one sheet" },
  { id: "batch", label: "Batch grading" },
  { id: "records", label: "Saved grades" },
  { id: "analytics", label: "Analytics" },
];

function ScoreRing({ score, max }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(Math.max(score / max, 0), 1) : 0;
  return (
    <div className="score-ring" role="img" aria-label={`Score ${score} out of ${max}`}>
      <svg viewBox="0 0 100 100">
        <circle className="ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="ring-value"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={`${circumference * ratio} ${circumference}`}
        />
      </svg>
      <div className="ring-label">
        <strong>{score}</strong>
        <span>of {max}</span>
      </div>
    </div>
  );
}

function getStoredTeacher() {
  try {
    const savedTeacher = localStorage.getItem("gradewise_teacher");
    return savedTeacher ? JSON.parse(savedTeacher) : null;
  } catch {
    return null;
  }
}

function App() {
  const [tab, setTab] = useState("single");

  const [studentName, setStudentName] = useState("");
  const [questionTitle, setQuestionTitle] = useState("");
  const [modelAnswer, setModelAnswer] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [rubricText, setRubricText] = useState("");

  const [result, setResult] = useState(null);
  const [rubricItems, setRubricItems] = useState([]);
  const [finalScore, setFinalScore] = useState("");
  const [approved, setApproved] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [storedImagePath, setStoredImagePath] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const [batchFiles, setBatchFiles] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [teacher, setTeacher] = useState(getStoredTeacher);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");


  useEffect(() => {
    if (!ocrFile) {
      setImagePreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(ocrFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [ocrFile]);

  // Load saved data once when the page opens.
 useEffect(() => {
  if (!teacher) return;

  loadQuestions();
  loadSubmissions();
  loadAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [teacher]);

  function parseRubric() {
    const lines = rubricText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new Error("Add at least one rubric point.");
    }

    return lines.map((line, index) => {
      const parts = line.split("|").map((part) => part.trim());

      if (parts.length !== 4) {
        throw new Error(
          `Rubric line ${index + 1} must use: Point | keywords | expected meaning | marks`
        );
      }

      const [point, keywordsText, semanticReference, marksText] = parts;
      const marks = Number(marksText);

      if (!point || !keywordsText || !semanticReference || !marks || marks <= 0) {
        throw new Error(`Rubric line ${index + 1} is invalid.`);
      }

      return {
        point,
        keywords: keywordsText
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean),
        semantic_reference: semanticReference,
        marks,
      };
    });
  }


  async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (teacher?.token) {
    headers.set("Authorization", `Bearer ${teacher.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("gradewise_teacher");
    setTeacher(null);
  }

  return response;
}

async function handleAuthentication(event) {
  event.preventDefault();

  setAuthLoading(true);
  setAuthError("");

  try {
    const endpoint =
      authMode === "register" ? "/auth/register" : "/auth/login";

    const body =
      authMode === "register"
        ? {
            name: authName,
            email: authEmail,
            password: authPassword,
          }
        : {
            email: authEmail,
            password: authPassword,
          };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Authentication failed.");
    }

    if (authMode === "register") {
      setAuthMode("login");
      setAuthPassword("");
      setAuthError("Account created. Please log in.");
      return;
    }

    const loggedInTeacher = {
      ...data.teacher,
      token: data.token,
    };

    localStorage.setItem(
      "gradewise_teacher",
      JSON.stringify(loggedInTeacher)
    );

    setTeacher(loggedInTeacher);
    setAuthPassword("");
  } catch (err) {
    setAuthError(err.message);
  } finally {
    setAuthLoading(false);
  }
}

function logoutTeacher() {
  localStorage.removeItem("gradewise_teacher");
  setTeacher(null);
  setQuestions([]);
  setSubmissions([]);
  setAnalytics(null);
}

  async function extractTextFromImage() {
    if (!ocrFile) {
      setError("Choose an answer-sheet image first.");
      return;
    }

    setOcrLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", ocrFile);

    try {
      const response = await apiFetch("/ocr", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "OCR could not extract text.");
      }

      setStudentAnswer(data.extracted_text);
      setStoredImagePath(data.image_path);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcrLoading(false);
    }
  }

  async function gradeAnswer(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSaveMessage("");
    setResult(null);
    setApproved(false);

    try {
      if (!modelAnswer.trim()) {
        throw new Error("Add a model answer in the Question panel first.");
      }
      const parsedRubric = parseRubric();

      const response = await apiFetch("/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_answer: modelAnswer,
          student_answer: studentAnswer,
          rubric: parsedRubric,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to grade the answer.");
      }

      setRubricItems(parsedRubric);
      setResult(data);
      setFinalScore(data.score);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveScore() {
    if (!result) return;

    setSaveMessage("");
    setError("");

    try {
      const response = await apiFetch("/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName,
          question_id: selectedQuestionId ? Number(selectedQuestionId) : null,
          question_title: questionTitle,
          model_answer: modelAnswer,
          student_answer: studentAnswer,
          rubric: rubricItems,
          image_path: storedImagePath,
          ai_score: Number(result.score),
          final_score: Number(finalScore),
          max_marks: Number(result.max_marks),
          needs_review: result.needs_review,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save the grade.");
      }

      setApproved(true);
      setSaveMessage(`Saved successfully. Submission ID: ${data.submission_id}`);
      loadSubmissions();
      loadAnalytics();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSubmissions() {
    setLoadingSubmissions(true);

    try {
      const response = await apiFetch("/submissions");
      if (!response.ok) {
        throw new Error("Could not load saved submissions.");
      }
      setSubmissions(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSubmissions(false);
    }
  }

  async function updateFinalScore(submission) {
    const newScore = window.prompt(
      `Enter the new final score. Maximum: ${submission.max_marks}`,
      submission.final_score
    );

    if (newScore === null) return;
    if (!Number.isFinite(Number(newScore))) {
      setError("Enter a valid numeric score.");
      return;
    }

    try {
      const response = await apiFetch(`/submissions/${submission.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_score: Number(newScore) }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not update the score.");
      }

      setSaveMessage(data.message);
      loadSubmissions();
      loadAnalytics();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteSubmission(submissionId) {
    const confirmed = window.confirm("Delete this saved grade? This cannot be undone.");
    if (!confirmed) return;

    try {
      const response = await apiFetch(`/submissions/${submissionId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not delete the submission.");
      }

      setSaveMessage(data.message);
      loadSubmissions();
      loadAnalytics();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadAnalytics() {
    setLoadingAnalytics(true);

    try {
      const response = await apiFetch("/analytics/evaluation");
      const data = await response.json();

      if (!response.ok) {
        throw new Error("Could not load evaluation analytics.");
      }

      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  function rubricToText(rubric) {
    return rubric
      .map(
        (item) =>
          `${item.point} | ${item.keywords.join(", ")} | ${item.semantic_reference} | ${item.marks}`
      )
      .join("\n");
  }

  async function loadQuestions() {
    setLoadingQuestions(true);

    try {
      const response = await apiFetch("/questions");
      if (!response.ok) {
        throw new Error("Could not load questions.");
      }
      setQuestions(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function saveQuestion() {
    if (!questionTitle.trim() || !modelAnswer.trim()) {
      setError("Enter a question title and model answer before saving.");
      return;
    }
    try {
      const parsedRubric = parseRubric();

      const response = await apiFetch("/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: questionTitle,
          model_answer: modelAnswer,
          rubric: parsedRubric,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save question.");
      }

      setSaveMessage(`Question saved. ID: ${data.question_id}`);
      loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  }

  function selectQuestion(questionId) {
    setSelectedQuestionId(questionId);

    const question = questions.find((item) => item.id === Number(questionId));
    if (!question) return;

    setQuestionTitle(question.title);
    setModelAnswer(question.model_answer);
    setRubricText(rubricToText(question.rubric));
  }

async function exportFinalGrades() {
  try {
    const questionFilter = selectedQuestionId
      ? `?question_id=${selectedQuestionId}`
      : "";

    const response = await apiFetch(
      `/exports/final-grades.csv${questionFilter}`
    );

    if (!response.ok) {
      throw new Error("Could not export final grades.");
    }

    const csvFile = await response.blob();
    const downloadUrl = URL.createObjectURL(csvFile);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "final-grades.csv";
    link.click();

    URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    setError(err.message);
  }
}
  function studentNameFromFile(fileName) {
    return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
  }

  async function gradeBatchAnswers() {
    if (batchFiles.length === 0) {
      setError("Select one or more answer-sheet images first.");
      return;
    }

    let parsedRubric;
    try {
      parsedRubric = parseRubric();
    } catch (err) {
      setError(err.message);
      return;
    }

    if (!modelAnswer.trim()) {
      setError("Select a Question Bank question or enter a model answer.");
      return;
    }

    setBatchLoading(true);
    setBatchResults([]);
    setError("");

    const results = [];

    for (let index = 0; index < batchFiles.length; index += 1) {
      const file = batchFiles[index];

      try {
        setBatchProgress(`Processing ${index + 1} of ${batchFiles.length}: ${file.name}`);

        // Step 1: OCR
        const formData = new FormData();
        formData.append("file", file);

        const ocrResponse = await apiFetch("/ocr", {
          method: "POST",
          body: formData,
        });
        if (!ocrResponse.ok) {
          throw new Error("OCR could not read this image.");
        }
        const ocrData = await ocrResponse.json();

        // Step 2: AI grading
        const gradeResponse = await apiFetch("/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model_answer: modelAnswer,
            student_answer: ocrData.extracted_text,
            rubric: parsedRubric,
          }),
        });
        if (!gradeResponse.ok) {
          throw new Error("AI grading failed for this image.");
        }
        const gradeData = await gradeResponse.json();

        // Step 3: save grade to SQLite
        const saveResponse = await apiFetch("/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_name: studentNameFromFile(file.name),
            question_id: selectedQuestionId ? Number(selectedQuestionId) : null,
            question_title: questionTitle,
            model_answer: modelAnswer,
            student_answer: ocrData.extracted_text,
            rubric: parsedRubric,
            image_path: ocrData.image_path || "",
            ai_score: Number(gradeData.score),
            final_score: Number(gradeData.score),
            max_marks: Number(gradeData.max_marks),
            needs_review: gradeData.needs_review,
          }),
        });
        if (!saveResponse.ok) {
          throw new Error("Grade was created but could not be saved.");
        }

        results.push({
          fileName: file.name,
          status: "Saved",
          score: gradeData.score,
          maxMarks: gradeData.max_marks,
        });
      } catch (err) {
        results.push({ fileName: file.name, status: err.message || "Failed" });
      }

      setBatchResults([...results]);
    }

    setBatchProgress(`Completed: ${batchFiles.length} answer sheets processed.`);
    setBatchLoading(false);

    loadSubmissions();
    loadAnalytics();
  }

  async function deleteSelectedQuestion() {
    if (!selectedQuestionId) {
      setError("Select a Question Bank item before deleting it.");
      return;
    }

    const question = questions.find((item) => item.id === Number(selectedQuestionId));
    const confirmed = window.confirm(`Delete this Question Bank item?\n\n${question?.title || ""}`);
    if (!confirmed) return;

    try {
      const response = await apiFetch(`/questions/${selectedQuestionId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not delete the question.");
      }

      setSaveMessage(data.message);
      setSelectedQuestionId("");
      setQuestionTitle("");
      setModelAnswer("");
      setRubricText("");
      setRubricItems([]);
      loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateSelectedQuestion() {
    if (!selectedQuestionId) {
      setError("Select a Question Bank item before updating it.");
      return;
    }

    try {
      const parsedRubric = parseRubric();

      const response = await apiFetch(`/questions/${selectedQuestionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: questionTitle,
          model_answer: modelAnswer,
          rubric: parsedRubric,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not update the question.");
      }

      setRubricItems(parsedRubric);
      setSaveMessage(data.message);
      loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  }

  function dismissMessages() {
    setError("");
    setSaveMessage("");
  }

if (!teacher) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-logo">✓</p>
        <p className="eyebrow">GRADEWISE AI</p>

        <h1>
          {authMode === "login"
            ? "Welcome back"
            : "Create teacher account"}
        </h1>

        <p className="auth-description">
          {authMode === "login"
            ? "Log in to access your grading dashboard."
            : "Create an account to manage questions and grades."}
        </p>

        <form onSubmit={handleAuthentication} className="auth-form">
          {authMode === "register" && (
            <label className="field">
              <span>Full name</span>
              <input
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
                placeholder="Example: Adhi Kumar"
                required
              />
            </label>
          )}

          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="teacher@example.com"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              minLength="8"
              required
            />
          </label>

          {authError && <p className="auth-error">{authError}</p>}

          <button type="submit" className="btn primary auth-submit">
            {authLoading
              ? "Please wait..."
              : authMode === "login"
              ? "Log in"
              : "Create account"}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setAuthMode(authMode === "login" ? "register" : "login");
            setAuthError("");
          }}
        >
          {authMode === "login"
            ? "New teacher? Create an account"
            : "Already have an account? Log in"}
        </button>
      </section>
    </main>
  );
}


  return (
    <div className="app">
      <header className="topbar">
        <div className="teacher-menu">
            <span>👤 {teacher.name}</span>

            <button
              type="button"
              className="btn ghost small logout-button"
              onClick={logoutTeacher}
            >
              Logout
            </button>
          </div>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <div>
            <h1>Answer Sheet Grader</h1>
            <p>AI suggests marks from your rubric. You make the final call.</p>
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab ${tab === item.id ? "active" : ""}`}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="layout">
        {/* ---------- Question setup (always visible) ---------- */}
        <aside className="panel question-panel">
          <div className="panel-head">
            <h2>Question</h2>
            <button type="button" className="btn ghost small" onClick={loadQuestions}>
              {loadingQuestions ? "Refreshing…" : "Refresh bank"}
            </button>
          </div>

          <label className="field">
            <span>Saved questions</span>
            <select
              value={selectedQuestionId}
              onChange={(event) => selectQuestion(event.target.value)}
            >
              <option value="">
                {questions.length ? "Choose a saved question" : "No saved questions yet"}
              </option>
              {questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.title} ({question.max_marks} marks)
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Question title</span>
            <input
              value={questionTitle}
              onChange={(event) => setQuestionTitle(event.target.value)}
              placeholder="Example: Explain photosynthesis"
            />
          </label>

          <label className="field">
            <span>Model answer</span>
            <textarea
              value={modelAnswer}
              onChange={(event) => setModelAnswer(event.target.value)}
              placeholder="Teacher's reference answer"
            />
          </label>

          <label className="field">
            <span>Rubric, one point per line</span>
            <textarea
              className="mono"
              rows={7}
              value={rubricText}
              onChange={(event) => setRubricText(event.target.value)}
              placeholder={RUBRIC_PLACEHOLDER}
            />
            <small>
              Format: <code>Point | keywords | expected meaning | marks</code>
            </small>
          </label>

          <div className="button-row">
            <button type="button" className="btn secondary" onClick={saveQuestion}>
              Save as new
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={updateSelectedQuestion}
              disabled={!selectedQuestionId}
            >
              Update selected
            </button>
            <button
              type="button"
              className="btn danger-outline"
              onClick={deleteSelectedQuestion}
              disabled={!selectedQuestionId}
            >
              Delete
            </button>
          </div>
        </aside>

        {/* ---------- Workspace ---------- */}
        <main className="workspace">
          {(error || saveMessage) && (
            <div className={`banner ${error ? "banner-error" : "banner-success"}`} role="status">
              <span>{error || saveMessage}</span>
              <button type="button" aria-label="Dismiss message" onClick={dismissMessages}>
                ×
              </button>
            </div>
          )}

          {/* ----- Single sheet ----- */}
          {tab === "single" && (
            <>
              <form className="panel" onSubmit={gradeAnswer}>
                <div className="panel-head">
                  <h2>Answer sheet</h2>
                </div>

                <label className="field">
                  <span>Student name</span>
                  <input
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    placeholder="Example: Adhi Kumar"
                    required
                  />
                </label>

                <div className="ocr-grid">
                  <div className="scan">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Uploaded answer sheet preview" />
                    ) : (
                      <div className="scan-empty">
                        <strong>No scan selected</strong>
                        <span>Choose a PNG or JPG of the handwritten answer.</span>
                      </div>
                    )}
                    <div className="scan-actions">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={(event) => setOcrFile(event.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={extractTextFromImage}
                        disabled={ocrLoading || !ocrFile}
                      >
                        {ocrLoading ? "Reading handwriting…" : "Extract text"}
                      </button>
                    </div>
                  </div>

                  <label className="field fill">
                    <span>Student answer (edit any OCR mistakes)</span>
                    <textarea
                      value={studentAnswer}
                      onChange={(event) => setStudentAnswer(event.target.value)}
                      placeholder="Extracted text appears here. You can also type or paste an answer."
                      required
                    />
                  </label>
                </div>

                <div className="button-row">
                  <button type="submit" className="btn primary" disabled={loading}>
                    {loading ? "Grading…" : "Grade answer"}
                  </button>
                </div>
              </form>

              {result && (
                <section className="panel result">
                  <div className="result-head">
                    <ScoreRing score={Number(result.score)} max={Number(result.max_marks)} />
                    <div>
                      <h2>AI suggested score</h2>
                      <p className="muted">Rubric coverage: {result.confidence}%</p>
                    </div>
                  </div>

                  {result.needs_review && (
                    <div className="review-warning">
                      <strong>Teacher review required</strong>
                      <p>{result.review_reason}</p>
                    </div>
                  )}

                  <h3>Rubric breakdown</h3>
                  <ul className="breakdown">
                    {result.rubric_breakdown.map((item, index) => {
                      const earned = item.marks > 0 ? item.awarded_marks / item.marks : 0;
                      return (
                        <li key={`${item.point}-${index}`}>
                          <div className="breakdown-top">
                            <strong>{item.point}</strong>
                            <span className={earned >= 1 ? "pill pill-good" : earned > 0 ? "pill pill-mid" : "pill pill-miss"}>
                              {item.awarded_marks} / {item.marks}
                            </span>
                          </div>
                          <div className="bar" aria-hidden="true">
                            <div style={{ width: `${Math.min(earned, 1) * 100}%` }} />
                          </div>
                          <small className="muted">
                            Matched by {item.match_method} · semantic similarity {item.semantic_similarity}%
                          </small>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="review-box">
                    <h3>Your final score</h3>
                    <div className="review-row">
                      <label className="field score-field">
                        <span>Out of {result.max_marks}</span>
                        <input
                          type="number"
                          min="0"
                          max={result.max_marks}
                          step="0.1"
                          value={finalScore}
                          onChange={(event) => {
                            setFinalScore(event.target.value);
                            setApproved(false);
                          }}
                        />
                      </label>
                      <button type="button" className="btn primary" onClick={approveScore}>
                        Approve and save
                      </button>
                    </div>
                    {approved && (
                      <p className="approved">
                        Approved: {finalScore} / {result.max_marks}
                      </p>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ----- Batch ----- */}
          {tab === "batch" && (
            <section className="panel">
              <div className="panel-head">
                <h2>Batch grading</h2>
              </div>
              <p className="muted">
                Grades every image against the question on the left. Each filename becomes the
                student name, and results are saved automatically.
              </p>

              <label className="dropzone">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setBatchFiles(Array.from(event.target.files || []))}
                />
                <strong>
                  {batchFiles.length > 0
                    ? `${batchFiles.length} image${batchFiles.length > 1 ? "s" : ""} selected`
                    : "Choose answer-sheet images"}
                </strong>
                <span>
                  {batchFiles.length > 0
                    ? batchFiles.map((file) => file.name).join(", ")
                    : "Select several files at once. PNG or JPG."}
                </span>
              </label>

              <div className="button-row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={gradeBatchAnswers}
                  disabled={batchLoading}
                >
                  {batchLoading ? "Grading…" : "Grade selected sheets"}
                </button>
              </div>

              {batchProgress && <p className="progress-note">{batchProgress}</p>}

              {batchResults.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Image file</th>
                        <th>Status</th>
                        <th className="num">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map((item, index) => (
                        <tr key={`${item.fileName}-${index}`}>
                          <td>{item.fileName}</td>
                          <td>
                            <span className={item.status === "Saved" ? "pill pill-good" : "pill pill-miss"}>
                              {item.status}
                            </span>
                          </td>
                          <td className="num">
                            {item.score !== undefined ? `${item.score} / ${item.maxMarks}` : "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ----- Records ----- */}
          {tab === "records" && (
            <section className="panel">
              <div className="panel-head">
                <h2>Saved grades</h2>
                <div className="button-row tight">
                  <button type="button" className="btn ghost small" onClick={loadSubmissions}>
                    {loadingSubmissions ? "Loading…" : "Refresh"}
                  </button>
                  <button type="button" className="btn secondary small" onClick={exportFinalGrades}>
                    Export CSV
                  </button>
                </div>
              </div>

              {submissions.length === 0 ? (
                <div className="empty">
                  <strong>No saved grades yet</strong>
                  <span>Approve a score or run a batch and it will show up here.</span>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Question</th>
                        <th className="num">AI</th>
                        <th className="num">Final</th>
                        <th className="num">Max</th>
                        <th>Scan</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => (
                        <tr key={submission.id}>
                          <td>{submission.student_name}</td>
                          <td>{submission.question_title}</td>
                          <td className="num">{submission.ai_score}</td>
                          <td className="num">
                            <strong>{submission.final_score}</strong>
                          </td>
                          <td className="num">{submission.max_marks}</td>
                          <td>
                            {submission.image_path ? (
                              <a
                                href={`${API_BASE_URL}${submission.image_path}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View scan
                              </a>
                            ) : (
                              <span className="muted">None</span>
                            )}
                          </td>
                          <td>
                            <div className="button-row tight">
                              <button
                                type="button"
                                className="btn secondary small"
                                onClick={() => updateFinalScore(submission)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn danger-outline small"
                                onClick={() => deleteSubmission(submission.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ----- Analytics ----- */}
          {tab === "analytics" && (
            <section className="panel">
              <div className="panel-head">
                <h2>Evaluation analytics</h2>
                <button type="button" className="btn ghost small" onClick={loadAnalytics}>
                  {loadingAnalytics ? "Loading…" : "Refresh"}
                </button>
              </div>

              {analytics ? (
                <div className="metrics">
                  <div className="metric">
                    <strong>{analytics.total_submissions}</strong>
                    <span>Total submissions</span>
                  </div>
                  <div className="metric">
                    <strong>{analytics.mean_absolute_error}</strong>
                    <span>Mean absolute error</span>
                  </div>
                  <div className="metric">
                    <strong>{analytics.exact_score_agreement}%</strong>
                    <span>Exact score agreement</span>
                  </div>
                  <div className="metric">
                    <strong>{analytics.review_flag_rate}%</strong>
                    <span>Flagged for teacher review</span>
                  </div>
                </div>
              ) : (
                <div className="empty">
                  <strong>No analytics loaded</strong>
                  <span>Select Refresh to compare AI scores with your final scores.</span>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;