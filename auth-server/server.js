const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors({
  origin: ["http://localhost:3000"]
}));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

// ✅ Schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
}, { timestamps: true });

const resultSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  model: String,

  // ✅ FIXED FIELD NAMES (match frontend)
  train: Number,
  test: Number,
  cv_mean: Number,
  cv_std: Number,
  cv_scores: [Number],

}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Result = mongoose.model("Result", resultSchema);

// ✅ JWT Middleware
const SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ✅ Routes

app.get("/", (req, res) => {
  res.json({ message: "Server running ✅" });
});

// REGISTER
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "Email exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed });

  res.json({ message: "Registered", userId: user._id });
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign({ userId: user._id }, SECRET, { expiresIn: "7d" });

  res.json({ token, name: user.name });
});

// ✅ SAVE RESULT (FIXED)
app.post("/save-result", authMiddleware, async (req, res) => {
  try {
    const result = await Result.create({
      userId: req.user.userId,

      // ✅ MATCH FRONTEND EXACTLY
      model: req.body.model,
      train: req.body.training_accuracy,
      test: req.body.testing_accuracy,
      cv_mean: req.body.cv_mean,
      cv_std: req.body.cv_std,
      cv_scores: req.body.cv_scores,
    });

    res.json({ message: "Saved", id: result._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Save failed" });
  }
});

// GET RESULTS
app.get("/my-results", authMiddleware, async (req, res) => {
  const results = await Result.find({ userId: req.user.userId });
  res.json({ results });
});

// CLEAR RESULTS
app.delete("/clear-results", authMiddleware, async (req, res) => {
  await Result.deleteMany({ userId: req.user.userId });
  res.json({ message: "Cleared" });
});

// START SERVER
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));