import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./ModelPage.css";

// ✅ ADD THIS
const BASE_URL = "http://127.0.0.1:5000";

function ModelPage() {
  const [result, setResult] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [treeImage, setTreeImage] = useState(null);
  const [loadingModel, setLoadingModel] = useState(null);

  const navigate = useNavigate();

  // 🔐 PROTECT PAGE (LOGIN REQUIRED)
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
    }
  }, [navigate]);

  // 🔥 RUN MODEL
  const runModel = async (model) => {
    try {
      setLoadingModel(model);

      const res = await fetch(`${BASE_URL}/run-model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model })
      });

      if (!res.ok) throw new Error("Server error");

      const text = await res.text();

let data;
try {
  data = JSON.parse(text);
} catch {
  throw new Error("Server returned HTML instead of JSON ❌");
}
      console.log("API RESPONSE:", data);

      const newResult = {
        model,
        train: Number(data.training_accuracy || 0),
        test: Number(data.testing_accuracy || 0),
        cv_mean: Number(data.cv_mean || 0),
        cv_std: Number(data.cv_std || 0),
        cv_scores: data.cv_scores || [],
        top_features: data.top_features || []
      };

      setResult(newResult);

      setAllResults((prev) => {
        const filtered = prev.filter((p) => p.model !== model);
        return [...filtered, newResult];
      });

      if (data.tree_image && model !== "1D CNN") {
        setTreeImage(data.tree_image);
      } else {
        setTreeImage(null);
      }

    } catch (err) {
      console.error(err);
      alert("Backend connection error ❌\nCheck API URL or server");
    } finally {
      setLoadingModel(null);
    }
  };

  // 🔥 CLEAR RESULTS
  const clearResults = async () => {
    try {
      await fetch(`${BASE_URL}/clear-results`, {
        method: "DELETE"
      });
    } catch {}

    setResult(null);
    setAllResults([]);
    setTreeImage(null);
  };

  return (
    <div className="page">
      <div className="card">
        <h1>Select Machine Learning Model</h1>

        {/* MODEL BUTTONS */}
        {["Decision Tree", "Random Forest", "1D CNN", "LGBM"].map((m) => (
          <button
            key={m}
            onClick={() => runModel(m)}
            className="model-btn"
            disabled={loadingModel !== null}
          >
            {loadingModel === m ? "Running..." : m}
          </button>
        ))}

        <button className="clear-btn" onClick={clearResults}>
          Clear Results
        </button>

        {/* RESULT CARD */}
        {result && (
          <div className="result-card">
            <h2>{result.model}</h2>

            <p>Training Accuracy: {result.train.toFixed(4)}</p>
            <p>Testing Accuracy: {result.test.toFixed(4)}</p>
            <p>CV Mean: {result.cv_mean.toFixed(4)}</p>
            <p>CV Std: {result.cv_std.toFixed(4)}</p>

            {/* CV SCORES */}
            {result.cv_scores.length > 0 && (
              <div style={{ marginTop: "15px" }}>
                <h4>Cross Validation Scores</h4>
                {result.cv_scores.map((score, i) => (
                  <p key={i}>
                    Fold {i + 1}: {Number(score).toFixed(4)}
                  </p>
                ))}
              </div>
            )}

            {/* TOP FEATURES */}
            {result.top_features.length > 0 && (
              <div style={{ marginTop: "15px" }}>
                <h4>Top Features</h4>
                {result.top_features.map((f, i) => (
                  <p key={i}>
                    {f[0]} : {Number(f[1]).toFixed(3)}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TREE IMAGE */}
        {treeImage && result && (
          <div className="tree-card">
            <h3>{result.model} Visualization</h3>
            <img
              src={`data:image/png;base64,${treeImage}`}
              alt="tree"
              className="tree-img"
            />
          </div>
        )}
      </div>

      {/* TABLE */}
      {allResults.length > 0 && (
        <div className="table-card">
          <h2>Model Comparison</h2>

          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Train</th>
                <th>Test</th>
                <th>CV Mean</th>
              </tr>
            </thead>

            <tbody>
              {allResults.map((r, i) => (
                <tr key={i}>
                  <td>{r.model}</td>
                  <td>{r.train.toFixed(4)}</td>
                  <td className="test">{r.test.toFixed(4)}</td>
                  <td>{r.cv_mean.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            className="viz-btn"
            onClick={() =>
              navigate("/chart", { state: { results: allResults } })
            }
          >
            View Model Comparison
          </button>

          <button
            className="viz-btn"
            onClick={() => navigate("/anova")}
          >
            View ANOVA Test
          </button>

          {result && result.cv_scores.length > 0 && (
            <button
              className="viz-btn"
              style={{
                marginTop: "10px",
                borderColor: "#ffcc00",
                color: "#ffcc00"
              }}
              onClick={() =>
                navigate("/chart", {
                  state: { results: allResults, selected: result }
                })
              }
            >
              View Cross Validation 📊
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ModelPage;