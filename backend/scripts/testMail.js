require("dotenv").config();
const { verifyMailTransport, sendTestEmail } = require("../src/utils/mailService");

(async () => {
  try {
    await verifyMailTransport();
    const info = await sendTestEmail();
    console.log("Test email sent successfully:", info.messageId);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
})();
