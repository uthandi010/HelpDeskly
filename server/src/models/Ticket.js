const mongoose = require("mongoose");

const STATUSES = ["open", "pending", "resolved", "closed"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

const ticketSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    subject: { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "must be a valid email address"],
    },
    status: { type: String, enum: STATUSES, default: "open" },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ organizationId: 1, status: 1 });
ticketSchema.index({ organizationId: 1, createdAt: 1 });

ticketSchema.statics.STATUSES = STATUSES;
ticketSchema.statics.PRIORITIES = PRIORITIES;

module.exports = mongoose.model("Ticket", ticketSchema);
