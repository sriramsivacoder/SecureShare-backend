const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    r2Key: { type: String, required: true, unique: true },
    encryptedFileKey: { type: String, required: true },
    fileIV: { type: String, required: true },
    authTag: { type: String, required: true },
    keyIV: { type: String, required: true },
    keyTag: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
    downloadCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("File", fileSchema);
