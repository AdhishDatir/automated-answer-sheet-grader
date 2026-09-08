import { useState } from "react";
import "./App.css";

function App() {
  const [modelAnswer, setModelAnswer] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [maxMarks, setMaxMarks] = useState(5);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [finalScore, setFinalScore] = useState("");
  const [approved, setApproved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [questionTitle, setQuestionTitle] = useState("");

  async function gradeAnswer(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_answer: modelAnswer,
          student_answer: studentAnswer,
          max_marks: Number(maxMarks),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to grade the answer.");
      }

      setResult(data);
      setFinalScore(data.score);
      setApproved(false);
    } catch (err) {
      setError(err.message);
    }
  }
  async function approveScore() {
  if (!result) return;

  setSaveMessage("");

  try {
    const response = await fetch("http://127.0.0.1:8000/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_name: studentName,
        question_title: questionTitle,
        model_answer: modelAnswer,
        student_answer: studentAnswer,
        ai_score: Number(result.score),
        final_score: Number(finalScore),
        max_marks: Number(result.max_marks),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not save the grade.");
    }

    setApproved(true);
    setSaveMessage(`Saved successfully. Submission ID: ${data.submission_id}`);
    loadSubmissions();
  } catch (error) {
    setApproved(false);
    setSaveMessage(error.message);
  }
}
  async function loadSubmissions() {
  setLoadingSubmissions(true);

  try {
    const response = await fetch("http://127.0.0.1:8000/submissions");

    if (!response.ok) {
      throw new Error("Could not load saved submissions.");
    }

    const data = await response.json();
    setSubmissions(data);
  } catch (error) {
    setSaveMessage(error.message);
  } finally {
    setLoadingSubmissions(false);
  }
}
  return (
    <main>
      <h1>Automated Answer Sheet Grader</h1>
      <p>Enter a model answer and a student answer to get a suggested score.</p>

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
            placeholder="Example: What is the capital of France?"
            required
          />
        </label>
        <label> 
          Model answer
          <textarea
            value={modelAnswer}
            onChange={(event) => setModelAnswer(event.target.value)}
            placeholder="Enter the teacher's expected answer"
            required
          />
        </label>

        <label>
          Student answer
          <textarea
            value={studentAnswer}
            onChange={(event) => setStudentAnswer(event.target.value)}
            placeholder="Enter the student's answer"
            required
          />
        </label>

        <label>
          Maximum marks
          <input
            type="number"
            min="1"
            value={maxMarks}
            onChange={(event) => setMaxMarks(event.target.value)}
          />
        </label>

        <button type="submit">Grade answer</button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
      <section className="result">
      <h2>AI suggested result</h2>

      <p>
        AI score: <strong>{result.score} / {result.max_marks}</strong>
      </p>

      <p>Confidence: {result.confidence}%</p>

      <p>
        Matched concepts: {result.matched_words.join(", ") || "None"}
      </p>

      <p>
        Missing concepts: {result.missing_words.join(", ") || "None"}
      </p>

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
      {saveMessage && <p className="approved">{saveMessage}</p>}

      {approved && (
        <p className="approved">
          Final score approved: <strong>{finalScore} / {result.max_marks}</strong>
        </p>
      )}
     
    </section>
      )}
      <section className="history">
      <div className="history-header">
    <h2>Saved Submissions</h2>

    <button type="button" onClick={loadSubmissions}>
      {loadingSubmissions ? "Loading..." : "Load saved grades"}
    </button>
  </div>

  {submissions.length === 0 ? (
    <p>No saved grades loaded yet.</p>
  ) : (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>AI Score</th>
            <th>Final Score</th>
            <th>Maximum</th>
            <th>Saved At</th>
          </tr>
        </thead>

        <tbody>
          {submissions.map((submission) => (
            <tr key={submission.id}>
              <td>{submission.id}</td>
              <td>{submission.ai_score}</td>
              <td>{submission.final_score}</td>
              <td>{submission.max_marks}</td>
              <td>
                {new Date(submission.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</section>
    </main>
  );

}

export default App;