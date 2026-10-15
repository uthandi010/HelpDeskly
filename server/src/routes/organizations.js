const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { loadOrgAndMembership, requireAdmin } = require("../middleware/orgScoped");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const User = require("../models/User");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const { LIMITS, trimmed, lengthError } = require("../utils/validation");

const ROLES = ["agent", "admin"];

const router = express.Router();
router.use(requireAuth);

async function organizationSummary(org, role) {
  const [memberCount, ticketCount] = await Promise.all([
    OrganizationMember.countDocuments({ organizationId: org._id }),
    Ticket.countDocuments({ organizationId: org._id }),
  ]);
  return {
    id: org._id,
    name: org.name,
    slug: org.slug,
    myRole: role,
    memberCount,
    ticketCount,
  };
}

router.get("/", async (req, res) => {
  const memberships = await OrganizationMember.find({ userId: req.user._id }).populate("organizationId");
  const summaries = await Promise.all(
    memberships
      .filter((m) => m.organizationId) // guards against an orphaned membership if the org was ever deleted
      .map((m) => organizationSummary(m.organizationId, m.role))
  );
  res.json(summaries);
});

router.post("/", async (req, res) => {
  const name = trimmed(req.body.name);
  const slug = trimmed(req.body.slug);
  if (!name || !slug) {
    return res.status(422).json({ message: "Name and slug are required." });
  }
  const tooLong = lengthError([
    ["Name", name, LIMITS.name],
    ["Slug", slug, LIMITS.name],
  ]);
  if (tooLong) return res.status(422).json({ message: tooLong });

  const organization = await Organization.create({
    name,
    slug: slug.toLowerCase(),
    ownerId: req.user._id,
  });
  await OrganizationMember.create({ organizationId: organization._id, userId: req.user._id, role: "admin" });

  res.status(201).json(await organizationSummary(organization, "admin"));
});

router.get("/:organizationId", loadOrgAndMembership, async (req, res) => {
  res.json(await organizationSummary(req.organization, req.membership.role));
});

router.get("/:organizationId/members", loadOrgAndMembership, async (req, res) => {
  const members = await OrganizationMember.find({ organizationId: req.organization._id }).populate("userId");
  res.json(
    members.map((m) => ({
      userId: m.userId._id,
      name: m.userId.name,
      email: m.userId.email,
      role: m.role,
    }))
  );
});

router.post("/:organizationId/members", loadOrgAndMembership, requireAdmin, async (req, res) => {
  const { role } = req.body;
  const normalizedEmail = trimmed(req.body.email).toLowerCase();
  if (!normalizedEmail) {
    return res.status(422).json({ message: "Email is required." });
  }

  const invited = await User.findOne({ email: normalizedEmail });
  if (!invited) {
    return res.status(404).json({ message: "No account found with that email. They need to register first." });
  }

  const existingMembership = await OrganizationMember.findOne({
    organizationId: req.organization._id,
    userId: invited._id,
  });
  if (existingMembership) {
    return res.status(409).json({ message: "That person is already a member of this organization." });
  }

  const member = await OrganizationMember.create({
    organizationId: req.organization._id,
    userId: invited._id,
    role: role === "admin" ? "admin" : "agent",
  });

  res.status(201).json({ userId: invited._id, name: invited.name, email: invited.email, role: member.role });
});

// Loads another member of the organization and refuses to touch the owner,
// who always stays an admin and can never be removed.
async function loadTargetMember(req, res, next) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(404).json({ message: "Member not found." });
  }

  const target = await OrganizationMember.findOne({
    organizationId: req.organization._id,
    userId,
  }).populate("userId");
  if (!target) {
    return res.status(404).json({ message: "Member not found." });
  }
  if (req.organization.ownerId.equals(userId)) {
    return res.status(403).json({ message: "The organization owner can't be changed or removed." });
  }

  req.targetMember = target;
  next();
}

router.patch("/:organizationId/members/:userId", loadOrgAndMembership, requireAdmin, loadTargetMember, async (req, res) => {
  const { role } = req.body;
  if (typeof role !== "string" || !ROLES.includes(role)) {
    return res.status(422).json({ message: "Role must be agent or admin." });
  }

  req.targetMember.role = role;
  await req.targetMember.save();

  const user = req.targetMember.userId;
  res.json({ userId: user._id, name: user.name, email: user.email, role });
});

router.delete("/:organizationId/members/:userId", loadOrgAndMembership, requireAdmin, loadTargetMember, async (req, res) => {
  await req.targetMember.deleteOne();
  // Don't leave tickets assigned to someone who can no longer see them.
  await Ticket.updateMany(
    { organizationId: req.organization._id, assigneeId: req.params.userId },
    { $set: { assigneeId: null } }
  );
  res.status(204).end();
});

module.exports = router;
