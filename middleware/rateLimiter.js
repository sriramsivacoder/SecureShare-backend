const rateLimit = require("express-rate-limit");

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const max = Number(process.env.RATE_LIMIT_MAX || 100);

const baseConfig = {
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." }
};

const apiLimiter = rateLimit(baseConfig);
const authLimiter = rateLimit(baseConfig);
const downloadLimiter = rateLimit(baseConfig);
const sharePasswordLimiter = rateLimit(baseConfig);

module.exports = { apiLimiter, authLimiter, downloadLimiter, sharePasswordLimiter };
