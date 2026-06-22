const jwt = require("jsonwebtoken");

const asyncHandler = require("./asyncHandler");
const AppError = require("../utils/appError");

module.exports = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }

  const token = authHeader.split(" ")[1];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

  req.user = {
    userId: payload.userId,
    email: payload.email
  };

  next();
});
