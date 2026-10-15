const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./config");
const { errorHandler } = require("./middleware/errorHandler");
const { createLimiters } = require("./middleware/rateLimit");

const authRoutes = require("./routes/auth");
const organizationRoutes = require("./routes/organizations");
const organizationTicketRoutes = require("./routes/organizationTickets");
const metricsRoutes = require("./routes/metrics");
const ticketRoutes = require("./routes/tickets");
const publicRoutes = require("./routes/public");

const app = express();

const limiters = createLimiters();

if (config.trustProxy) app.set("trust proxy", config.trustProxy);

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit", "X-Total-Pages"],
  })
);
app.use(express.json());
// Express 5 leaves req.body undefined when no JSON was sent; routes destructure it.
app.use((req, res, next) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) req.body = {};
  next();
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", limiters.general);
app.use("/api/auth/login", limiters.strict);
app.use("/api/auth/register", limiters.strict);
app.post("/api/public/organizations/:slug/tickets", limiters.strict);
app.use("/api/public/tickets", limiters.strict);

app.use("/api/auth", authRoutes);
app.use("/api/organizations/:organizationId/tickets", organizationTicketRoutes);
app.use("/api/organizations/:organizationId/metrics", metricsRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/public", publicRoutes);

app.use((req, res) => res.status(404).json({ message: "Not found." }));
app.use(errorHandler);

module.exports = app;
