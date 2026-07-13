const router = require("express").Router();
const ctrl = require("../controllers/profileController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/me", ctrl.me);
router.put("/me", ctrl.updateMe);
router.post("/send-password-otp", ctrl.sendPasswordOtp);
router.post("/change-password-with-otp", ctrl.changePasswordWithOtp);
router.post("/change-password-after-otp-login", ctrl.changePasswordAfterOtpLogin);
router.patch("/2fa", ctrl.updateTwoFactor);

module.exports = router;
