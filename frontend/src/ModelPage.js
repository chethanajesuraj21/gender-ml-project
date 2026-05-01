import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./ModelPage.css";

const ML_URL = "https://gender-ml-project-2.onrender.com";
const AUTH_URL = "https://gender-ml-auth.onrender.com";

function ModelPage() {
  const [result, setResult]             = useState(null);
  const [allResults, setAllResults]     = useState([]);
  const [treeImage, setTreeImage]       = useState(null);
  const [loadingModel, setLoadingModel] = useState(null);
  const [error, setError]               = useState(null);
  const [showTree, setShowTree]         = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

  const getToken = () => localStorage.getItem("token");

  const runModel = async (model) => {
    try {
      setError(null);
      setShowTree(false);
      setTreeImage(null);
      setLoadingModel(model);

      const controller = new AbortController();
      const timeoutMs  = model === "1D CNN" ? 300_000 : 120_000;
      const timer      = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${AUTH_URL}/run-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`);

      const newResult = {
        model,
        train:        Number(data.training_accuracy || 0),
        test:         Number(data.testing_accuracy  || 0),
        cv_mean:      Number(data.cv_mean || 0),
        cv_std:       Number(data.cv_std  || 0),
        cv_scores:    Array.isArray(data.cv_scores) ? data.cv_scores : [],
      };

      fetch(`${AUTH_URL}/save-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`,
        },
        body: JSON.stringify(newResult),
      }).catch(() => {});

      setResult(newResult);
      setAllResults(prev => {
        const filtered = prev.filter(p => p.model !== model);
        return [...filtered, newResult];
      });

      if (data.tree_image && model !== "1D CNN") {
        setTreeImage(data.tree_image);
      }

    } catch (err) {
      if (err.name === "AbortError") {
        setError(`${model} timed out. Wait 30s and retry.`);
      } else if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setError("Cannot reach ML backend. Render.com free tier may be sleeping — wait ~30s and try again.");
      } else {
        setError(err.message || "Backend connection error");
      }
    } finally {
      setLoadingModel(null);
    }
  };

  const clearResults = async () => {
    try {
      await fetch(`${AUTH_URL}/clear-results`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${getToken()}` },
      });
    } catch {}
    setResult(null);
    setAllResults([]);
    setTreeImage(null);
    setShowTree(false);
    setError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    navigate("/login");
  };

  return (
    <div className="page">

      {/* Logout */}
      <div style={{ position: "fixed", top: 16, right: 20, zIndex: 100 }}>
        <button onClick={handleLogout} style={S.logoutBtn}>Logout</button>
      </div>

      {/* ── Model selector ── */}
      <div className="card">
        <h1>Select Machine Learning Model</h1>

        {["Decision Tree", "Random Forest", "1D CNN", "LGBM"].map(m => (
          <button
            key={m}
            onClick={() => runModel(m)}
            className="model-btn"
            disabled={loadingModel !== null}
          >
            {loadingModel === m
              ? (m === "1D CNN" ? "Training CNN… (2-3 min)" : `Running ${m}…`)
              : m}
          </button>
        ))}

        <button className="clear-btn" onClick={clearResults} disabled={loadingModel !== null}>
          Clear Results
        </button>

        {loadingModel && (
          <div style={S.infoBox}>
            ⏳ <strong>{loadingModel}</strong> is running…
            {loadingModel === "1D CNN" && " CNN trains 5 folds — takes 2-4 min."}
          </div>
        )}

        {error && <div style={S.errorBox}>❌ {error}</div>}
      </div>

      {/* ── Result stats card ── */}
      {result && (
        <div className="result-card" style={{ width: "90%", maxWidth: 500 }}>
          <h2>{result.model}</h2>
          <p>Training Accuracy: <strong>{(result.train * 100).toFixed(2)}%</strong></p>
          <p>Testing Accuracy:  <strong>{(result.test  * 100).toFixed(2)}%</strong></p>
          <p>CV Mean: <strong>{(result.cv_mean * 100).toFixed(2)}%</strong></p>
          <p>CV Std:  <strong>{result.cv_std.toFixed(4)}</strong></p>

          {result.cv_scores.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4>Cross Validation Scores</h4>
              {result.cv_scores.map((s, i) => (
                <p key={i}>Fold {i + 1}: {(Number(s) * 100).toFixed(2)}%</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tree visualization toggle button (outside result-card) ── */}
      {treeImage && result && (
        <div style={{ width: "90%", maxWidth: 500, marginTop: 12 }}>
          <button style={S.greenBtn} onClick={() => setShowTree(v => !v)}>
            🌳 {showTree ? "Hide" : "View"} Tree Visualization
          </button>
        </div>
      )}

      {/* ── Tree image ── */}
      {treeImage && showTree && result && (
        <div className="tree-card" style={{ width: "92%", maxWidth: 900 }}>
          <h3>{result.model} Visualization</h3>
          <img
            src={`data:image/png;base64,${treeImage}`}
            alt="tree visualization"
            className="tree-img"
          />
        </div>
      )}

      {/* ── Comparison table + navigation buttons ── */}
      {allResults.length > 0 && (
        <div className="table-card">
          <h2>Model Comparison</h2>
          <table>
            <thead>
              <tr>
                <th>Model</th><th>Train %</th><th>Test %</th><th>CV Mean %</th>
              </tr>
            </thead>
            <tbody>
              {allResults.map((r, i) => (
                <tr key={i}>
                  <td>{r.model}</td>
                  <td>{(r.train * 100).toFixed(2)}%</td>
                  <td className="test">{(r.test * 100).toFixed(2)}%</td>
                  <td>{(r.cv_mean * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Navigation buttons ── */}
          <div style={S.btnGroup}>

            <button
              className="viz-btn"
              onClick={() => navigate("/chart", { state: { results: allResults } })}
            >
              View Model Comparison 📊
            </button>

            {/* View Cross Validation — ALWAYS shown once any model ran, uses all results */}
            <button
              className="viz-btn"
              style={{ borderColor: "#ffcc00", color: "#ffcc00" }}
              onClick={() =>
                navigate("/chart", { state: { results: allResults } })
              }
            >
              View Cross Validation 📈
            </button>

            <button className="viz-btn" onClick={() => navigate("/anova")}>
              View ANOVA Test 🔬
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

const S = {
  logoutBtn: {
    padding: "8px 18px",
    background: "rgba(255,60,60,0.85)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
  },
  errorBox: {
    color: "#ff6b6b",
    marginTop: 15,
    padding: 12,
    background: "rgba(255,0,0,0.1)",
    borderRadius: 8,
    border: "1px solid #ff6b6b",
    fontSize: 14,
  },
  infoBox: {
    color: "#00f5ff",
    marginTop: 15,
    padding: 12,
    background: "rgba(0,245,255,0.07)",
    borderRadius: 8,
    border: "1px solid rgba(0,245,255,0.3)",
    fontSize: 14,
  },
  greenBtn: {
    width: "100%",
    padding: "13px 0",
    fontSize: 15,
    fontWeight: "bold",
    background: "transparent",
    border: "2px solid #00ff9d",
    color: "#00ff9d",
    borderRadius: 25,
    cursor: "pointer",
  },
  btnGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 16,
  },
};

export default ModelPage;