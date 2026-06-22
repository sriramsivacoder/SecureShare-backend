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
const User = require("../../models/User");
const File = require("../../models/File");
const Share = require("../../models/Share");
const crypto = require("crypto");

let mongod;
let accessToken;
let testFile;

async function createVerifiedUser(email) {
  const hash = await bcrypt.hash("TestPassword1", 1);
  return User.create({ name: "Share User", email, password: hash });
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "TestPassword1" });
  return res.body.accessToken;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const user = await createVerifiedUser("shareuser@example.com");
  accessToken = await login("shareuser@example.com");

  // Create a test file record directly in DB
  testFile = await File.create({
    owner: user._id,
    fileName: "test.txt",
    mimeType: "text/plain",
    size: 100,
    r2Key: crypto.randomUUID(),
    encryptedFileKey: crypto.randomBytes(48).toString("hex"),
    fileIV: crypto.randomBytes(12).toString("hex"),
    authTag: crypto.randomBytes(16).toString("hex"),
    keyIV: crypto.randomBytes(12).toString("hex"),
    keyTag: crypto.randomBytes(16).toString("hex")
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("Share Routes", () => {
  describe("POST /api/shares", () => {
    it("creates a share link", async () => {
      const res = await request(app)
        .post("/api/shares")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fileId: testFile._id.toString() });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("url");
    });

    it("creates a password-protected share", async () => {
      const res = await request(app)
        .post("/api/shares")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fileId: testFile._id.toString(), password: "S3cret!!" });
      expect(res.status).toBe(201);
      expect(res.body.share.passwordHash).toBeDefined();
    });

    it("creates a share with expiry and download limit", async () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .post("/api/shares")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fileId: testFile._id.toString(), expiresAt, maxDownloads: 5 });
      expect(res.status).toBe(201);
      expect(res.body.share.maxDownloads).toBe(5);
    });
  });

  describe("GET /api/shares/link/:token", () => {
    let shareToken;

    beforeEach(async () => {
      const res = await request(app)
        .post("/api/shares")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fileId: testFile._id.toString() });
      shareToken = res.body.token;
    });

    it("returns file info for a valid token", async () => {
      const res = await request(app).get(`/api/shares/link/${shareToken}`);
      expect(res.status).toBe(200);
      expect(res.body.fileName).toBe("test.txt");
      expect(res.body.requiresPassword).toBe(false);
    });

    it("returns 404 for unknown token", async () => {
      const fakeToken = crypto.randomBytes(32).toString("hex");
      const res = await request(app).get(`/api/shares/link/${fakeToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/shares/link/:token/access", () => {
    let passwordToken;

    beforeEach(async () => {
      const res = await request(app)
        .post("/api/shares")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fileId: testFile._id.toString(), password: "SharePass99" });
      passwordToken = res.body.token;
    });

    it("grants access with correct password", async () => {
      const res = await request(app)
        .post(`/api/shares/link/${passwordToken}/access`)
        .send({ password: "SharePass99" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
    });

    it("denies access with wrong password", async () => {
      const res = await request(app)
        .post(`/api/shares/link/${passwordToken}/access`)
        .send({ password: "WrongPassword" });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/shares/:id (revoke)", () => {
    it("revokes a share", async () => {
      const createRes = await request(app)
        .post("/api/shares")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fileId: testFile._id.toString() });
      const shareId = createRes.body.share._id;

      const res = await request(app)
        .delete(`/api/shares/${shareId}`)
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);

      // Verify it's actually revoked
      const share = await Share.findById(shareId);
      expect(share.revokedAt).not.toBeNull();
    });
  });

  describe("GET /api/shares", () => {
    it("returns all shares for authenticated user", async () => {
      const res = await request(app)
        .get("/api/shares")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
