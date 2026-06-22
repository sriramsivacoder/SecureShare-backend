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
const crypto = require("crypto");
const User = require("../../models/User");
const File = require("../../models/File");

let mongod;
let ownerToken;
let otherToken;
let ownerFile;

async function makeUser(email) {
  const hash = await bcrypt.hash("TestPassword1", 1);
  return User.create({ name: "User", email, password: hash });
}

async function loginAs(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "TestPassword1" });
  return res.body.accessToken;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const owner = await makeUser("owner@example.com");
  await makeUser("other@example.com");

  ownerToken = await loginAs("owner@example.com");
  otherToken = await loginAs("other@example.com");

  ownerFile = await File.create({
    owner: owner._id,
    fileName: "private.txt",
    mimeType: "text/plain",
    size: 50,
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

describe("Permission Tests", () => {
  describe("Unauthenticated access", () => {
    it("cannot access /api/files without token", async () => {
      expect((await request(app).get("/api/files")).status).toBe(401);
    });
    it("cannot access /api/shares without token", async () => {
      expect((await request(app).get("/api/shares")).status).toBe(401);
    });
    it("cannot upload without token", async () => {
      expect((await request(app).post("/api/files/upload")).status).toBe(401);
    });
  });

  describe("Cross-user access", () => {
    it("cannot delete another user's file", async () => {
      const res = await request(app)
        .delete(`/api/files/${ownerFile._id}`)
        .set("Authorization", `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });

    it("cannot download another user's file", async () => {
      const res = await request(app)
        .get(`/api/files/${ownerFile._id}/download`)
        .set("Authorization", `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });

    it("cannot create a share for another user's file", async () => {
      const res = await request(app)
        .post("/api/shares")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ fileId: ownerFile._id.toString() });
      expect(res.status).toBe(404);
    });
  });

  describe("Share revocation permissions", () => {
    it("cannot revoke another user's share", async () => {
      const createRes = await request(app)
        .post("/api/shares")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ fileId: ownerFile._id.toString() });
      const shareId = createRes.body.share._id;

      const revokeRes = await request(app)
        .delete(`/api/shares/${shareId}`)
        .set("Authorization", `Bearer ${otherToken}`);
      expect(revokeRes.status).toBe(404);
    });
  });
});
