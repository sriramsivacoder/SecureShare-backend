const Joi = require("joi");

const password = Joi.string().min(10).max(128).pattern(/[A-Z]/).pattern(/[a-z]/).pattern(/[0-9]/);

module.exports = {
  registerSchema: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    email: Joi.string().email().required(),
    password: password.required()
  }),
  loginSchema: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};
