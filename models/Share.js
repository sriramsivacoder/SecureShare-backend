const mongoose = require("mongoose");

const shareSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "File", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, unique: true, required: true },
    passwordHash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    maxDownloads: { type: Number, default: null },
    downloadCount: { type: Number, default: 0 },
    revokedAt: { type: Date, default: null },
    lastAccessedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Share", shareSchema);
