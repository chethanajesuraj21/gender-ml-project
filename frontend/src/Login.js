import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";

const AUTH_URL = "https://gender-ml-auth.onrender.com";


function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${AUTH_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("name",  data.name);
        navigate("/");          // → LoadDataset (protected)
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Cannot connect to auth server. Make sure it is running on port 4000.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Login</h2>
        {error && <p className="auth-error">{error}</p>}

        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="current-password"
        />

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in…" : "Login"}
        </button>
        <button className="register-btn" onClick={() => navigate("/register")}>
          Go to Register
        </button>
      </div>
    </div>
  );
}

export default Login;