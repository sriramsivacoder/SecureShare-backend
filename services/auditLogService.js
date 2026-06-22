const AuditLog = require("../models/AuditLog");

/**
 * Create an audit log entry.
 * @param {import("express").Request} req
 * @param {string} action
 * @param {object} [metadata]
 */
async function createAuditLog(req, action, metadata = {}) {
  try {
    await AuditLog.create({
      user: req.user?.userId || null,
      action,
      ip: req.ip || null,
      userAgent: req.get("user-agent") || null,
      metadata,
      timestamp: new Date()
    });
  } catch (err) {
    // Never let audit log failures break the main request flow
    console.error("[auditLog] Failed to write audit log:", err.message);
  }
}

/**
 * Query audit logs (admin / owner use).
 * @param {object} filter   Mongoose filter object
 * @param {number} limit
 * @param {number} skip
 */
async function getAuditLogs(filter = {}, limit = 50, skip = 0) {
  return AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean();
}

module.exports = { createAuditLog, getAuditLogs };
