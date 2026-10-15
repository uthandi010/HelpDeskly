require("./testDb");
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const express = require("express");
const supertest = require("supertest");
const { request, app, registerUser, createOrganization, authHeader } = require("./helpers/api");
const { createLimiters } = require("../src/middleware/rateLimit");
const authRoutes = require("../src/routes/auth");

function ticketPayload(overrides = {}) {
  return {
    subject: "Cannot log in",
    customerName: "Jane Customer",
    customerEmail: "jane@example.com",
    message: "I keep getting an invalid password error.",
    ...overrides,
  };
}

describe("Input validation", () => {
  test("ticket list rejects operator-style and unknown filters with 422", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const base = `/api/organizations/${org.id}/tickets`;

    for (const query of [
      "?status=open&status=closed",
      "?status=bogus",
      "?assigneeId=not-an-id",
      "?page=0",
      "?limit=abc",
    ]) {
      const res = await request(app).get(base + query).set(authHeader(admin.token));
      assert.equal(res.status, 422, query);
    }

    // Express 5's default query parser keeps bracket syntax as a literal key,
    // so operator objects never form; the param is simply ignored.
    const bracket = await request(app).get(`${base}?status[$ne]=open`).set(authHeader(admin.token));
    assert.equal(bracket.status, 200);
  });

  test("register and login reject non-string input with 422, never 500", async () => {
    for (const body of [
      { name: "A", email: { $gt: "" }, password: "Password123!" },
      { name: ["A"], email: "a@example.com", password: "Password123!" },
      { name: "A", email: "a@example.com", password: { $ne: 1 } },
    ]) {
      const res = await request(app).post("/api/auth/register").send(body);
      assert.equal(res.status, 422, JSON.stringify(body));
    }

    for (const body of [{ email: { $gt: "" }, password: { $gt: "" } }, { email: "a@example.com" }, {}]) {
      const res = await request(app).post("/api/auth/login").send(body);
      assert.equal(res.status, 422, JSON.stringify(body));
    }

    const noBody = await request(app).post("/api/auth/login");
    assert.equal(noBody.status, 422);
  });

  test("register enforces name length cap", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "n".repeat(101), email: "long@example.com", password: "Password123!" });
    assert.equal(res.status, 422);
  });

  test("agent-created tickets enforce length caps and non-string input", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    const url = `/api/organizations/${org.id}/tickets`;

    for (const bad of [
      ticketPayload({ subject: "s".repeat(201) }),
      ticketPayload({ message: "m".repeat(5001) }),
      ticketPayload({ customerEmail: { $ne: null } }),
    ]) {
      const res = await request(app).post(url).set(authHeader(admin.token)).send(bad);
      assert.equal(res.status, 422);
    }
  });

  test("organization and invite endpoints reject non-string input with 422", async () => {
    const admin = await registerUser();
    const res = await request(app)
      .post("/api/organizations")
      .set(authHeader(admin.token))
      .send({ name: { a: 1 }, slug: "ok-slug" });
    assert.equal(res.status, 422);

    const org = await createOrganization(admin.token);
    const invite = await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(admin.token))
      .send({ email: { $gt: "" } });
    assert.equal(invite.status, 422);
  });
});

describe("Ticket list pagination and search", () => {
  async function seed(admin, org, count) {
    for (let i = 1; i <= count; i += 1) {
      const res = await request(app)
        .post(`/api/organizations/${org.id}/tickets`)
        .set(authHeader(admin.token))
        .send(ticketPayload({ subject: `Ticket number ${i}`, customerName: i === 3 ? "Zed Special" : "Jane" }));
      assert.equal(res.status, 201);
    }
  }

  test("paginates with page/limit, returning an array plus paging headers", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    await seed(admin, org, 5);
    const base = `/api/organizations/${org.id}/tickets`;

    const page1 = await request(app).get(`${base}?limit=2`).set(authHeader(admin.token));
    assert.equal(page1.status, 200);
    assert.ok(Array.isArray(page1.body));
    assert.equal(page1.body.length, 2);
    assert.equal(page1.headers["x-total-count"], "5");
    assert.equal(page1.headers["x-total-pages"], "3");
    assert.equal(page1.headers["x-page"], "1");

    const page3 = await request(app).get(`${base}?limit=2&page=3`).set(authHeader(admin.token));
    assert.equal(page3.body.length, 1);

    const ids = new Set([...page1.body, ...page3.body].map((t) => t.id));
    assert.equal(ids.size, 3);
  });

  test("caps limit at 100", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);

    const res = await request(app)
      .get(`/api/organizations/${org.id}/tickets?limit=5000`)
      .set(authHeader(admin.token));
    assert.equal(res.status, 200);
    assert.equal(res.headers["x-limit"], "100");
  });

  test("q searches subject, name, and email case-insensitively and treats regex chars literally", async () => {
    const admin = await registerUser();
    const org = await createOrganization(admin.token);
    await seed(admin, org, 3);
    const base = `/api/organizations/${org.id}/tickets`;

    const byName = await request(app).get(`${base}?q=zed`).set(authHeader(admin.token));
    assert.equal(byName.body.length, 1);
    assert.equal(byName.body[0].customerName, "Zed Special");

    const regex = await request(app).get(`${base}?q=${encodeURIComponent(".*")}`).set(authHeader(admin.token));
    assert.equal(regex.status, 200);
    assert.equal(regex.body.length, 0);
  });
});

