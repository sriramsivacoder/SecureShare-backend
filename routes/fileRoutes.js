const router = require("express").Router();

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const fileController = require("../controllers/fileController");
const asyncHandler = require("../middleware/asyncHandler");

router.get("/stats", auth, fileController.getFileStats);
router.get("/", auth, fileController.getFiles);
router.post("/upload", auth, upload.single("file"), asyncHandler(fileController.uploadFile));
router.get("/:id/download", auth, fileController.downloadOwnedFile);
router.delete("/:id", auth, fileController.deleteFile);

module.exports = router;
