require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/dbConfig");
const { startCleanupJobs } = require("./jobs/cleanupJobs");

const port = Number(process.env.PORT || 5000);

async function bootstrap() {
  await connectDB();
  startCleanupJobs();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
