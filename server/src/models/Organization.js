const mongoose = require("mongoose");

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (value) => SLUG_PATTERN.test(value),
      message: "slug can only contain lowercase letters, numbers, and single hyphens",
    },
  },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Organization", organizationSchema);
