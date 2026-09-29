const express = require("express");
const cors = require("cors");
const config = require("./config");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const organizationRoutes = require("./routes/organizations");
const organizationTicketRoutes = require("./routes/organizationTickets");
const metricsRoutes = require("./routes/metrics");
const ticketRoutes = require("./routes/tickets");
const publicRoutes = require("./routes/public");

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/organizations/:organizationId/tickets", organizationTicketRoutes);
app.use("/api/organizations/:organizationId/metrics", metricsRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/public", publicRoutes);

app.use((req, res) => res.status(404).json({ message: "Not found." }));
app.use(errorHandler);

module.exports = app;
