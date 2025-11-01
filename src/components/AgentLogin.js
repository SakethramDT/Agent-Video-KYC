// src/components/AgentLogin.js
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";

const AgentLogin = ({ setLoggedInAgent }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/agent/login`,
        {
          username: username.trim(),
          password: password.trim(),
        }
      );

      if (res.data.status === "success") {
        // store username (existing behavior)
        const loggedUser = res.data.username;
        localStorage.setItem("kycAgent", loggedUser);
        setLoggedInAgent(loggedUser);

        // normalized username (admin detection)
        const normalized = (loggedUser || "").toLowerCase().replace(/\s/g, "");

        // route to dashboard if admin, otherwise to sessions
        if (normalized === "admin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/sessions", { replace: true });
        }
      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/AgentVideoKyc/image.png" alt="UAEID Logo" className="login-logo" />
          <h2 className="login-title">Welcome back!</h2>
          <p className="login-subtitle">Secure KYC Admin Portal</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <label className="login-label">User Name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={`login-input ${error ? "input-error" : ""}`}
          />

          <label className="login-label">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`login-input ${error ? "input-error" : ""}`}
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="divider">Or Login with</div>

        <button className="uaeid-button">
          <img src="/AgentVideoKyc/image.png" alt="UAEID" className="uaeid-icon" />
          Sign in with UAEID
        </button>
      </div>
    </div>
  );
};

export default AgentLogin;
