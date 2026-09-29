const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { loadOrgAndMembership } = require("../middleware/orgScoped");
const Ticket = require("../models/Ticket");
const TicketMessage = require("../models/TicketMessage");

// Mounted at /api/organizations/:organizationId/tickets
const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadOrgAndMembership);

function ticketSummary(ticket) {
  return {
    id: ticket._id,
    subject: ticket.subject,
    customerName: ticket.customerName,
    customerEmail: ticket.customerEmail,
    status: ticket.status,
    priority: ticket.priority,
    assigneeId: ticket.assigneeId,
    assigneeName: ticket.assigneeId?.name,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

router.get("/", async (req, res) => {
  const filter = { organizationId: req.organization._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.assigneeId) filter.assigneeId = req.query.assigneeId;

  const tickets = await Ticket.find(filter).populate("assigneeId").sort({ createdAt: -1 });
  res.json(tickets.map(ticketSummary));
});

// Lets an agent open a ticket on a customer's behalf (e.g. a phone call).
router.post("/", async (req, res) => {
  const { subject, customerName, customerEmail, message } = req.body;
  if (!subject?.trim() || !customerName?.trim() || !customerEmail?.trim() || !message?.trim()) {
    return res.status(422).json({ message: "Subject, customer name/email, and a message are all required." });
  }

  const ticket = await Ticket.create({
    organizationId: req.organization._id,
    subject: subject.trim(),
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim().toLowerCase(),
  });
  await TicketMessage.create({
    ticketId: ticket._id,
    authorType: "agent",
    authorName: req.user.name,
    body: message.trim(),
  });

  res.status(201).json(ticketSummary(ticket));
});

module.exports = router;
