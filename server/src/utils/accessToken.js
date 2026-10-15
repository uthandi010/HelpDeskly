const crypto = require("crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// The raw token is shown to the customer once; only its hash is stored.
function generateAccessToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

function tokenMatches(token, hash) {
  if (typeof token !== "string" || typeof hash !== "string") return false;
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { generateAccessToken, tokenMatches };
