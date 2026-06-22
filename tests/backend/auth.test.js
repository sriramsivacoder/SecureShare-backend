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

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

async function createUser(email = "test@example.com", password = "TestPassword1") {
  const passwordHash = await bcrypt.hash(password, 1);
  return User.create({ name: "Test User", email, password: passwordHash });
}

describe("Auth Routes", () => {
  describe("POST /api/auth/register", () => {
    it("registers a new user and returns 201", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "SecurePass123"
      });
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/registration/i);
    });

    it("rejects duplicate email with 409", async () => {
      await createUser("dup@example.com");
      const res = await request(app).post("/api/auth/register").send({
        name: "Jane",
        email: "dup@example.com",
        password: "SecurePass123"
      });
      expect(res.status).toBe(409);
    });

    it("rejects weak password with 422", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Jane",
        email: "weak@example.com",
        password: "abc"
      });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in a user and returns access token", async () => {
      await createUser("login@example.com");
      const res = await request(app).post("/api/auth/login").send({
        email: "login@example.com",
        password: "TestPassword1"
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body.user.email).toBe("login@example.com");
    });

    it("rejects wrong password with 401", async () => {
      await createUser("wrong@example.com");
      const res = await request(app).post("/api/auth/login").send({
        email: "wrong@example.com",
        password: "WrongPassword1"
      });
      expect(res.status).toBe(401);
    });

    it("rejects non-existent user with 401", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "TestPassword1"
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("returns 200", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns user profile when authenticated", async () => {
      await createUser("me@example.com");
      const loginRes = await request(app).post("/api/auth/login").send({
        email: "me@example.com",
        password: "TestPassword1"
      });
      const token = loginRes.body.accessToken;

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe("me@example.com");
      expect(res.body).not.toHaveProperty("password");
    });

    it("returns 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });
});
