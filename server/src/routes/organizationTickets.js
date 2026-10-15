const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("../middleware/auth");
const { loadOrgAndMembership } = require("../middleware/orgScoped");
const Ticket = require("../models/Ticket");
const TicketMessage = require("../models/TicketMessage");
const { generateAccessToken } = require("../utils/accessToken");
const { LIMITS, trimmed, lengthError } = require("../utils/validation");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns a positive integer from a query value, or null when it is invalid.
function positiveInt(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value) || Number(value) < 1) return null;
  return Number(value);
}

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
  const { status, priority, assigneeId, q } = req.query;
  const filter = { organizationId: req.organization._id };

  // Query values are untrusted: arrays/objects (?status[$ne]=x) must never
  // reach the Mongo filter, so each is checked to be an allowed string.
  if (status !== undefined) {
    if (typeof status !== "string" || !Ticket.STATUSES.includes(status)) {
      return res.status(422).json({ message: "Invalid status." });
    }
    filter.status = status;
  }
  if (priority !== undefined) {
    if (typeof priority !== "string" || !Ticket.PRIORITIES.includes(priority)) {
      return res.status(422).json({ message: "Invalid priority." });
    }
    filter.priority = priority;
  }
  if (assigneeId !== undefined) {
    if (typeof assigneeId !== "string" || !mongoose.isValidObjectId(assigneeId)) {
      return res.status(422).json({ message: "assigneeId must be a valid id." });
    }
    filter.assigneeId = assigneeId;
  }
  if (q !== undefined) {
    if (typeof q !== "string" || q.length > LIMITS.search) {
      return res.status(422).json({ message: `q must be a string of at most ${LIMITS.search} characters.` });
    }
    if (q.trim()) {
      const pattern = new RegExp(escapeRegex(q.trim()), "i");
      filter.$or = [{ subject: pattern }, { customerName: pattern }, { customerEmail: pattern }];
    }
  }

  const page = positiveInt(req.query.page, 1);
  const requestedLimit = positiveInt(req.query.limit, DEFAULT_LIMIT);
  if (page === null || requestedLimit === null) {
    return res.status(422).json({ message: "page and limit must be positive integers." });
  }
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate("assigneeId")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Ticket.countDocuments(filter),
  ]);

  // The body stays a plain array (as before); paging info rides in headers.
  res.set({
    "X-Total-Count": String(total),
    "X-Page": String(page),
    "X-Limit": String(limit),
    "X-Total-Pages": String(Math.ceil(total / limit)),
  });
  res.json(tickets.map(ticketSummary));
});

// Lets an agent open a ticket on a customer's behalf (e.g. a phone call).
router.post("/", async (req, res) => {
  const subject = trimmed(req.body.subject);
  const customerName = trimmed(req.body.customerName);
  const customerEmail = trimmed(req.body.customerEmail);
  const message = trimmed(req.body.message);
  if (!subject || !customerName || !customerEmail || !message) {
    return res.status(422).json({ message: "Subject, customer name/email, and a message are all required." });
  }
  const tooLong = lengthError([
    ["Subject", subject, LIMITS.subject],
    ["Name", customerName, LIMITS.name],
    ["Email", customerEmail, LIMITS.email],
    ["Message", message, LIMITS.message],
  ]);
  if (tooLong) return res.status(422).json({ message: tooLong });

  const { token, hash } = generateAccessToken();
  const ticket = await Ticket.create({
    organizationId: req.organization._id,
    subject,
    customerName,
    customerEmail: customerEmail.toLowerCase(),
    accessTokenHash: hash,
  });
  await TicketMessage.create({
    ticketId: ticket._id,
    authorType: "agent",
    authorName: req.user.name,
    body: message,
  });

  // accessToken lets the agent hand the customer a tracking link.
  res.status(201).json({ ...ticketSummary(ticket), accessToken: token });
});

module.exports = router;
