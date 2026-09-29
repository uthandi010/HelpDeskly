const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { loadOrgAndMembership } = require("../middleware/orgScoped");
const Ticket = require("../models/Ticket");

// Mounted at /api/organizations/:organizationId/metrics
const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadOrgAndMembership);

const DAYS_OF_HISTORY = 30;

function zeroFilledDays(countsByDate) {
  const days = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let offset = DAYS_OF_HISTORY - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - offset);
    const key = day.toISOString().slice(0, 10);
    days.push({ date: key, tickets: countsByDate.get(key) || 0 });
  }
  return days;
}

router.get("/", async (req, res) => {
  const organizationId = req.organization._id;
  const since = new Date(Date.now() - DAYS_OF_HISTORY * 24 * 60 * 60 * 1000);

  const [statusRows, priorityRows, dailyRows, totalTickets] = await Promise.all([
    Ticket.aggregate([
      { $match: { organizationId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Ticket.aggregate([
      { $match: { organizationId } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    Ticket.aggregate([
      { $match: { organizationId, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    Ticket.countDocuments({ organizationId }),
  ]);

  const byStatus = Object.fromEntries(Ticket.STATUSES.map((s) => [s, 0]));
  statusRows.forEach((row) => {
    byStatus[row._id] = row.count;
  });

  const byPriority = Object.fromEntries(Ticket.PRIORITIES.map((p) => [p, 0]));
  priorityRows.forEach((row) => {
    byPriority[row._id] = row.count;
  });

  const countsByDate = new Map(dailyRows.map((row) => [row._id, row.count]));

  res.json({
    totalTickets,
    byStatus,
    byPriority,
    ticketsByDay: zeroFilledDays(countsByDate),
  });
});

module.exports = router;
