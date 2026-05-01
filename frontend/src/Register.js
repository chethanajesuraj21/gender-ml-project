import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";

const AUTH_URL = "http://localhost:4000";

function Register() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError("");
    if (!name || !email || !password || !confirm) {
      setError("All fields are required");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${AUTH_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (res.ok && data.message) {
        alert("Registered Successfully ✅");
        navigate("/login");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Cannot connect to auth server. Make sure it is running on port 4000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Register</h2>
        {error && <p className="auth-error">{error}</p>}

        <input placeholder="Name"             value={name}     onChange={e => setName(e.target.value)} />
        <input placeholder="Email"            value={email}    onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Password"         value={password} onChange={e => setPassword(e.target.value)} />
        <input type="password" placeholder="Confirm Password" value={confirm}  onChange={e => setConfirm(e.target.value)} />

        <button className="login-btn" onClick={handleRegister} disabled={loading}>
          {loading ? "Registering…" : "Register"}
        </button>
        <button className="register-btn" onClick={() => navigate("/login")}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default Register;