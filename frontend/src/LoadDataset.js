import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AUTH_URL = "https://gender-ml-auth.onrender.com";

function LoadDataset() {
  const navigate = useNavigate();
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a CSV dataset first.");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res  = await fetch(`${ML_URL}/upload`, { method: "POST", body: formData });
      const text = await res.text();

      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error("Server returned non-JSON (may still be starting up — try again in a moment)."); }

      if (!res.ok) throw new Error(data.error || "Upload failed");

      alert("Dataset Loaded ✅");
      navigate("/models");
    } catch (err) {
      alert("Upload failed ❌: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    navigate("/login");
  };

  const name = localStorage.getItem("name") || "";

  return (
    <div style={styles.page}>
      {/* Top-right logout */}
      <div style={styles.topBar}>
        {name && <span style={styles.greeting}>👋 {name}</span>}
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={styles.card}>
        <h1 style={styles.title}>Load Dataset</h1>

        <p style={styles.sub}>Upload your gender-wise CSV dataset to begin model training</p>

        <label style={styles.fileLabel}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <span style={styles.fileBtn}>
            {file ? `📄 ${file.name}` : "📁 Choose CSV File"}
          </span>
        </label>

        <button
          onClick={handleUpload}
          disabled={loading}
          style={{ ...styles.uploadBtn, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Uploading…" : "Load Dataset"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  topBar: {
    position: "absolute",
    top: "20px",
    right: "24px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  greeting: {
    color: "rgba(255,255,255,0.8)",
    fontSize: "15px",
  },
  logoutBtn: {
    padding: "8px 18px",
    background: "rgba(255,80,80,0.85)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
  },
  card: {
    backdropFilter: "blur(14px)",
    background: "rgba(0,0,0,0.45)",
    padding: "48px 52px",
    borderRadius: "22px",
    textAlign: "center",
    boxShadow: "0 0 40px rgba(0,255,255,0.35)",
    border: "1px solid rgba(0,255,255,0.2)",
    minWidth: "340px",
  },
  title: {
    fontSize: "40px",
    fontWeight: "bold",
    background: "linear-gradient(90deg, #00f5ff, #00ff9d)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "2px",
    marginBottom: "10px",
  },
  sub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: "14px",
    marginBottom: "28px",
  },
  fileLabel: {
    display: "block",
    cursor: "pointer",
    marginBottom: "18px",
  },
  fileBtn: {
    display: "inline-block",
    padding: "11px 26px",
    border: "1.5px dashed rgba(0,255,255,0.5)",
    borderRadius: "10px",
    color: "#00f5ff",
    fontSize: "15px",
    transition: "border-color 0.2s",
  },
  uploadBtn: {
    padding: "13px 36px",
    fontSize: "17px",
    borderRadius: "25px",
    border: "none",
    background: "linear-gradient(90deg, #00f5ff, #00ff9d)",
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(0,255,255,0.7)",
    transition: "opacity 0.2s",
  },
};

export default LoadDataset;