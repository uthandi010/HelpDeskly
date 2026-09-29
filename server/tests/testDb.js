// Imported (for side effects) at the top of every test file. Registers
// connect/clean/disconnect hooks against a real local MongoDB test
// database - node:test runs each file in its own process, so each file
// gets its own connection lifecycle.
const { before, beforeEach, after } = require("node:test");
const mongoose = require("mongoose");
const config = require("../src/config");

if (config.env !== "test") {
  throw new Error("Refusing to run tests outside NODE_ENV=test - this suite wipes its database.");
}

before(async () => {
  await mongoose.connect(config.mongoUri);
});

beforeEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
