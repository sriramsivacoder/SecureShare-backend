const Joi = require("joi");

module.exports = {
  createShareSchema: Joi.object({
    fileId: Joi.string().hex().length(24).required(),
    password: Joi.string().min(4).max(128).allow("", null),
    expiresAt: Joi.date().greater("now").allow(null),
    maxDownloads: Joi.number().integer().min(1).max(100000).allow(null)
  }),
  verifySharePasswordSchema: Joi.object({
    password: Joi.string().min(1).required()
  })
};
