import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Title, Tooltip, Legend
);

/* colour per model */
const COLORS = {
  "Decision Tree": "#00f5ff",
  "Random Forest": "#00ff9d",
  "1D CNN":        "#c77dff",
  "LGBM":          "#ff9f43",
};

/* shared chart options factory */
const lineOpts = (title) => ({
  responsive: true,
  plugins: {
    legend: { labels: { color: "white", font: { size: 13 } } },
    title:  { display: true, text: title, color: "white",
               font: { size: 16, weight: "bold" } },
  },
  scales: {
    x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.08)" } },
    y: {
      min: 0, max: 1,
      ticks: { color: "white", callback: v => (v * 100).toFixed(0) + "%" },
      grid:  { color: "rgba(255,255,255,0.08)" },
      title: { display: true, text: "Accuracy", color: "white" },
    },
  },
});

const barOpts = {
  responsive: true,
  plugins: { legend: { labels: { color: "white" } } },
  scales: {
    x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.08)" } },
    y: {
      min: 0, max: 1,
      ticks: { color: "white", callback: v => (v * 100).toFixed(0) + "%" },
      grid:  { color: "rgba(255,255,255,0.08)" },
      title: { display: true, text: "Accuracy", color: "white" },
    },
  },
};

/* build line dataset for one model — works even if cv_scores is empty */
function buildLine(r) {
  const color  = COLORS[r.model] || "#00f5ff";
  const mean   = r.cv_mean || 0;

  // If backend returned individual fold scores use them,
  // otherwise synthesise 5 identical points so the chart still renders
  const scores = (r.cv_scores && r.cv_scores.length > 0)
    ? r.cv_scores
    : [mean, mean, mean, mean, mean];

  const labels = scores.map((_, i) => `Fold ${i + 1}`);

  return {
    labels,
    datasets: [
      {
        label: "Fold Accuracy",
        data: scores.map(Number),
        borderColor: color,
        backgroundColor: color + "33",
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: color,
        fill: true,
      },
      {
        label: `Mean: ${(mean * 100).toFixed(2)}%`,
        data: scores.map(() => mean),
        borderColor: "#ffdd00",
        borderDash: [6, 4],
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };
}

export default function ChartPage() {
  const location    = useLocation();
  const navigate    = useNavigate();
  const allResults  = location.state?.results || [];

  if (allResults.length === 0) {
    return (
      <div style={S.center}>
        <h2 style={{ color: "white" }}>No data available</h2>
        <button style={S.backBtn} onClick={() => navigate("/models")}>⬅ Back</button>
      </div>
    );
  }

  /* bar chart */
  const barData = {
    labels: allResults.map(r => r.model),
    datasets: [
      {
        label: "Training Accuracy",
        data: allResults.map(r => r.train),
        backgroundColor: "rgba(0,245,255,0.65)",
        borderRadius: 6,
      },
      {
        label: "Testing Accuracy",
        data: allResults.map(r => r.test),
        backgroundColor: "rgba(0,255,150,0.65)",
        borderRadius: 6,
      },
    ],
  };

  return (
    <div style={S.page}>
      <h1 style={S.title}>Visualization Dashboard</h1>
      <button style={S.backBtn} onClick={() => navigate("/models")}>⬅ Back</button>

      {/* ── Bar: accuracy comparison ── */}
      <div style={S.box}>
        <h2 style={S.chartTitle}>Model Accuracy Comparison</h2>
        <Bar data={barData} options={barOpts} />
      </div>

      {/* ── K-Fold CV line charts — one per model ── */}
      <h2 style={{ ...S.chartTitle, textAlign: "center", fontSize: 22, marginBottom: 8 }}>
        K-Fold Cross Validation — All Models
      </h2>

      <div style={S.grid}>
        {allResults.map(r => (
          <div key={r.model} style={S.box}>
            <Line
              data={buildLine(r)}
              options={lineOpts(`${r.model} — K-Fold Cross Validation`)}
            />

            {/* fold-by-fold accuracy table */}
            <table style={S.tbl}>
              <thead>
                <tr>
                  {(r.cv_scores && r.cv_scores.length > 0
                    ? r.cv_scores
                    : [0,0,0,0,0]
                  ).map((_, i) => (
                    <th key={i} style={S.th}>Fold {i + 1}</th>
                  ))}
                  <th style={{ ...S.th, color: "#ffdd00" }}>Mean</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(r.cv_scores && r.cv_scores.length > 0
                    ? r.cv_scores
                    : [r.cv_mean, r.cv_mean, r.cv_mean, r.cv_mean, r.cv_mean]
                  ).map((s, i) => (
                    <td key={i} style={S.td}>{(Number(s) * 100).toFixed(2)}%</td>
                  ))}
                  <td style={{ ...S.td, color: "#ffdd00", fontWeight: "bold" }}>
                    {(r.cv_mean * 100).toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    backgroundImage: "url('/background.png')",
    backgroundSize: "cover",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "30px 20px",
  },
  center: {
    minHeight: "100vh",
    display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center",
    backgroundImage: "url('/background.png')",
    backgroundSize: "cover",
  },
  title: {
    color: "white",
    fontSize: 32,
    marginBottom: 20,
    background: "linear-gradient(90deg,#00f5ff,#00ff9d)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  chartTitle: { color: "white", marginBottom: 16, fontSize: 18 },
  box: {
    width: "100%",
    marginBottom: 32,
    background: "rgba(0,0,0,0.65)",
    padding: 24,
    borderRadius: 20,
    border: "1px solid rgba(0,245,255,0.2)",
    boxSizing: "border-box",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(560px, 1fr))",
    gap: 24,
    width: "95%",
    maxWidth: 1300,
  },
  backBtn: {
    marginBottom: 24,
    padding: "10px 24px",
    background: "red",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
  },
  tbl: { width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 13 },
  th:  { color: "#00f5ff", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.15)", textAlign: "center", fontWeight: "bold" },
  td:  { color: "rgba(255,255,255,0.85)", padding: "6px 10px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" },
};