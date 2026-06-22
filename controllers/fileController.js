const fs = require("fs");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");

const File = require("../models/File");
const Share = require("../models/Share");
const asyncHandler = require("../middleware/asyncHandler");
const AppError = require("../utils/appError");
const { uploadStream, getObjectStream, deleteObject } = require("../services/r2Service");
const { encryptFileFromDisk, decryptFileKey, createDecryptionStream, encryptFileKey } = require("../services/encryptionService");
const { scanFile } = require("../services/virusScanService");
const { createAuditLog } = require("../services/auditLogService");

async function cleanupTempFile(file) {
  if (file?.path) {
    await fs.promises.rm(file.path, { force: true });
  }
}

exports.uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("File is required", 400);
  }

  const scanResult = await scanFile(req.file.path);
  if (!scanResult.clean) {
    await cleanupTempFile(req.file);
    throw new AppError("Uploaded file failed virus scan", 400);
  }

  const r2Key = crypto.randomUUID();
  const { writeStream, uploadPromise } = await uploadStream(
    r2Key,
    req.file.size,
    req.file.mimetype || "application/octet-stream"
  );
  
  const encryptedFile = await encryptFileFromDisk(req.file.path, writeStream);
  const wrappedFileKey = encryptFileKey(encryptedFile.fileKey);

  await uploadPromise;
  console.log("USER ID =", req.user.userId);

console.log({
  owner: req.user.userId,
  fileName: req.file.originalname,
  mimeType: req.file.mimetype,
  size: req.file.size,
  r2Key,
  encryptedFileKey: wrappedFileKey.encryptedFileKey,
  fileIV: encryptedFile.fileIV,
  authTag: encryptedFile.authTag,
  keyIV: wrappedFileKey.keyIV,
  keyTag: wrappedFileKey.keyTag
});

  const file = await File.create({
    owner: req.user.userId,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    r2Key,
    encryptedFileKey: wrappedFileKey.encryptedFileKey,
    fileIV: encryptedFile.fileIV,
    authTag: encryptedFile.authTag,
    keyIV: wrappedFileKey.keyIV,
    keyTag: wrappedFileKey.keyTag
  });

  await cleanupTempFile(req.file);
  await createAuditLog(req, "UPLOAD", { fileId: file._id.toString(), fileName: file.fileName });

  res.status(201).json(file);
});

exports.getFiles = asyncHandler(async (req, res) => {
  const files = await File.find({ owner: req.user.userId }).sort({ createdAt: -1 });
  res.json(files);
});

exports.getFileStats = asyncHandler(async (req, res) => {
  const files = await File.find({ owner: req.user.userId });
  const shares = await Share.find({ owner: req.user.userId, revokedAt: null });

  res.json({
    totalFiles: files.length,
    totalShares: shares.length,
    totalDownloads: files.reduce((total, file) => total + (file.downloadCount || 0), 0),
    storageUsed: files.reduce((total, file) => total + file.size, 0)
  });
});

exports.deleteFile = asyncHandler(async (req, res) => {
  const file = await File.findOne({ _id: req.params.id, owner: req.user.userId });
  if (!file) {
    throw new AppError("File not found", 404);
  }

  await deleteObject(file.r2Key);
  await Share.deleteMany({ fileId: file._id });
  await file.deleteOne();
  await createAuditLog(req, "DELETE_FILE", { fileId: file._id.toString() });

  res.json({ message: "File deleted successfully" });
});

exports.downloadOwnedFile = asyncHandler(async (req, res) => {
  const file = await File.findOne({ _id: req.params.id, owner: req.user.userId });
  if (!file) {
    throw new AppError("File not found", 404);
  }

  const wrappedKey = decryptFileKey(file);
  const object = await getObjectStream(file.r2Key);
  const decryptStream = createDecryptionStream({
    fileKey: wrappedKey,
    fileIV: file.fileIV,
    authTag: file.authTag
  });

  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);

  file.downloadCount += 1;
  await file.save();
  await createAuditLog(req, "DOWNLOAD_OWN_FILE", { fileId: file._id.toString() });

  await pipeline(object.Body, decryptStream, res);
});
