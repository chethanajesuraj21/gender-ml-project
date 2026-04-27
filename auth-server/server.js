const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/gender_app")
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// 🔥 User Schema
const User = mongoose.model("User", {
  name: String,
  email: String,
  password: String
});

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({ name, email, password: hashed });
    await user.save();

    res.json({ message: "Registered successfully" });

  } catch (err) {
    res.json({ error: err.message });
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.json({ error: "Invalid password" });

    const token = jwt.sign({ id: user._id }, "secretkey");

    res.json({ message: "Login success", token });

  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(4000, () => console.log("Auth server running on 4000"));