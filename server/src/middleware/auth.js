const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "You must be logged in to do that." });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "You must be logged in to do that." });
  }

  let user;
  try {
    user = await User.findById(userId);
  } catch {
    // A malformed subject claim (bad ObjectId) is just an invalid token.
    return res.status(401).json({ message: "You must be logged in to do that." });
  }
  if (!user) {
    return res.status(401).json({ message: "You must be logged in to do that." });
  }

  req.user = user;
  next();
}

module.exports = { requireAuth };
