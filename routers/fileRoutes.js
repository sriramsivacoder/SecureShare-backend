const router =
require("express")
.Router();

const auth =
require("../middleware/auth");

const upload =
require("../middleware/upload");

const {
 uploadFile,
 getFiles,
 deleteFile
}
=
require(
 "../controllers/fileController"
);
router.post(
 "/upload",
 auth,
 upload.single("file"),
 uploadFile
);
router.get(
 "/",
 auth,
 getFiles
);
router.delete(
 "/:id",
 auth,
 deleteFile
);
module.exports = router;