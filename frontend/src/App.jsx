import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
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

  useEffect(() => {
  if (!ocrFile) {
    setImagePreview("");
    return;
  }

  const previewUrl = URL.createObjectURL(ocrFile);
  setImagePreview(previewUrl);

  return () => URL.revokeObjectURL(previewUrl);
  }, [ocrFile]);

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

      if (
        !point ||
        !keywordsText ||
        !semanticReference ||
        !marks ||
        marks <= 0
      ) {
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
    const response = await fetch(`${API_BASE_URL}/ocr`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "OCR could not extract text.");
    }

    // Sends OCR output into the editable Student Answer field.
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
      const parsedRubric = parseRubric();

      const response = await fetch(`${API_BASE_URL}/grade`, {
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
      const response = await fetch(`${API_BASE_URL}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        student_name: studentName,
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
      const response = await fetch(`${API_BASE_URL}/submissions`);

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

  try {
    const response = await fetch(
      `${API_BASE_URL}/submissions/${submission.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          final_score: Number(newScore),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not update the score.");
    }

    setSaveMessage(data.message);
    loadSubmissions();
  } catch (err) {
    setError(err.message);
  }
}


async function deleteSubmission(submissionId) {
  const confirmed = window.confirm(
    "Delete this saved grade? This cannot be undone."
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/submissions/${submissionId}`,
      { method: "DELETE" }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not delete the submission.");
    }

    setSaveMessage(data.message);
    loadSubmissions();
  } catch (err) {
    setError(err.message);
  }
}


async function loadAnalytics() {
  setLoadingAnalytics(true);
  setError("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/analytics/evaluation`
    );

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

  return (
    <main>
      <h1>Automated Answer Sheet Grader</h1>
      <p>AI suggests marks using a teacher-defined rubric.</p>

      <form onSubmit={gradeAnswer}>
        <label>
          Student name
          <input
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            placeholder="Example: Adhi Kumar"
            required
          />
        </label>

        <label>
          Question title
          <input
            value={questionTitle}
            onChange={(event) => setQuestionTitle(event.target.value)}
            placeholder="Example: Explain photosynthesis"
            required
          />
        </label>

        <label>
          Model answer
          <textarea
            value={modelAnswer}
            onChange={(event) => setModelAnswer(event.target.value)}
            placeholder="Teacher's reference answer"
            required
          />
        </label>
        <label>
          Upload typed answer sheet image
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
           onChange={(event) => {
              setOcrFile(event.target.files?.[0] || null);
              setStoredImagePath("");
            }}
          />
        </label>

        <button
          type="button"
          onClick={extractTextFromImage}
          disabled={ocrLoading}
        >
          {ocrLoading ? "Extracting text..." : "Extract text from image"}
        </button>
                <div className="ocr-review-grid">
          <div className="image-preview">
            <h3>Uploaded answer sheet</h3>

            {imagePreview ? (
              <img src={imagePreview} alt="Uploaded answer sheet preview" />
            ) : (
              <p>Select an image to see its preview.</p>
            )}
          </div>

        <label>
          Student answer — editable OCR text
          <textarea
            value={studentAnswer}
            onChange={(event) => setStudentAnswer(event.target.value)}
            placeholder="OCR text will appear here after extraction"
            required
          />
        </label>
      </div>

        <label>
          Rubric — one point per line
          <textarea
            value={rubricText}
            onChange={(event) => setRubricText(event.target.value)}
            placeholder={`Uses sunlight | sunlight | Plants use sunlight for photosynthesis. | 1
                  Uses water | water | Plants need water during photosynthesis. | 1
                  Uses carbon dioxide | carbon dioxide, carbon | Plants use carbon dioxide from air. | 1
                  Produces glucose or food | glucose, food | Plants make glucose or food. | 1
                  Releases oxygen | oxygen | Oxygen is released during photosynthesis. | 1`}
            required
          />
        </label>

        <p>
          Format: <code>Rubric point |keywords |expected meaning | marks</code>
        </p>

        <button type="submit" disabled={loading}>
          {loading ? "Grading..." : "Grade answer"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="result">
          <h2>AI suggested result</h2>
          <p>
            Score: <strong>{result.score} / {result.max_marks}</strong>
          </p>
          <p>Rubric coverage: {result.confidence}%</p>
          {result.needs_review && (
            <div className="review-warning">
              <strong>⚠️ Teacher review required</strong>
              <p>{result.review_reason}</p>
            </div>
          )}

          <h3>Rubric breakdown</h3>
          <ul>
            {result.rubric_breakdown.map((item) => (
              <li key={item.point}>
                <strong>{item.point}</strong>: {item.awarded_marks} / {item.marks}
                <br />
                Method: {item.match_method}
                <br />
                Semantic similarity: {item.semantic_similarity}%
              </li>
            ))}
          </ul>

          <hr />

          <h2>Teacher review</h2>

          <label>
            Final score
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

          <button type="button" onClick={approveScore}>
            Approve and save final score
          </button>

          {approved && (
            <p className="approved">
              Approved: {finalScore} / {result.max_marks}
            </p>
          )}

          {saveMessage && <p className="approved">{saveMessage}</p>}
        </section>
      )}
      

      <section className="history">
        <h2>Saved submissions</h2>

        <button type="button" onClick={loadSubmissions}>
          {loadingSubmissions ? "Loading..." : "Load saved grades"}
        </button>

        {submissions.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Question</th>
                <th>AI score</th>
                <th>Final score</th>
                <th>Maximum</th>
                <th>Answer Sheet</th>
                <th>Actions</th>
                
              </tr>
            </thead>

            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td>{submission.student_name}</td>
                  <td>{submission.question_title}</td>
                  <td>{submission.ai_score}</td>
                  <td>{submission.final_score}</td>
                  <td>{submission.max_marks}</td>
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
                        "No image"
                      )}
                    </td>
                    <td>
                          <button
                            type="button"
                            onClick={() => updateFinalScore(submission)}
                          >
                            Edit score
                          </button>

                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => deleteSubmission(submission.id)}
                          >
                            Delete
                          </button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      
      <section className="analytics">
            <h2>Evaluation Analytics</h2>

            <button type="button" onClick={loadAnalytics}>
              {loadingAnalytics ? "Loading..." : "Load analytics"}
            </button>

            {analytics && (
              <div className="analytics-grid">
                <div className="metric">
                  <span>Total submissions - </span>
                  <strong>{analytics.total_submissions}</strong>
                </div>

                <div className="metric">
                  <span>Mean Absolute Error - </span>
                  <strong>{analytics.mean_absolute_error}</strong>
                </div>

                <div className="metric">
                  <span>Exact score agreement - </span>
                  <strong>{analytics.exact_score_agreement}%</strong>
                </div>

                <div className="metric">
                  <span>Teacher-review flags - </span>
                  <strong>{analytics.review_flag_rate}%</strong>
                </div>
              </div>
            )}
          </section>
    </main>
  );
}

export default App;