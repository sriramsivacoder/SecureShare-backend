/**
 * Key generation helper.
 * Run: node scripts/generate-keys.js
 */
const crypto = require("crypto");

const jwtAccessSecret = crypto.randomBytes(64).toString("hex");
const shareAccessSecret = crypto.randomBytes(64).toString("hex");
const masterKey = crypto.randomBytes(32).toString("hex");

console.log("# ─── Copy the following into your .env ───────────────────────────────────\n");
console.log(`JWT_ACCESS_SECRET=${jwtAccessSecret}`);
console.log(`SHARE_ACCESS_SECRET=${shareAccessSecret}`);
console.log(`MASTER_KEY=${masterKey}`);
console.log("\n# ──────────────────────────────────────────────────────────────────────────");
