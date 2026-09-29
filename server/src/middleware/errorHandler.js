// Centralizes translating Mongoose/programming errors into clean JSON
// responses, so individual routes don't need their own try/catch for the
// common cases (Express 5 forwards a rejected async handler here already).
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(" ");
    return res.status(422).json({ message });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "value";
    return res.status(409).json({ message: `That ${field} is already taken.` });
  }

  if (err.name === "CastError") {
    return res.status(404).json({ message: "Not found." });
  }

  console.error(err);
  return res.status(500).json({ message: "Something went wrong on our end." });
}

module.exports = { errorHandler };
