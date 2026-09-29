const request = require("supertest");
const app = require("../../src/app");

let counter = 0;

async function registerUser(overrides = {}) {
  counter += 1;
  const payload = {
    name: "Test User",
    email: `user${counter}@example.com`,
    password: "Password123!",
    ...overrides,
  };

  const res = await request(app).post("/api/auth/register").send(payload);
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createOrganization(token, overrides = {}) {
  counter += 1;
  const payload = { name: `Org ${counter}`, slug: `org-${counter}`, ...overrides };
  const res = await request(app).post("/api/organizations").set(authHeader(token)).send(payload);
  if (res.status !== 201) {
    throw new Error(`createOrganization failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

module.exports = { app, request, registerUser, authHeader, createOrganization };
