const express = require("express");
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const Ticket = require("../models/Ticket");
const TicketMessage = require("../models/TicketMessage");
const { generateAccessToken, tokenMatches } = require("../utils/accessToken");
const { LIMITS, trimmed, lengthError } = require("../utils/validation");

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

  const subject = trimmed(req.body.subject);
  const customerName = trimmed(req.body.customerName);
  const customerEmail = trimmed(req.body.customerEmail);
  const message = trimmed(req.body.message);
  if (!subject || !customerName || !customerEmail || !message) {
    return res.status(422).json({ message: "Subject, your name/email, and a message are all required." });
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
    organizationId: organization._id,
    subject,
    customerName,
    customerEmail: customerEmail.toLowerCase(),
    accessTokenHash: hash,
  });
  await TicketMessage.create({
    ticketId: ticket._id,
    authorType: "customer",
    authorName: customerName,
    body: message,
  });

  // The access token is only ever returned here; the customer needs it to
  // view or reply to the ticket later.
  res.status(201).json({ id: ticket._id, subject: ticket.subject, status: ticket.status, accessToken: token });
});

async function loadTicketForCustomer(req, res, next) {
  const { ticketId } = req.params;
  // Sent as a header so it stays out of URLs, logs, and referrers.
  const token = req.get("x-ticket-token");

  if (!mongoose.isValidObjectId(ticketId) || !token) {
    return res.status(404).json({ message: "Ticket not found." });
  }

  const ticket = await Ticket.findById(ticketId).select("+accessTokenHash");
  // Deliberately the same 404 whether the ticket is missing or the token
  // just doesn't match - never confirm a ticket id exists to a guesser.
  // Tickets created before access tokens existed have no hash and can't match.
  if (!ticket || !tokenMatches(token, ticket.accessTokenHash)) {
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
  const body = trimmed(req.body.body);
  if (!body) {
    return res.status(422).json({ message: "Message body is required." });
  }
  const tooLong = lengthError([["Message", body, LIMITS.message]]);
  if (tooLong) return res.status(422).json({ message: tooLong });

  const message = await TicketMessage.create({
    ticketId: req.ticket._id,
    authorType: "customer",
    authorName: req.ticket.customerName,
    body,
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
