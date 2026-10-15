const mongoose = require("mongoose");
const { LIMITS } = require("../utils/validation");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: LIMITS.name },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: LIMITS.email },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
