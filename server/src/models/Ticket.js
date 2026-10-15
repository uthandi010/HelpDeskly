const mongoose = require("mongoose");
const { LIMITS } = require("../utils/validation");

const STATUSES = ["open", "pending", "resolved", "closed"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

const ticketSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    subject: { type: String, required: true, trim: true, maxlength: LIMITS.subject },
    customerName: { type: String, required: true, trim: true, maxlength: LIMITS.name },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: LIMITS.email,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "must be a valid email address"],
    },
    status: { type: String, enum: STATUSES, default: "open" },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    // sha256 of the customer's public access token; never serialized.
    accessTokenHash: { type: String, select: false },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ organizationId: 1, status: 1 });
ticketSchema.index({ organizationId: 1, createdAt: 1 });

ticketSchema.statics.STATUSES = STATUSES;
ticketSchema.statics.PRIORITIES = PRIORITIES;

module.exports = mongoose.model("Ticket", ticketSchema);
