require("./testDb");
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { request, app, registerUser } = require("./helpers/api");

describe("Auth", () => {
  test("register returns a token and user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada Lovelace", email: "ada@example.com", password: "Password123!" });

    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.email, "ada@example.com");
  });

  test("register rejects a duplicate email", async () => {
    await registerUser({ email: "dup@example.com" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Someone Else", email: "dup@example.com", password: "Password123!" });

    assert.equal(res.status, 409);
  });

  test("register rejects a short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Short Pw", email: "shortpw@example.com", password: "1234" });

    assert.equal(res.status, 422);
  });

  test("login returns a token for correct credentials", async () => {
    await registerUser({ email: "grace@example.com", password: "Password123!" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "grace@example.com", password: "Password123!" });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  test("login rejects an incorrect password", async () => {
    await registerUser({ email: "grace2@example.com", password: "Password123!" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "grace2@example.com", password: "WrongPassword!" });

    assert.equal(res.status, 401);
  });

  test("login rejects an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "Password123!" });

    assert.equal(res.status, 401);
  });

  test("a protected endpoint without a token returns 401", async () => {
    const res = await request(app).get("/api/organizations");
    assert.equal(res.status, 401);
  });

  test("a protected endpoint with a garbage token returns 401", async () => {
    const res = await request(app).get("/api/organizations").set("Authorization", "Bearer not-a-real-token");
    assert.equal(res.status, 401);
  });
});
