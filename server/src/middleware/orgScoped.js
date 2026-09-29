const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");

// Loads the organization from :organizationId and confirms req.user is a
// member of it before the route handler runs. A non-member gets 403 even
// with a valid id, and a malformed id 404s rather than 500ing.
async function loadOrgAndMembership(req, res, next) {
  const { organizationId } = req.params;

  if (!mongoose.isValidObjectId(organizationId)) {
    return res.status(404).json({ message: "Organization not found." });
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found." });
  }

  const membership = await OrganizationMember.findOne({
    organizationId: organization._id,
    userId: req.user._id,
  });
  if (!membership) {
    return res.status(403).json({ message: "You don't have access to do that." });
  }

  req.organization = organization;
  req.membership = membership;
  next();
}

function requireAdmin(req, res, next) {
  if (req.membership.role !== "admin") {
    return res.status(403).json({ message: "You don't have access to do that." });
  }
  next();
}

module.exports = { loadOrgAndMembership, requireAdmin };
