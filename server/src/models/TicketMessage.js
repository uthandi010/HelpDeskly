const mongoose = require("mongoose");

const ticketMessageSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true },
  authorType: { type: String, enum: ["customer", "agent"], required: true },
  authorName: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model("TicketMessage", ticketMessageSchema);
