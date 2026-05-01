const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://gender-ml-project-2.vercel.app",
    process.env.FRONTEND_URL
  ]
}));
// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/gender_ml", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ── Schemas ───────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt:{ type: Date, default: Date.now }
});

const resultSchema = new mongoose.Schema({
  userId:   mongoose.Schema.Types.ObjectId,
  model:    String,
  training_accuracy: Number,
  testing_accuracy:  Number,
  cv_mean:  Number,
  cv_std:   Number,
  cv_scores: [Number],
  createdAt:{ type: Date, default: Date.now }
});

const User   = mongoose.model("User",   userSchema);
const Result = mongoose.model("Result", resultSchema);

// ── JWT middleware ────────────────────────────────────────────────────────────
const SECRET = process.env.JWT_SECRET || "gender_ml_secret_key";

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Home
app.get("/", (req, res) => res.json({ message: "Auth Server Running ✅" }));

// Register
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name, email, password: hashed });

    res.json({ message: "Registered successfully", userId: user._id });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ userId: user._id, name: user.name }, SECRET, { expiresIn: "7d" });
    res.json({ token, name: user.name });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Save ML result
app.post("/save-result", authMiddleware, async (req, res) => {
  try {
    const { model, training_accuracy, testing_accuracy, cv_mean, cv_std, cv_scores } = req.body;
    const result = await Result.create({
      userId: req.user.userId,
      model, training_accuracy, testing_accuracy, cv_mean, cv_std, cv_scores
    });
    res.json({ message: "Result saved", id: result._id });
  } catch (err) {
    console.error("Save result error:", err);
    res.status(500).json({ error: "Failed to save result" });
  }
});

// Get all results for logged-in user
app.get("/my-results", authMiddleware, async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

// Clear results for logged-in user
app.delete("/clear-results", authMiddleware, async (req, res) => {
  try {
    await Result.deleteMany({ userId: req.user.userId });
    res.json({ message: "Results cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear results" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Auth server on port ${PORT}`));