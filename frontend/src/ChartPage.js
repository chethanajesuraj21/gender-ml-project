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
  Legend
} from "chart.js";

import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function ChartPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const allResults = location.state?.results || [];
  const selected = location.state?.selected || null;

  console.log("SELECTED DATA:", selected); // 🔍 Debug

  // ❌ No data
  if (allResults.length === 0) {
    return (
      <div style={{ color: "white", textAlign: "center" }}>
        <h2>No Data Available</h2>
        <button onClick={() => navigate("/models")}>⬅ Back</button>
      </div>
    );
  }

  // ✅ MODEL COMPARISON (BAR)
  const barData = {
    labels: allResults.map((r) => r.model),
    datasets: [
      {
        label: "Training Accuracy",
        data: allResults.map((r) => r.train),
        backgroundColor: "rgba(0,255,255,0.6)"
      },
      {
        label: "Testing Accuracy",
        data: allResults.map((r) => r.test),
        backgroundColor: "rgba(0,255,150,0.6)"
      }
    ]
  };

  // 🔥 K-FOLD LINE GRAPH
  let lineData = null;

  if (selected && selected.cv_scores && selected.cv_scores.length > 0) {
    const mean = selected.cv_mean;

    lineData = {
      labels: selected.cv_scores.map((_, i) => `Fold ${i + 1}`),
      datasets: [
        {
          label: "Fold Accuracy",
          data: selected.cv_scores,
          borderColor: "cyan",
          backgroundColor: "cyan",
          tension: 0.4
        },
        {
          label: "Mean Accuracy",
          data: selected.cv_scores.map(() => mean),
          borderColor: "yellow",
          borderDash: [5, 5],
          pointRadius: 0
        }
      ]
    };
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: "white" }
      }
    },
    scales: {
      x: { ticks: { color: "white" } },
      y: {
        ticks: { color: "white" },
        min: 0,
        max: 1
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: "url('/background.png')",
        backgroundSize: "cover",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "30px"
      }}
    >
      <h1 style={{ color: "white" }}>Visualization Dashboard</h1>

      {/* 🔙 BACK BUTTON */}
      <button
        onClick={() => navigate("/models")}
        style={{
          marginBottom: "20px",
          padding: "10px 20px",
          background: "red",
          color: "white",
          border: "none",
          borderRadius: "10px"
        }}
      >
        ⬅ Back
      </button>

      {/* 🔹 MODEL COMPARISON */}
      <div
        style={{
          width: "70%",
          marginBottom: "40px",
          background: "rgba(0,0,0,0.6)",
          padding: "20px",
          borderRadius: "20px"
        }}
      >
        <h2 style={{ color: "white" }}>Model Accuracy Comparison</h2>
        <Bar data={barData} options={options} />
      </div>

      {/* 🔥 K-FOLD CROSS VALIDATION */}
      {lineData && (
        <div
          style={{
            width: "70%",
            background: "rgba(0,0,0,0.6)",
            padding: "20px",
            borderRadius: "20px"
          }}
        >
          <h2 style={{ color: "white" }}>
            {selected.model} - K-Fold Cross Validation
          </h2>
          <Line data={lineData} options={options} />
        </div>
      )}
    </div>
  );
}

export default ChartPage;