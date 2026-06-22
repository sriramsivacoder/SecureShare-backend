const bcrypt = require("bcryptjs");
const { pipeline } = require("stream/promises");

const File = require("../models/File");
const Share = require("../models/Share");
const asyncHandler = require("../middleware/asyncHandler");
const AppError = require("../utils/appError");
const { sha256, randomToken } = require("../utils/crypto");
const { signShareAccessToken, verifyShareAccessToken } = require("../services/tokenService");
const { createAuditLog } = require("../services/auditLogService");
const { getObjectStream } = require("../services/r2Service");
const { decryptFileKey, createDecryptionStream } = require("../services/encryptionService");

async function findActiveShareByToken(token) {
  const share = await Share.findOne({ tokenHash: sha256(token) });
  if (!share) {
    throw new AppError("Share link not found", 404);
  }
  if (share.revokedAt) {
    throw new AppError("Share link has been revoked", 410);
  }
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new AppError("Share link has expired", 410);
  }
  if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
    throw new AppError("Share download limit reached", 410);
  }
  return share;
}

exports.createShare = asyncHandler(async (req, res) => {
  const { fileId, password, expiresAt, maxDownloads } = req.body;
  const file = await File.findOne({ _id: fileId, owner: req.user.userId });

  if (!file) {
    throw new AppError("File not found", 404);
  }

  const shareToken = randomToken();
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;

  const share = await Share.create({
    fileId: file._id,
    owner: req.user.userId,
    tokenHash: sha256(shareToken),
    passwordHash,
    expiresAt: expiresAt || null,
    maxDownloads: maxDownloads || null
  });

  await createAuditLog(req, "CREATE_SHARE", { shareId: share._id.toString(), fileId: file._id.toString() });
  res.status(201).json({
    token: shareToken,
    url: `${process.env.CLIENT_URL}/share/${shareToken}`,
    share
  });
});

exports.getShares = asyncHandler(async (req, res) => {
  const shares = await Share.find({ owner: req.user.userId })
    .populate("fileId", "fileName size mimeType")
    .sort({ createdAt: -1 });

  res.json(shares);
});

exports.getShareInfo = asyncHandler(async (req, res) => {
  console.log("[getShareInfo] Get share info for token:", req.params.token);
  const share = await findActiveShareByToken(req.params.token);
  const file = await File.findById(share.fileId);
  console.log("[getShareInfo] Share found - requiresPassword:", !!share.passwordHash, "fileName:", file?.fileName);

  if (!file) {
    throw new AppError("File not found", 404);
  }

  res.json({
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    requiresPassword: Boolean(share.passwordHash),
    expiresAt: share.expiresAt,
    downloadCount: share.downloadCount,
    maxDownloads: share.maxDownloads
  });
});

exports.verifyPassword = asyncHandler(async (req, res) => {
  console.log("[verifyPassword] Verify password request for token:", req.params.token);
  const share = await findActiveShareByToken(req.params.token);
  console.log("[verifyPassword] Share found, passwordHash exists:", !!share.passwordHash);

  if (!share.passwordHash) {
    console.log("[verifyPassword] Share is passwordless, generating access token");
    const accessToken = signShareAccessToken(share._id.toString());
    console.log("[verifyPassword] Access token generated successfully");
    return res.json({ accessToken });
  }

  console.log("[verifyPassword] Verifying password hash");
  const isValid = await bcrypt.compare(req.body.password, share.passwordHash);
  if (!isValid) {
    console.error("[verifyPassword] Password verification failed");
    throw new AppError("Incorrect share password", 403);
  }

  console.log("[verifyPassword] Password verified, generating access token");
  const accessToken = signShareAccessToken(share._id.toString());
  console.log("[verifyPassword] Access token generated successfully");
  res.json({ accessToken });
});

exports.downloadSharedFile = asyncHandler(async (req, res) => {
  console.log("[downloadSharedFile] Download request received");
  console.log("[downloadSharedFile] Token:", req.params.token);
  console.log("[downloadSharedFile] Authorization header present:", !!req.headers.authorization);
  
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    console.error("[downloadSharedFile] Missing or invalid authorization header");
    throw new AppError("Download authorization required", 401);
  }

  console.log("[downloadSharedFile] Verifying share access token");
  let access;
  try {
    access = verifyShareAccessToken(authHeader.split(" ")[1]);
    console.log("[downloadSharedFile] Token verified, shareId:", access.shareId);
  } catch (err) {
    console.error("[downloadSharedFile] Token verification failed:", err.message);
    throw new AppError("Invalid or expired access token", 401);
  }

  const share = await Share.findById(access.shareId);
  console.log("[downloadSharedFile] Share found:", !!share);

  if (!share) {
    console.error("[downloadSharedFile] Share not found for shareId:", access.shareId);
    throw new AppError("Share not found", 404);
  }

  console.log("[downloadSharedFile] Verifying share token match");
  await findActiveShareByToken(req.params.token);
  
  const file = await File.findById(share.fileId);
  console.log("[downloadSharedFile] File found:", !!file, "fileName:", file?.fileName);
  if (!file) {
    console.error("[downloadSharedFile] File not found for fileId:", share.fileId);
    throw new AppError("File not found", 404);
  }

  console.log("[downloadSharedFile] Starting decryption process");
  const fileKey = decryptFileKey(file);
  const encryptedObject = await getObjectStream(file.r2Key);
  const decryptStream = createDecryptionStream({
    fileKey,
    fileIV: file.fileIV,
    authTag: file.authTag
  });

  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);

  console.log("[downloadSharedFile] Incrementing download counts and saving");
  share.downloadCount += 1;
  share.lastAccessedAt = new Date();
  file.downloadCount += 1;
  await share.save();
  await file.save();
  await createAuditLog(req, "DOWNLOAD_SHARE", { shareId: share._id.toString(), fileId: file._id.toString() });

  console.log("[downloadSharedFile] Streaming file to client");
  await pipeline(encryptedObject.Body, decryptStream, res);
  console.log("[downloadSharedFile] Stream completed successfully");
});

exports.revokeShare = asyncHandler(async (req, res) => {
  const share = await Share.findOne({ _id: req.params.id, owner: req.user.userId });
  if (!share) {
    throw new AppError("Share not found", 404);
  }

  share.revokedAt = new Date();
  await share.save();
  await createAuditLog(req, "REVOKE_SHARE", { shareId: share._id.toString() });

  res.json({ message: "Share revoked" });
});
