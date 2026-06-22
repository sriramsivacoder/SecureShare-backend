const bcrypt = require("bcryptjs");

const User = require("../models/User");
const asyncHandler = require("../middleware/asyncHandler");
const AppError = require("../utils/appError");
const { generateAccessToken } = require("../services/tokenService");
const { createAuditLog } = require("../services/auditLogService");

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new AppError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    password: passwordHash
  });

  await createAuditLog(req, "REGISTER", { email });
  res.status(201).json({ message: "Registration successful" });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw new AppError("Invalid credentials", 401);
  }

  const accessToken = generateAccessToken(user);
  await createAuditLog(req, "LOGIN", { userId: user._id.toString() });

  res.json({
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email
    }
  });
});

exports.logout = asyncHandler(async (req, res) => {
  await createAuditLog(req, "LOGOUT");
  res.json({ message: "Logged out successfully" });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.json(user);
});
