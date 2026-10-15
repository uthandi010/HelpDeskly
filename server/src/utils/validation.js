// Field length caps shared by the models and request validation.
const LIMITS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000,
  password: 128,
  search: 100,
};

// Request bodies are untrusted JSON: a field can be an object or array
// (e.g. {"$gt": ""}). Anything that is not a string counts as missing.
function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

// fields: [[label, value, max], ...]. Returns an error message, or null.
function lengthError(fields) {
  for (const [label, value, max] of fields) {
    if (value.length > max) return `${label} must be at most ${max} characters.`;
  }
  return null;
}

module.exports = { LIMITS, trimmed, lengthError };
