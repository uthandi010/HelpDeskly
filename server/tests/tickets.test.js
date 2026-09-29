require("./testDb");
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { request, app, registerUser, createOrganization, authHeader } = require("./helpers/api");

async function createTicket(token, orgId, overrides = {}) {
  const payload = {
    subject: "Can't log in",
    customerName: "Jane Customer",
    customerEmail: "jane@example.com",
    message: "I keep getting an invalid password error.",
    ...overrides,
  };
  const res = await request(app)
    .post(`/api/organizations/${orgId}/tickets`)
    .set(authHeader(token))
    .send(payload);
  if (res.status !== 201) {
    throw new Error(`createTicket failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

describe("Tickets", () => {
  test("an agent can open a ticket on a customer's behalf", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);

    const ticket = await createTicket(admin.token, org.id);

    assert.equal(ticket.subject, "Can't log in");
    assert.equal(ticket.status, "open");
    assert.equal(ticket.priority, "medium");
  });

  test("rejects creating a ticket with missing fields", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);

    const res = await request(app)
      .post(`/api/organizations/${org.id}/tickets`)
      .set(authHeader(admin.token))
      .send({ subject: "", customerName: "", customerEmail: "", message: "" });

    assert.equal(res.status, 422);
  });

  test("lists tickets filtered by status", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const open = await createTicket(admin.token, org.id, { subject: "Open one" });
    const resolved = await createTicket(admin.token, org.id, { subject: "Resolved one" });
    await request(app)
      .patch(`/api/tickets/${resolved.id}`)
      .set(authHeader(admin.token))
      .send({ status: "resolved" });

    const res = await request(app)
      .get(`/api/organizations/${org.id}/tickets?status=open`)
      .set(authHeader(admin.token));

    const subjects = res.body.map((t) => t.subject);
    assert.ok(subjects.includes("Open one"));
    assert.ok(!subjects.includes("Resolved one"));
    assert.equal(open.status, "open");
  });

  test("a non-member cannot view a ticket", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const ticket = await createTicket(admin.token, org.id);
    const outsider = await registerUser();

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set(authHeader(outsider.token));

    assert.equal(res.status, 403);
  });

  test("updating status and priority persists", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const ticket = await createTicket(admin.token, org.id);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(authHeader(admin.token))
      .send({ status: "pending", priority: "urgent" });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "pending");
    assert.equal(res.body.priority, "urgent");
  });

  test("rejects an invalid status", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const ticket = await createTicket(admin.token, org.id);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(authHeader(admin.token))
      .send({ status: "on-fire" });

    assert.equal(res.status, 422);
  });

  test("assigning to a non-member is rejected", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const ticket = await createTicket(admin.token, org.id);
    const outsider = await registerUser();

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(authHeader(admin.token))
      .send({ assigneeId: outsider.userId });

    assert.equal(res.status, 422);
  });

  test("assigning to a real member works and is reflected in the ticket", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const agent = await registerUser({ email: "agent3@example.com" });
    await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(admin.token))
      .send({ email: "agent3@example.com", role: "agent" });
    const ticket = await createTicket(admin.token, org.id);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(authHeader(admin.token))
      .send({ assigneeId: agent.userId });

    assert.equal(res.status, 200);
    assert.equal(res.body.assigneeName, agent.name);
  });

  test("an agent reply appears in the ticket thread", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const ticket = await createTicket(admin.token, org.id);

    const replyRes = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set(authHeader(admin.token))
      .send({ body: "Can you try resetting your password?" });
    assert.equal(replyRes.status, 201);

    const detailRes = await request(app).get(`/api/tickets/${ticket.id}`).set(authHeader(admin.token));
    assert.equal(detailRes.body.messages.length, 2);
    assert.equal(detailRes.body.messages[1].authorType, "agent");
  });

  test("replying to a resolved ticket reopens it", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const ticket = await createTicket(admin.token, org.id);
    await request(app).patch(`/api/tickets/${ticket.id}`).set(authHeader(admin.token)).send({ status: "resolved" });

    await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set(authHeader(admin.token))
      .send({ body: "Following up on this." });

    const detailRes = await request(app).get(`/api/tickets/${ticket.id}`).set(authHeader(admin.token));
    assert.equal(detailRes.body.status, "open");
  });
});
