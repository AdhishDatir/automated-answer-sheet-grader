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
        throw new Error(data.error || "Unable to grade the answer.");
      }

      setResult(data);
      setFinalScore(data.score);
      setApproved(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <h1>Automated Answer Sheet Grader</h1>
      <p>Enter a model answer and a student answer to get a suggested score.</p>

      <form onSubmit={gradeAnswer}>
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

      <button type="button" onClick={() => setApproved(true)}>
        Approve final score
      </button>

      {approved && (
        <p className="approved">
          Final score approved: <strong>{finalScore} / {result.max_marks}</strong>
        </p>
      )}
    </section>
      )}
    </main>
  );
}

export default App;