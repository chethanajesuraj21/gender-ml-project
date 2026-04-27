import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./Login";
import Register from "./Register";

import LoadDataset from "./LoadDataset";
import ModelPage from "./ModelPage";
import ChartPage from "./ChartPage";
import AnovaPage from "./AnovaPage";

function App() {
  return (
    <Router>
      <div
        style={{
          minHeight: "100vh",
          backgroundImage: "url('/background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        <Routes>

          {/* 🔐 LOGIN */}
          <Route path="/login" element={<Login />} />

          {/* 📝 REGISTER */}
          <Route path="/register" element={<Register />} />

          {/* 📂 MAIN FLOW */}
          <Route path="/" element={<LoadDataset />} />
          <Route path="/models" element={<ModelPage />} />
          <Route path="/chart" element={<ChartPage />} />
          <Route path="/anova" element={<AnovaPage />} />

        </Routes>
      </div>
    </Router>
  );
}

export default App;