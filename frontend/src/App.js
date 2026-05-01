import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login        from "./Login";
import Register     from "./Register";
import LoadDataset  from "./LoadDataset";
import ModelPage    from "./ModelPage";
import ChartPage    from "./ChartPage";
import AnovaPage    from "./AnovaPage";

// Guard: redirect to /login if no token
function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  // Single source of truth for ML results
  const [mlResults, setMlResults] = useState([]);

  return (
    <Router>
      <div
        style={{
          minHeight: "100vh",
          backgroundImage: "url('/background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Routes>

          {/* ── Public Routes ── */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ── Protected Routes ── */}
          <Route path="/" element={
            <PrivateRoute>
              <LoadDataset />
            </PrivateRoute>
          } />

          {/* ModelPage: needs both — reads AND writes mlResults */}
          <Route path="/models" element={
            <PrivateRoute>
              <ModelPage
                mlResults={mlResults}
                setMlResults={setMlResults}
              />
            </PrivateRoute>
          } />

          {/* ChartPage: only reads mlResults, no setter needed */}
          <Route path="/chart" element={
            <PrivateRoute>
              <ChartPage mlResults={mlResults} />
            </PrivateRoute>
          } />

          <Route path="/anova" element={
            <PrivateRoute>
              <AnovaPage />
            </PrivateRoute>
          } />

          {/* Fallback — catch all unknown routes */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </div>
    </Router>
  );
}

export default App;