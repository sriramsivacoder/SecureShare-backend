const crypto = require("crypto");
const fs = require("fs");
const { pipeline } = require("stream/promises");

const AppError = require("../utils/appError");

function getMasterKey() {
  const masterKey = Buffer.from(process.env.MASTER_KEY || "", "hex");
  if (masterKey.length !== 32) {
    throw new AppError("MASTER_KEY must be a 32-byte hex string", 500);
  }
  return masterKey;
}

function encryptFileKey(fileKey) {
  const keyIV = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), keyIV);
  const encryptedKey = Buffer.concat([cipher.update(fileKey), cipher.final()]);

  return {
    encryptedFileKey: encryptedKey.toString("hex"),
    keyIV: keyIV.toString("hex"),
    keyTag: cipher.getAuthTag().toString("hex")
  };
}

function decryptFileKey({ encryptedFileKey, keyIV, keyTag }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterKey(), Buffer.from(keyIV, "hex"));
  decipher.setAuthTag(Buffer.from(keyTag, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedFileKey, "hex")),
    decipher.final()
  ]);
}

async function encryptFileFromDisk(inputPath, destinationStream) {
  const fileKey = crypto.randomBytes(32);
  const fileIV = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", fileKey, fileIV);

  await pipeline(fs.createReadStream(inputPath), cipher, destinationStream);

  return {
    fileKey,
    fileIV: fileIV.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex")
  };
}

function createDecryptionStream({ fileKey, fileIV, authTag }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", fileKey, Buffer.from(fileIV, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return decipher;
}

module.exports = {
  encryptFileKey,
  decryptFileKey,
  encryptFileFromDisk,
  createDecryptionStream
};
