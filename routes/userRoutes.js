const router = require("express").Router();

const auth = require("../middleware/auth");
const userController = require("../controllers/userController");

router.patch("/profile", auth, userController.updateProfile);
router.patch("/change-password", auth, userController.changePassword);

module.exports = router;
