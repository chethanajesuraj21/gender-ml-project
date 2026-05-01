import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE_URL = "https://gender-ml-project-1.onrender.com";

function AnovaPage() {
  const navigate = useNavigate();
  const [raw, setRaw]         = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // 90-second timeout warning (Render free tier can be slow with CNN)
    const warnTimer = setTimeout(() => setTimedOut(true), 30_000);

    fetch(`${BASE_URL}/anova`)
      .then((res) => {
        if (!res.ok) throw new Error("Server error: " + res.status);
        return res.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setRaw(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        clearTimeout(warnTimer);
        setLoading(false);
      });

    return () => clearTimeout(warnTimer);
  }, []);

  /* ── Loading ── */
  if (loading)
    return (
      <div style={S.center}>
        <div style={S.spinner} />
        <h2 style={{ color: "white", marginTop: 20 }}>⏳ Loading ANOVA Results…</h2>
        {timedOut ? (
          <p style={{ color: "#ffcc00", fontSize: 13, maxWidth: 420, textAlign: "center" }}>
            ⚠️ Still computing… The CNN model takes ~2 min on the free-tier server.
            Please wait or refresh if this hangs longer than 3 minutes.
          </p>
        ) : (
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            The free-tier backend may take up to 60 s to wake up.
          </p>
        )}
      </div>
    );

  /* ── Error ── */
  if (error)
    return (
      <div style={S.center}>
        <h2 style={{ color: "#ff6b6b" }}>❌ Error</h2>
        <p style={{ color: "white", maxWidth: 480, textAlign: "center" }}>{error}</p>
        <button style={S.backBtn} onClick={() => navigate("/models")}>⬅ Back</button>
      </div>
    );

  /* ── Parse response ── */
  const results   = Array.isArray(raw?.results) ? raw.results : [];
  const anovaData = raw?.anova || {};
  const kf        = anovaData.kfold      || {};
  const skf       = anovaData.stratified || {};

  const kfRows  = results.filter(r => r.cv_type === "Traditional K-Fold");
  const skfRows = results.filter(r => r.cv_type === "Stratified K-Fold");

  const fmt = (v, d = 3) =>
    v != null && !isNaN(Number(v)) ? Number(v).toFixed(d) : "—";

  const pColor = (p) =>
    p != null && !isNaN(Number(p)) && Number(p) < 0.05 ? "#00ff9d" : "#ff6b6b";

  const renderSection = (rows, anova, cvLabel) =>
    rows.length > 0 ? (
      rows.map((m, i) => (
        <tr key={cvLabel + i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
          {i === 0 && (
            <td rowSpan={rows.length}
                style={{ ...S.td, fontWeight: "bold", verticalAlign: "middle" }}>
              {cvLabel}
            </td>
          )}
          <td style={S.td}>{m.model ?? "—"}</td>
          <td style={S.td}>{fmt(m.mean)}</td>
          <td style={S.td}>{fmt(m.std)}</td>
          {i === 0 && (
            <>
              <td rowSpan={rows.length}
                  style={{ ...S.td, verticalAlign: "middle", color: "#00f5ff" }}>
                {fmt(anova.f)}
              </td>
              <td rowSpan={rows.length}
                  style={{ ...S.td, verticalAlign: "middle" }}>
                {anova.df ?? "—"}
              </td>
              <td rowSpan={rows.length}
                  style={{ ...S.td, verticalAlign: "middle", color: pColor(anova.p) }}>
                {fmt(anova.p)}
                {anova.p != null ? (Number(anova.p) < 0.05 ? " ✓" : " ✗") : ""}
              </td>
            </>
          )}
        </tr>
      ))
    ) : (
      /* Fallback row — no model data but might still have f/p */
      <tr style={S.rowEven}>
        <td style={{ ...S.td, fontWeight: "bold" }}>{cvLabel}</td>
        <td style={S.td} colSpan={2}>No data</td>
        <td style={S.td}>—</td>
        <td style={{ ...S.td, color: "#00f5ff" }}>{fmt(anova.f)}</td>
        <td style={S.td}>{anova.df ?? "—"}</td>
        <td style={{ ...S.td, color: pColor(anova.p) }}>
          {fmt(anova.p)}
          {anova.p != null ? (Number(anova.p) < 0.05 ? " ✓" : " ✗") : ""}
        </td>
      </tr>
    );

  return (
    <div style={S.page}>
      <h1 style={S.title}>ANOVA Test Results</h1>

      <div style={{ overflowX: "auto", width: "100%" }}>
        <table style={S.table} border="1">
          <thead>
            <tr>
              <th style={S.th}>Cross-Validation</th>
              <th style={S.th}>Model</th>
              <th style={S.th}>Mean</th>
              <th style={S.th}>Std</th>
              <th style={S.th}>F</th>
              <th style={S.th}>df</th>
              <th style={S.th}>p</th>
            </tr>
          </thead>
          <tbody>
            {renderSection(kfRows,  kf,  "Traditional K-Fold")}
            {renderSection(skfRows, skf, "Stratified K-Fold")}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={S.legend}>
        <span style={{ color: "#00ff9d" }}>✓ Significant (p &lt; 0.05)</span>
        &nbsp;&nbsp;
        <span style={{ color: "#ff6b6b" }}>✗ Not significant (p ≥ 0.05)</span>
      </div>

      <div style={{ textAlign: "center", marginTop: 30 }}>
        <button style={S.backBtn} onClick={() => navigate("/models")}>⬅ Back</button>
      </div>
    </div>
  );
}

/* ── Keyframes injected once ── */
const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
if (!document.head.querySelector("[data-anova-spin]")) {
  styleTag.setAttribute("data-anova-spin", "1");
  document.head.appendChild(styleTag);
}

const S = {
  page: {
    minHeight: "100vh",
    backgroundImage: "url('/background.png')",
    backgroundSize: "cover",
    padding: "30px 20px",
    color: "white",
  },
  center: {
    minHeight: "100vh",
    display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center",
    backgroundImage: "url('/background.png')",
    backgroundSize: "cover",
    gap: 12,
  },
  spinner: {
    width: 48, height: 48,
    border: "4px solid rgba(0,245,255,0.2)",
    borderTop: "4px solid #00f5ff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  title: {
    textAlign: "center",
    fontSize: 32,
    marginBottom: 28,
    background: "linear-gradient(90deg,#00f5ff,#00ff9d)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  table: {
    width: "95%",
    margin: "0 auto",
    borderCollapse: "collapse",
    background: "rgba(0,0,0,0.7)",
  },
  th: {
    padding: "12px 16px",
    background: "rgba(0,245,255,0.15)",
    color: "#00f5ff",
    fontWeight: "bold",
    textAlign: "center",
    borderColor: "rgba(255,255,255,0.2)",
  },
  td: {
    padding: "10px 16px",
    textAlign: "center",
    borderColor: "rgba(255,255,255,0.2)",
  },
  rowEven: { background: "rgba(255,255,255,0.03)" },
  rowOdd:  { background: "rgba(255,255,255,0.07)" },
  legend:  { textAlign: "center", marginTop: 16, fontSize: 14, opacity: 0.8 },
  backBtn: {
    padding: "10px 24px",
    background: "red",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
  },
};

export default AnovaPage;