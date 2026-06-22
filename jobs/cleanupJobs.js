const cron = require("node-cron");

const Share = require("../models/Share");

function startCleanupJobs() {
  cron.schedule("0 * * * *", async () => {
    const now = new Date();
    await Share.deleteMany({
      $or: [
        { expiresAt: { $lt: now } },
        { maxDownloads: { $ne: null }, $expr: { $gte: ["$downloadCount", "$maxDownloads"] } }
      ]
    });
  });
}

module.exports = { startCleanupJobs };
