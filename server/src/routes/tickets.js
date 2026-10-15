const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("../middleware/auth");
const Ticket = require("../models/Ticket");
const TicketMessage = require("../models/TicketMessage");
const OrganizationMember = require("../models/OrganizationMember");
const { LIMITS, trimmed, lengthError } = require("../utils/validation");

// Mounted at /api/tickets. Unlike organizationTickets.js, there's no
// organizationId in the URL here - it's derived from the ticket itself,
// same pattern as BookedIn's appointment cancellation endpoint.
const router = express.Router();
router.use(requireAuth);

async function loadTicketWithMembership(req, res, next) {
  const { ticketId } = req.params;
  if (!mongoose.isValidObjectId(ticketId)) {
    return res.status(404).json({ message: "Ticket not found." });
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return res.status(404).json({ message: "Ticket not found." });
  }

  const membership = await OrganizationMember.findOne({
    organizationId: ticket.organizationId,
    userId: req.user._id,
  });
  if (!membership) {
    return res.status(403).json({ message: "You don't have access to do that." });
  }

  req.ticket = ticket;
  req.membership = membership;
  next();
}

function ticketDetail(ticket, messages) {
  return {
    id: ticket._id,
    subject: ticket.subject,
    customerName: ticket.customerName,
    customerEmail: ticket.customerEmail,
    status: ticket.status,
    priority: ticket.priority,
    assigneeId: ticket.assigneeId?._id ?? ticket.assigneeId ?? null,
    assigneeName: ticket.assigneeId?.name ?? null,
    createdAt: ticket.createdAt,
    messages: (messages || []).map((m) => ({
      id: m._id,
      authorType: m.authorType,
      authorName: m.authorName,
      body: m.body,
      createdAt: m.createdAt,
    })),
  };
}

router.get("/:ticketId", loadTicketWithMembership, async (req, res) => {
  const [messages, populated] = await Promise.all([
    TicketMessage.find({ ticketId: req.ticket._id }).sort({ createdAt: 1 }),
    req.ticket.populate("assigneeId"),
  ]);
  res.json(ticketDetail(populated, messages));
});

router.patch("/:ticketId", loadTicketWithMembership, async (req, res) => {
  const { status, priority, assigneeId } = req.body;

  if (status !== undefined) {
    if (!Ticket.STATUSES.includes(status)) {
      return res.status(422).json({ message: "Invalid status." });
    }
    req.ticket.status = status;
  }

  if (priority !== undefined) {
    if (!Ticket.PRIORITIES.includes(priority)) {
      return res.status(422).json({ message: "Invalid priority." });
    }
    req.ticket.priority = priority;
  }

  if (assigneeId !== undefined) {
    if (assigneeId === null) {
      req.ticket.assigneeId = null;
    } else {
      if (typeof assigneeId !== "string" || !mongoose.isValidObjectId(assigneeId)) {
        return res.status(422).json({ message: "assigneeId must be a valid id." });
      }
      const assigneeIsMember = await OrganizationMember.findOne({
        organizationId: req.ticket.organizationId,
        userId: assigneeId,
      });
      if (!assigneeIsMember) {
        return res.status(422).json({ message: "Assignee must be a member of this organization." });
      }
      req.ticket.assigneeId = assigneeId;
    }
  }

  await req.ticket.save();
  const populated = await req.ticket.populate("assigneeId");
  res.json(ticketDetail(populated));
});

router.post("/:ticketId/messages", loadTicketWithMembership, async (req, res) => {
  const body = trimmed(req.body.body);
  if (!body) {
    return res.status(422).json({ message: "Message body is required." });
  }
  const tooLong = lengthError([["Message", body, LIMITS.message]]);
  if (tooLong) return res.status(422).json({ message: tooLong });

  const message = await TicketMessage.create({
    ticketId: req.ticket._id,
    authorType: "agent",
    authorName: req.user.name,
    body,
  });

  // Replying to a resolved/closed ticket reopens it - a common helpdesk
  // convention so a follow-up doesn't silently get lost in a closed ticket.
  if (["resolved", "closed"].includes(req.ticket.status)) {
    req.ticket.status = "open";
    await req.ticket.save();
  }

  res.status(201).json({
    id: message._id,
    authorType: message.authorType,
    authorName: message.authorName,
    body: message.body,
    createdAt: message.createdAt,
  });
});

module.exports = router;
