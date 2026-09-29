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

  test("a customer can view their own ticket by id + matching email", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-3" });
    const created = await request(app).post("/api/public/organizations/acme-help-3/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const res = await request(app).get(`/api/public/tickets/${created.body.id}?email=jane@example.com`);

    assert.equal(res.status, 200);
    assert.equal(res.body.messages.length, 1);
  });

  test("a wrong email cannot view someone else's ticket", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-4" });
    const created = await request(app).post("/api/public/organizations/acme-help-4/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const res = await request(app).get(`/api/public/tickets/${created.body.id}?email=attacker@example.com`);

    assert.equal(res.status, 404);
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
      .post(`/api/public/tickets/${created.body.id}/messages?email=jane@example.com`)
      .send({ body: "Any update?" });
    assert.equal(replyRes.status, 201);

    const agentView = await request(app)
      .get(`/api/tickets/${created.body.id}`)
      .set(authHeader(admin.token));
    assert.equal(agentView.body.messages.length, 2);
    assert.equal(agentView.body.messages[1].authorType, "customer");
  });

  test("a customer cannot reply to someone else's ticket with the wrong email", async () => {
    const admin = await registerUser();
    await createOrganization(admin.token, { slug: "acme-help-6" });
    const created = await request(app).post("/api/public/organizations/acme-help-6/tickets").send({
      subject: "Order never arrived",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      message: "It's been two weeks.",
    });

    const res = await request(app)
      .post(`/api/public/tickets/${created.body.id}/messages?email=attacker@example.com`)
      .send({ body: "Let me in" });

    assert.equal(res.status, 404);
  });
});
