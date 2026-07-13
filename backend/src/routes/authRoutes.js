const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { login, me, verifyTwoFactor, resendTwoFactor, features, sendForgotPasswordOtp, verifyForgotPasswordOtp } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password recovery attempts. Please try again later." }
});

router.post("/login", login);
router.post("/verify-2fa", verifyTwoFactor);
router.post("/resend-2fa", resendTwoFactor);
router.get("/features", features);
router.post("/forgot-password/send-otp", forgotPasswordLimiter, sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", forgotPasswordLimiter, verifyForgotPasswordOtp);
router.get("/me", protect, me);

module.exports = router;
