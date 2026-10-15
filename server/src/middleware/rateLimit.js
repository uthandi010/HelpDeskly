const { rateLimit } = require("express-rate-limit");
const config = require("../config");

// Disabled under NODE_ENV=test so the suite's many requests from one
// address are not throttled; tests that exercise limiting pass enabled: true.
function createLimiters({ enabled = config.env !== "test", strictMax = 10, generalMax = 300 } = {}) {
  const make = (limit) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: () => !enabled,
      message: { message: "Too many requests. Please try again later." },
    });

  return { strict: make(strictMax), general: make(generalMax) };
}

module.exports = { createLimiters };
