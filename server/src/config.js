require("dotenv").config();

const env = process.env.NODE_ENV || "development";

const defaults = {
  development: "mongodb://127.0.0.1:27017/helpdeskly",
  test: "mongodb://127.0.0.1:27017/helpdeskly_test",
  production: undefined,
};

const DEFAULT_JWT_SECRET = "dev-secret-change-me-in-production";
const jwtSecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

if (env === "production" && jwtSecret === DEFAULT_JWT_SECRET) {
  throw new Error("JWT_SECRET must be set to a unique secret in production.");
}

module.exports = {
  env,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || defaults[env],
  // The default is dev-only; startup fails in production without JWT_SECRET.
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(","),
  // Set TRUST_PROXY=1 behind a reverse proxy so rate limits see client IPs.
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false,
};
