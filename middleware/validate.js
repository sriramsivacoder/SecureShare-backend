const AppError = require("../utils/appError");

function validate(schema, property = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return next(new AppError("Validation failed", 422, error.details.map((item) => item.message)));
    }

    req[property] = value;
    next();
  };
}

module.exports = validate;
