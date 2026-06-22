require("dotenv").config();
process.env.JWT_ACCESS_SECRET = "test-access-secret-000000000000000000000000000000000000000000000000";
process.env.SHARE_ACCESS_SECRET = "test-share-secret-0000000000000000000000000000000000000000000000000";
process.env.MASTER_KEY = "0000000000000000000000000000000000000000000000000000000000000000";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../../app");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const os = require("os");
const User = require("../../models/User");

jest.mock("../../services/r2Service", () => {
  const { PassThrough } = require("stream");
  const uploadDataMock = new Map();
  return {
    uploadStream: jest.fn().mockImplementation(async (key) => {
      const writeStream = new PassThrough();
      const chunks = [];
      writeStream.on("data", (chunk) => {
        chunks.push(chunk);
      });
      writeStream.on("end", () => {
        uploadDataMock.set(key, Buffer.concat(chunks));
      });
      return { writeStream, uploadPromise: Promise.resolve() };
    }),
    getObjectStream: jest.fn().mockImplementation(async (key) => {
      const data = uploadDataMock.get(key);
      const bodyStream = new PassThrough();
      if (data) {
        bodyStream.end(data);
      } else {
        bodyStream.destroy(new Error("NoSuchKey"));
      }
      return { Body: bodyStream };
    }),
    deleteObject: jest.fn().mockImplementation(async (key) => {
      uploadDataMock.delete(key);
      return {};
    })
  };
});

jest.mock("../../services/virusScanService", () => ({
  scanFile: jest.fn().mockResolvedValue({ clean: true })
}));

let mongod;
let accessToken;
let testUserId;

async function createVerifiedUser(email = "uploader@example.com") {
  const hash = await bcrypt.hash("TestPassword1", 1);
  return User.create({ name: "Uploader", email, password: hash });
}

async function login(email = "uploader@example.com") {
  const res = await request(app).post("/api/auth/login").send({ email, password: "TestPassword1" });
  return res.body.accessToken;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await createVerifiedUser();
  accessToken = await login();
  testUserId = (await User.findOne({ email: "uploader@example.com" }))._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("File Routes", () => {
  describe("GET /api/files/stats", () => {
    it("returns stats for authenticated user", async () => {
      const res = await request(app)
        .get("/api/files/stats")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalFiles");
      expect(res.body).toHaveProperty("storageUsed");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/files/stats");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/files", () => {
    it("returns empty array when no files", async () => {
      const res = await request(app)
        .get("/api/files")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("DELETE /api/files/:id", () => {
    it("returns 404 for non-existent file", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/files/${fakeId}`)
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/files/upload", () => {
    it("successfully uploads a valid file", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", Buffer.from("this is a test text file content"), {
          filename: "test.txt",
          contentType: "text/plain"
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.fileName).toBe("test.txt");
      expect(res.body.mimeType).toBe("text/plain");
      expect(res.body.size).toBe(Buffer.from("this is a test text file content").length);
      expect(res.body.r2Key).toBeDefined();
    });

    it("returns 400 when no file is uploaded", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/file is required/i);
    });

    it("returns 400 for unsupported file types", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", Buffer.from("alert('xss')"), {
          filename: "malicious.js",
          contentType: "application/javascript"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unsupported file type/i);
    });

    it("returns 400 when virus scan fails", async () => {
      const virusScanService = require("../../services/virusScanService");
      virusScanService.scanFile.mockResolvedValueOnce({ clean: false, virus: "Eicar-Test-Signature" });

      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", Buffer.from("eicar test content"), {
          filename: "eicar.txt",
          contentType: "text/plain"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/uploaded file failed virus scan/i);
    });
  });

  describe("GET /api/files/:id/download", () => {
    let uploadedFileId;
    const testContent = "some very secret file content to be encrypted and streamed back";

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", Buffer.from(testContent), {
          filename: "secret.txt",
          contentType: "text/plain"
        });
      uploadedFileId = res.body._id;
    });

    it("successfully downloads own file with correct headers and decrypted content", async () => {
      const res = await request(app)
        .get(`/api/files/${uploadedFileId}/download`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("text/plain");
      expect(res.headers["content-disposition"]).toBe(`attachment; filename="${encodeURIComponent("secret.txt")}"`);
      expect(res.text).toBe(testContent);
    });

    it("returns 404 for a non-existent file ID", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/files/${fakeId}/download`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/file not found/i);
    });

    it("returns 404 when another user tries to download the file", async () => {
      await createVerifiedUser("otheruser@example.com");
      const otherAccessToken = await login("otheruser@example.com");

      const res = await request(app)
        .get(`/api/files/${uploadedFileId}/download`)
        .set("Authorization", `Bearer ${otherAccessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/file not found/i);
    });
  });
});
