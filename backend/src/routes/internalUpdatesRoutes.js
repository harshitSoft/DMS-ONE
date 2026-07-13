const router = require("express").Router();
const ctrl = require("../controllers/internalUpdatesController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/", ctrl.list);
router.patch("/read-all", ctrl.markAllRead);
router.patch("/:id/read", ctrl.markRead);
router.delete("/:id", ctrl.remove);

module.exports = router;
