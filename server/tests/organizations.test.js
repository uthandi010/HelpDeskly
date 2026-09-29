require("./testDb");
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { request, app, registerUser, createOrganization, authHeader } = require("./helpers/api");

describe("Organizations", () => {
  test("creating an organization makes the creator an admin", async () => {
    const owner = await registerUser();
    const org = await createOrganization(owner.token, { name: "Acme Support", slug: "acme-support" });

    assert.equal(org.myRole, "admin");
    assert.equal(org.memberCount, 1);
  });

  test("a non-member cannot see members or tickets", async () => {
    const owner = await registerUser();
    const org = await createOrganization(owner.token);
    const outsider = await registerUser();

    const membersRes = await request(app)
      .get(`/api/organizations/${org.id}/members`)
      .set(authHeader(outsider.token));
    assert.equal(membersRes.status, 403);

    const ticketsRes = await request(app)
      .get(`/api/organizations/${org.id}/tickets`)
      .set(authHeader(outsider.token));
    assert.equal(ticketsRes.status, 403);
  });

  test("an admin can invite an existing user as an agent", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const agent = await registerUser({ email: "agent@example.com" });

    const res = await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(admin.token))
      .send({ email: "agent@example.com", role: "agent" });

    assert.equal(res.status, 201);
    assert.equal(res.body.role, "agent");

    const listRes = await request(app)
      .get(`/api/organizations/${org.id}/members`)
      .set(authHeader(agent.token));
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 2);
  });

  test("404s inviting an email with no account", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);

    const res = await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(admin.token))
      .send({ email: "nobody@example.com", role: "agent" });

    assert.equal(res.status, 404);
  });

  test("does not let a plain agent invite others", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const agent = await registerUser({ email: "agent2@example.com" });
    await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(admin.token))
      .send({ email: "agent2@example.com", role: "agent" });
    await registerUser({ email: "third@example.com" });

    const res = await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(agent.token))
      .send({ email: "third@example.com", role: "agent" });

    assert.equal(res.status, 403);
  });

  test("cannot invite the same person twice", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    await registerUser({ email: "dup-invite@example.com" });

    await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(admin.token))
      .send({ email: "dup-invite@example.com", role: "agent" });

    const res = await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(admin.token))
      .send({ email: "dup-invite@example.com", role: "agent" });

    assert.equal(res.status, 409);
  });

  test("rejects a duplicate slug", async () => {
    const owner = await registerUser();
    await createOrganization(owner.token, { slug: "taken-slug" });

    const res = await request(app)
      .post("/api/organizations")
      .set(authHeader(owner.token))
      .send({ name: "Another Org", slug: "taken-slug" });

    assert.equal(res.status, 409);
  });
});
