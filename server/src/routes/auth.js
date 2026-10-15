const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { createToken } = require("../utils/jwt");
const { LIMITS, trimmed, lengthError } = require("../utils/validation");

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
  const name = trimmed(req.body.name);
  const email = trimmed(req.body.email);
  const { password } = req.body;

  if (!name || !email || typeof password !== "string" || !password) {
    return res.status(422).json({ message: "Name, email, and password are all required." });
  }
  if (password.length < 8) {
    return res.status(422).json({ message: "Password must be at least 8 characters." });
  }
  const tooLong = lengthError([
    ["Name", name, LIMITS.name],
    ["Email", email, LIMITS.email],
    ["Password", password, LIMITS.password],
  ]);
  if (tooLong) return res.status(422).json({ message: tooLong });

  const normalizedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: normalizedEmail, passwordHash });

  res.status(201).json(authResponse(user));
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(422).json({ message: "Email and password are required." });
  }
  if (password.length > LIMITS.password) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  res.json(authResponse(user));
});

module.exports = router;
