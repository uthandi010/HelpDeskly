const express = require("express");
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const Ticket = require("../models/Ticket");
const TicketMessage = require("../models/TicketMessage");

const router = express.Router();

router.get("/organizations/:slug", async (req, res) => {
  const organization = await Organization.findOne({ slug: req.params.slug.toLowerCase() });
  if (!organization) {
    return res.status(404).json({ message: "This support page doesn't exist." });
  }
  res.json({ name: organization.name, slug: organization.slug });
});

router.post("/organizations/:slug/tickets", async (req, res) => {
  const organization = await Organization.findOne({ slug: req.params.slug.toLowerCase() });
  if (!organization) {
    return res.status(404).json({ message: "This support page doesn't exist." });
  }

  const { subject, customerName, customerEmail, message } = req.body;
  if (!subject?.trim() || !customerName?.trim() || !customerEmail?.trim() || !message?.trim()) {
    return res.status(422).json({ message: "Subject, your name/email, and a message are all required." });
  }

  const ticket = await Ticket.create({
    organizationId: organization._id,
    subject: subject.trim(),
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim().toLowerCase(),
  });
  await TicketMessage.create({
    ticketId: ticket._id,
    authorType: "customer",
    authorName: customerName.trim(),
    body: message.trim(),
  });

  res.status(201).json({ id: ticket._id, subject: ticket.subject, status: ticket.status });
});

async function loadTicketForCustomer(req, res, next) {
  const { ticketId } = req.params;
  const email = (req.query.email || req.body?.email || "").trim().toLowerCase();

  if (!mongoose.isValidObjectId(ticketId) || !email) {
    return res.status(404).json({ message: "Ticket not found." });
  }

  const ticket = await Ticket.findById(ticketId);
  // Deliberately the same 404 whether the ticket is missing or the email
  // just doesn't match - never confirm a ticket id exists to a guesser.
  if (!ticket || ticket.customerEmail !== email) {
    return res.status(404).json({ message: "Ticket not found." });
  }

  req.ticket = ticket;
  next();
}

router.get("/tickets/:ticketId", loadTicketForCustomer, async (req, res) => {
  const messages = await TicketMessage.find({ ticketId: req.ticket._id }).sort({ createdAt: 1 });
  res.json({
    id: req.ticket._id,
    subject: req.ticket.subject,
    status: req.ticket.status,
    createdAt: req.ticket.createdAt,
    messages: messages.map((m) => ({
      id: m._id,
      authorType: m.authorType,
      authorName: m.authorName,
      body: m.body,
      createdAt: m.createdAt,
    })),
  });
});

router.post("/tickets/:ticketId/messages", loadTicketForCustomer, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) {
    return res.status(422).json({ message: "Message body is required." });
  }

  const message = await TicketMessage.create({
    ticketId: req.ticket._id,
    authorType: "customer",
    authorName: req.ticket.customerName,
    body: body.trim(),
  });

  // A customer follow-up on a resolved/closed ticket reopens it.
  if (["resolved", "closed"].includes(req.ticket.status)) {
    req.ticket.status = "open";
    await req.ticket.save();
  }

  res.status(201).json({
    id: message._id,
    authorType: message.authorType,
    body: message.body,
    createdAt: message.createdAt,
  });
});

module.exports = router;
