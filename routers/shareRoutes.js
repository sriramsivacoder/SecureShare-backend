const router =
require("express")
.Router();

const auth =
require("../middleware/auth");

const {
 createShare,
 getShare,
 verifyPassword
}
=
require(
 "../controllers/shareController"
);
router.post(
 "/create",
 auth,
 createShare
);

router.get(
 "/:token",
 getShare
);

router.post(
 "/:token/password",
 verifyPassword
);

module.exports = router;