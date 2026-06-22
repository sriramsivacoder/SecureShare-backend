const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");

const AppError = require("../utils/appError");
const { allowedMimeTypes, maxUploadSizeBytes } = require("../utils/constants");

const uploadDir = path.join(os.tmpdir(), "secure-file-share");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    cb(null, safeName);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: maxUploadSizeBytes },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes[file.mimetype]) {
      cb(new AppError("Unsupported file type", 400));
      return;
    }
    cb(null, true);
  }
});
