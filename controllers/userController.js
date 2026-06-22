const bcrypt = require("bcryptjs");

const User = require("../models/User");
const asyncHandler = require("../middleware/asyncHandler");
const AppError = require("../utils/appError");

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
    throw new AppError("Name must be between 2 and 80 characters", 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { name: name.trim() },
    { new: true, runValidators: true }
  ).select("-password");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.json(user);
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError("currentPassword and newPassword are required", 400);
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new AppError("Current password is incorrect", 403);
  }

  if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new AppError("New password must be at least 10 chars with uppercase, lowercase, and a digit", 400);
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({ message: "Password changed. Please log in again." });
});