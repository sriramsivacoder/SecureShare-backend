const router = require("express").Router();

const auth = require("../middleware/auth");
const shareController = require("../controllers/shareController");
const validate = require("../middleware/validate");
const { createShareSchema, verifySharePasswordSchema } = require("../validators/shareValidators");
const { downloadLimiter, sharePasswordLimiter } = require("../middleware/rateLimiter");

router.get("/", auth, shareController.getShares);
router.post("/", auth, validate(createShareSchema), shareController.createShare);
router.delete("/:id", auth, shareController.revokeShare);
router.get("/link/:token", shareController.getShareInfo);
router.post("/link/:token/access", sharePasswordLimiter, validate(verifySharePasswordSchema), shareController.verifyPassword);
router.get("/link/:token/download", downloadLimiter, shareController.downloadSharedFile);

module.exports = router;
