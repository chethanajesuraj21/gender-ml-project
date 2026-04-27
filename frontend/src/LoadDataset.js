import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function LoadDataset() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);

  // handle file selection
  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  // handle button click
  const handleUpload = () => {
    if (!file) {
      alert("Please select a dataset first!");
      return;
    }

    alert("Dataset Loaded Successfully: " + file.name);

    // navigate to model page
    navigate("/models");
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundImage: "url('/background.png')", // make sure image is in public folder
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          backdropFilter: "blur(12px)",
          background: "rgba(0,0,0,0.4)",
          padding: "40px",
          borderRadius: "20px",
          textAlign: "center",
          boxShadow: "0 0 25px rgba(0, 255, 255, 0.5)",
        }}
      >
        <h1
          style={{
            fontSize: "42px",
            fontWeight: "bold",
            background: "linear-gradient(90deg, #00f5ff, #00ff9d)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 15px rgba(0,255,255,0.7)",
            letterSpacing: "2px",
            marginBottom: "20px",
          }}
        >
          Load Dataset
        </h1>

        {/* FILE INPUT */}
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}   // ✅ FIXED
          style={{
            margin: "15px 0",
            color: "white",
            fontSize: "16px",
          }}
        />

        <br />

        {/* BUTTON */}
        <button
          onClick={handleUpload}   // ✅ FIXED
          style={{
            padding: "12px 30px",
            fontSize: "18px",
            borderRadius: "25px",
            border: "none",
            background: "linear-gradient(90deg, #00f5ff, #00ff9d)",
            color: "#000",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 0 15px rgba(0,255,255,0.8)",
          }}
        >
          Load Dataset
        </button>
      </div>
    </div>
  );
}

export default LoadDataset;