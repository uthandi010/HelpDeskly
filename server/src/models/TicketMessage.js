const mongoose = require("mongoose");
const { LIMITS } = require("../utils/validation");

const ticketMessageSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true },
  authorType: { type: String, enum: ["customer", "agent"], required: true },
  authorName: { type: String, required: true, trim: true, maxlength: LIMITS.name },
  body: { type: String, required: true, trim: true, maxlength: LIMITS.message },
  createdAt: { type: Date, default: Date.now },
});

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model("TicketMessage", ticketMessageSchema);
