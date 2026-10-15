require("./testDb");
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { request, app, registerUser, createOrganization, authHeader } = require("./helpers/api");

describe("Public support flow", () => {
  test("looking up a support page by slug works with no auth", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { name: "Glow Salon Support", slug: "glow-support" });

    const res = await request(app).get("/api/public/organizations/glow-support");

    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Glow Salon Support");
  });

  test("404s for an unknown slug", async () => {
    const res = await request(app).get("/api/public/organizations/does-not-exist");
    assert.equal(res.status, 404);
  });

  test("a customer can submit a ticket with no account", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help" });

    const res = await request(app).post("/api/public/organizations/acme-help/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "open");
  });

  test("the submitted ticket shows up in the organization's ticket list", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token, { slug: "acme-help-2" });
    await request(app).post("/api/public/organizations/acme-help-2/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const res = await request(app)
      .get(`/api/organizations/${org.id}/tickets`)
      .set(authHeader(admin.token));

    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].customerEmail, "jane@example.com");
  });

  test("a customer can view their own ticket by id + access token", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-3" });
    const created = await request(app).post("/api/public/organizations/acme-help-3/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    assert.match(created.body.accessToken, /^[0-9a-f]{64}$/);
    const res = await request(app)
      .get(`/api/public/tickets/${created.body.id}`)
      .set("X-Ticket-Token", created.body.accessToken);

    assert.equal(res.status, 200);
    assert.equal(res.body.messages.length, 1);
  });

  test("a wrong token cannot view someone else's ticket", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-4" });
    const created = await request(app).post("/api/public/organizations/acme-help-4/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const res = await request(app)
      .get(`/api/public/tickets/${created.body.id}`)
      .set("X-Ticket-Token", "0".repeat(64));

    assert.equal(res.status, 404);
  });

  test("the customer's email alone no longer grants access", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-7" });
    const created = await request(app).post("/api/public/organizations/acme-help-7/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const res = await request(app).get(`/api/public/tickets/${created.body.id}?email=jane@example.com`);
    assert.equal(res.status, 404);

    const noToken = await request(app).get(`/api/public/tickets/${created.body.id}`);
    assert.equal(noToken.status, 404);
  });

  test("the access token is never exposed through the agent API", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-8" });
    const created = await request(app).post("/api/public/organizations/acme-help-8/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const res = await request(app).get(`/api/tickets/${created.body.id}`).set(authHeader(admin.token));
    assert.equal(res.status, 200);
    assert.equal(JSON.stringify(res.body).includes(created.body.accessToken), false);
    assert.equal("accessTokenHash" in res.body, false);
  });

  test("rejects non-string and oversized fields with 422", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-9" });
    const valid = { subject: "Hi", customerName: "Jane", customerEmail: "jane@example.com", message: "Hello" };

    for (const bad of [
      { ...valid, customerEmail: { $gt: "" } },
      { ...valid, subject: ["a"] },
      { ...valid, subject: "s".repeat(201) },
      { ...valid, message: "m".repeat(5001) },
      { ...valid, customerName: "n".repeat(101) },
    ]) {
      const res = await request(app).post("/api/public/organizations/acme-help-9/tickets").send(bad);
      assert.equal(res.status, 422, JSON.stringify(bad).slice(0, 80));
    }
  });

  test("malformed JSON is a 400, not a 500", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json");
    assert.equal(res.status, 400);
  });

  test("a customer can reply to their own ticket, and an agent sees it", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token, { slug: "acme-help-5" });
    const created = await request(app).post("/api/public/organizations/acme-help-5/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const replyRes = await request(app)
      .post(`/api/public/tickets/${created.body.id}/messages`)
      .set("X-Ticket-Token", created.body.accessToken)
      .send({ body: "Any update?" });
    assert.equal(replyRes.status, 201);

    const agentView = await request(app)
      .get(`/api/tickets/${created.body.id}`)
      .set(authHeader(admin.token));
    assert.equal(agentView.body.messages.length, 2);
    assert.equal(agentView.body.messages[1].authorType, "customer");
  });

  test("a customer cannot reply to someone else's ticket with the wrong token", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-6" });
    const created = await request(app).post("/api/public/organizations/acme-help-6/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const res = await request(app)
      .post(`/api/public/tickets/${created.body.id}/messages`)
      .set("X-Ticket-Token", "f".repeat(64))
      .send({ body: "Let me in" });

    assert.equal(res.status, 404);
  });
});
