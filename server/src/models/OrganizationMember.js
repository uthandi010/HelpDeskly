const mongoose = require("mongoose");

const organizationMemberSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["agent", "admin"], default: "agent" },
  createdAt: { type: Date, default: Date.now },
});

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("OrganizationMember", organizationMemberSchema);
