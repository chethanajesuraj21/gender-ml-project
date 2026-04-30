import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function AnovaPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("https://gender-ml-project-1.onrender.com/anova")
      .then(res => res.json())
      .then(setData)
      .catch(() => alert("ANOVA fetch error ❌"));
  }, []);

  if (!data) return <h2 style={{ color: "white" }}>Loading...</h2>;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: "url('/background.png')",
        backgroundSize: "cover",
        padding: "30px",
        color: "white"
      }}
    >
      <h1 style={{ textAlign: "center" }}>
        ANOVA Test Results 
      </h1>

      <table
        style={{
          width: "95%",
          margin: "30px auto",
          borderCollapse: "collapse",
          background: "rgba(0,0,0,0.7)"
        }}
        border="1"
      >
        <thead>
          <tr>
            <th>Cross-Validation</th>
            <th>Model</th>
            <th>Mean</th>
            <th>Std</th>
            <th>F</th>
            <th>df</th>
            <th>p</th>
          </tr>
        </thead>

        <tbody>

  {/* ================= TRADITIONAL K-FOLD ================= */}
  {data.results
    .filter(r => r.cv_type === "Traditional K-Fold")
    .map((m, i) => (
      <tr key={"kf-" + i}>
        <td>{i === 0 ? "Traditional K-Fold" : ""}</td>
        <td>{m.model}</td>
        <td>{m.mean.toFixed(3)}</td>
        <td>{m.std.toFixed(3)}</td>

        {/* Show ANOVA only once */}
        {i === 0 && (
          <>
            <td rowSpan={3}>{data.anova.kfold.f.toFixed(3)}</td>
            <td rowSpan={3}>{data.anova.kfold.df}</td>
            <td rowSpan={3}>{data.anova.kfold.p.toFixed(3)}</td>
          </>
        )}
      </tr>
    ))}

  {/* ================= STRATIFIED K-FOLD ================= */}
  {data.results
    .filter(r => r.cv_type === "Stratified K-Fold")
    .map((m, i) => (
      <tr key={"skf-" + i}>
        <td>{i === 0 ? "Stratified K-Fold" : ""}</td>
        <td>{m.model}</td>
        <td>{m.mean.toFixed(3)}</td>
        <td>{m.std.toFixed(3)}</td>

        {i === 0 && (
          <>
            <td rowSpan={3}>{data.anova.stratified.f.toFixed(3)}</td>
            <td rowSpan={3}>{data.anova.stratified.df}</td>
            <td rowSpan={3}>{data.anova.stratified.p.toFixed(3)}</td>
          </>
        )}
      </tr>
    ))}

</tbody>
      </table>

      <div style={{ textAlign: "center" }}>
        <button
          onClick={() => navigate("/models")}
          style={{
            padding: "10px 20px",
            background: "red",
            color: "white",
            border: "none",
            borderRadius: "10px"
          }}
        >
          ⬅ Back
        </button>
      </div>
    </div>
  );
}

export default AnovaPage;