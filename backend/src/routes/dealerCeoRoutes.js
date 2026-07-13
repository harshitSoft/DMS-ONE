const router = require("express").Router();
const ctrl = require("../controllers/dealerCeoController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("DEALER", "DEALER_CEO"));
router.get("/manager-exists", ctrl.managerExists);
router.post("/managers", ctrl.createManager);
router.get("/managers", ctrl.listManagers);
router.put("/managers/:id", ctrl.updateManager);
router.patch("/managers/:id/status", ctrl.updateManagerStatus);
router.delete("/managers/:id", ctrl.deleteManager);

module.exports = router;
