const jwt = require("jsonwebtoken");

const { accessTokenTtl } = require("../utils/constants");

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: accessTokenTtl }
  );
}

function signShareAccessToken(shareId) {
  return jwt.sign({ shareId }, process.env.SHARE_ACCESS_SECRET, { expiresIn: "10m" });
}

function verifyShareAccessToken(token) {
  return jwt.verify(token, process.env.SHARE_ACCESS_SECRET);
}

module.exports = {
  generateAccessToken,
  signShareAccessToken,
  verifyShareAccessToken
};
