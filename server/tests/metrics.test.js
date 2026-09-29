require("./testDb");
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { request, app, registerUser, createOrganization, authHeader } = require("./helpers/api");

async function createTicket(token, orgId, overrides = {}) {
  const payload = {
    subject: "Test ticket",
    customerName: "Jane Customer",
    customerEmail: "jane@example.com",
    message: "Help please.",
    ...overrides,
  };
  const res = await request(app)
    .post(`/api/organizations/${orgId}/tickets`)
    .set(authHeader(token))
    .send(payload);
  return res.body;
}

describe("Metrics", () => {
  test("a brand-new organization has all-zero metrics and a 30-day zero-filled chart", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);

    const res = await request(app).get(`/api/organizations/${org.id}/metrics`).set(authHeader(admin.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.totalTickets, 0);
    assert.deepEqual(res.body.byStatus, { open: 0, pending: 0, resolved: 0, closed: 0 });
    assert.equal(res.body.ticketsByDay.length, 30);
    assert.ok(res.body.ticketsByDay.every((d) => d.tickets === 0));
  });

  test("counts tickets by status and priority correctly", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const t1 = await createTicket(admin.token, org.id, { subject: "One" });
    const t2 = await createTicket(admin.token, org.id, { subject: "Two" });
    await createTicket(admin.token, org.id, { subject: "Three" });

    await request(app).patch(`/api/tickets/${t1.id}`).set(authHeader(admin.token)).send({ status: "resolved" });
    await request(app).patch(`/api/tickets/${t2.id}`).set(authHeader(admin.token)).send({ priority: "urgent" });

    const res = await request(app).get(`/api/organizations/${org.id}/metrics`).set(authHeader(admin.token));

    assert.equal(res.body.totalTickets, 3);
    assert.equal(res.body.byStatus.resolved, 1);
    assert.equal(res.body.byStatus.open, 2);
    assert.equal(res.body.byPriority.urgent, 1);
    assert.equal(res.body.byPriority.medium, 2);
  });

  test("today's ticket shows up in the daily series", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    await createTicket(admin.token, org.id);

    const res = await request(app).get(`/api/organizations/${org.id}/metrics`).set(authHeader(admin.token));

    const todayKey = new Date().toISOString().slice(0, 10);
    const todayRow = res.body.ticketsByDay.find((d) => d.date === todayKey);
    assert.equal(todayRow.tickets, 1);
  });

  test("a non-member cannot see metrics", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const outsider = await registerUser();

    const res = await request(app).get(`/api/organizations/${org.id}/metrics`).set(authHeader(outsider.token));

    assert.equal(res.status, 403);
  });
});
