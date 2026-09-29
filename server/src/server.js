const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config");

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB (${config.mongoUri})`);

  app.listen(config.port, () => {
    console.log(`HelpDeskly API listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