describe("Member management", () => {
  async function setup() {
    const owner = await registerUser();
    const org = await createOrganization(owner.token);
    const agent = await registerUser();
    await request(app)
      .post(`/api/organizations/${org.id}/members`)
      .set(authHeader(owner.token))
      .send({ email: agent.email, role: "agent" });
    return { owner, org, agent };
  }

  test("an admin can change a member's role", async () => {
    const { owner, org, agent } = await setup();

    const res = await request(app)
      .patch(`/api/organizations/${org.id}/members/${agent.userId}`)
      .set(authHeader(owner.token))
      .send({ role: "admin" });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, "admin");

    const detail = await request(app).get(`/api/organizations/${org.id}`).set(authHeader(agent.token));
    assert.equal(detail.body.myRole, "admin");
  });

  test("rejects an invalid role", async () => {
    const { owner, org, agent } = await setup();
    const res = await request(app)
      .patch(`/api/organizations/${org.id}/members/${agent.userId}`)
      .set(authHeader(owner.token))
      .send({ role: "superuser" });
    assert.equal(res.status, 422);
  });

  test("a plain agent cannot change roles or remove members", async () => {
    const { owner, org, agent } = await setup();

    const patch = await request(app)
      .patch(`/api/organizations/${org.id}/members/${owner.userId}`)
      .set(authHeader(agent.token))
      .send({ role: "agent" });
    assert.equal(patch.status, 403);

    const del = await request(app)
      .delete(`/api/organizations/${org.id}/members/${owner.userId}`)
      .set(authHeader(agent.token));
    assert.equal(del.status, 403);
  });

  test("the owner cannot be demoted or removed, even by another admin", async () => {
    const { owner, org, agent } = await setup();
    await request(app)
      .patch(`/api/organizations/${org.id}/members/${agent.userId}`)
      .set(authHeader(owner.token))
      .send({ role: "admin" });

    const demote = await request(app)
      .patch(`/api/organizations/${org.id}/members/${owner.userId}`)
      .set(authHeader(agent.token))
      .send({ role: "agent" });
    assert.equal(demote.status, 403);

    const remove = await request(app)
      .delete(`/api/organizations/${org.id}/members/${owner.userId}`)
      .set(authHeader(agent.token));
    assert.equal(remove.status, 403);

    const selfRemove = await request(app)
      .delete(`/api/organizations/${org.id}/members/${owner.userId}`)
      .set(authHeader(owner.token));
    assert.equal(selfRemove.status, 403);
  });

  test("removing a member revokes access and unassigns their tickets", async () => {
    const { owner, org, agent } = await setup();
    const created = await request(app)
      .post(`/api/organizations/${org.id}/tickets`)
      .set(authHeader(owner.token))
      .send(ticketPayload());
    await request(app)
      .patch(`/api/tickets/${created.body.id}`)
      .set(authHeader(owner.token))
      .send({ assigneeId: agent.userId });

    const del = await request(app)
      .delete(`/api/organizations/${org.id}/members/${agent.userId}`)
      .set(authHeader(owner.token));
    assert.equal(del.status, 204);

    const access = await request(app).get(`/api/organizations/${org.id}`).set(authHeader(agent.token));
    assert.equal(access.status, 403);

    const ticket = await request(app).get(`/api/tickets/${created.body.id}`).set(authHeader(owner.token));
    assert.equal(ticket.body.assigneeId, null);
  });

  test("404s for a non-member or malformed user id", async () => {
    const { owner, org } = await setup();
    const stranger = await registerUser();

    for (const id of [stranger.userId, "not-an-id"]) {
      const res = await request(app)
        .delete(`/api/organizations/${org.id}/members/${id}`)
        .set(authHeader(owner.token));
      assert.equal(res.status, 404);
    }
  });
});

describe("Rate limiting and security headers", () => {
  test("helmet headers are set", async () => {
    const res = await request(app).get("/health");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-powered-by"], undefined);
  });

  test("strict limiter returns 429 after the configured number of attempts", async () => {
    const limiters = createLimiters({ enabled: true, strictMax: 2 });
    const mini = express();
    mini.use(express.json());
    mini.use("/api/auth/login", limiters.strict);
    mini.use("/api/auth", authRoutes);

    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await supertest(mini).post("/api/auth/login").send({ email: "x@example.com", password: "nope" });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [401, 401, 429]);
  });
});

describe("Production configuration", () => {
  const configPath = path.join(__dirname, "..", "src", "config.js");
  const run = (env) =>
    execFileSync(process.execPath, ["-e", `require(${JSON.stringify(configPath)})`], {
      env: { PATH: process.env.PATH, ...env },
      stdio: "pipe",
    });

  test("refuses to start in production without JWT_SECRET", () => {
    assert.throws(() => run({ NODE_ENV: "production", MONGO_URI: "mongodb://x/y" }), /JWT_SECRET/);
  });

  test("refuses the built-in default secret in production", () => {
    assert.throws(
      () =>
        run({
          NODE_ENV: "production",
          MONGO_URI: "mongodb://x/y",
          JWT_SECRET: "dev-secret-change-me-in-production",
        }),
      /JWT_SECRET/
    );
  });

  test("starts in production with a real secret", () => {
    run({ NODE_ENV: "production", MONGO_URI: "mongodb://x/y", JWT_SECRET: "a-long-random-secret-value" });
  });
});
