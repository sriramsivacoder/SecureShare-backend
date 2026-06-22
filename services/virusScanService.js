/**
 * Virus scan service.
 *
 * Attempts to connect to a local ClamAV daemon (clamd) via TCP.
 * If ClamAV is unavailable (e.g. development without Docker),
 * it gracefully degrades:
 *   - NODE_ENV !== "production"  → logs warning, marks file as clean
 *   - NODE_ENV === "production"  → throws, rejecting the upload
 *
 * To run ClamAV locally:
 *   docker run -p 3310:3310 -d clamav/clamav:latest
 */
const net = require("net");
const fs = require("fs");

const CLAMAV_HOST = process.env.CLAMAV_HOST || "127.0.0.1";
const CLAMAV_PORT = Number(process.env.CLAMAV_PORT || 3310);
const CHUNK_SIZE = 2048;

/**
 * Stream a file to clamd using the INSTREAM protocol.
 * @param {string} filePath
 * @returns {Promise<{ clean: boolean, virus?: string }>}
 */
function scanWithClamd(filePath) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(CLAMAV_PORT, CLAMAV_HOST);
    let response = "";

    socket.setTimeout(30000);

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");

      const fileStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
      fileStream.on("data", (chunk) => {
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(chunk.length, 0);
        socket.write(sizeBuffer);
        socket.write(chunk);
      });

      fileStream.on("end", () => {
        const zeroChunk = Buffer.alloc(4);
        socket.write(zeroChunk);
      });

      fileStream.on("error", (err) => {
        socket.destroy();
        reject(err);
      });
    });

    socket.on("data", (data) => {
      response += data.toString();
    });

    socket.on("end", () => {
      const result = response.trim();
      if (result.includes("OK")) {
        resolve({ clean: true });
      } else if (result.includes("FOUND")) {
        const virus = result.split(":")[1]?.trim().replace(" FOUND", "") || "UNKNOWN";
        resolve({ clean: false, virus });
      } else {
        reject(new Error(`ClamAV returned unexpected response: ${result}`));
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("ClamAV connection timed out"));
    });

    socket.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Scan a file for viruses.
 * @param {string} filePath  Absolute path to the file on disk.
 * @returns {Promise<{ clean: boolean, virus?: string }>}
 */
async function scanFile(filePath) {
  try {
    return await scanWithClamd(filePath);
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      // In production, a missing ClamAV is a hard failure
      const AppError = require("../utils/appError");
      throw new AppError(`Virus scanning unavailable: ${err.message}`, 503);
    }

    // In development/test, degrade gracefully
    console.warn(`[virusScan] ClamAV unavailable (${err.message}). Skipping scan in non-production mode.`);
    return { clean: true };
  }
}

module.exports = { scanFile };
