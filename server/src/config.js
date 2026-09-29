require("dotenv").config();

const env = process.env.NODE_ENV || "development";

const defaults = {
  development: "mongodb://127.0.0.1:27017/helpdeskly",
  test: "mongodb://127.0.0.1:27017/helpdeskly_test",
  production: undefined,
};

module.exports = {
  env,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || defaults[env],
  // Dev-only default. Set JWT_SECRET in production.
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(","),
};
