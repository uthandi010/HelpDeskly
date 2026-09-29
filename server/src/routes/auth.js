const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { createToken } = require("../utils/jwt");

const router = express.Router();

function authResponse(user) {
  return {
    token: createToken(user._id),
    userId: user._id,
    name: user.name,
    email: user.email,
  };
}

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(422).json({ message: "Name, email, and password are all required." });
  }
  if (password.length < 8) {
    return res.status(422).json({ message: "Password must be at least 8 characters." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });

  res.status(201).json(authResponse(user));
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || "").trim().toLowerCase() });

  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  res.json(authResponse(user));
});

module.exports = router;
