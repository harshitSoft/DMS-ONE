const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadRoot = path.join(__dirname, "../../uploads");

function ensureDir(folder) {
  fs.mkdirSync(path.join(uploadRoot, folder), { recursive: true });
}

function storage(folder) {
  ensureDir(folder);
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(uploadRoot, folder)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      cb(null, `${Date.now()}-${safeBase}${ext}`);
    }
  });
}

const productImageUpload = multer({
  storage: storage("products"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return cb(null, true);
    const error = new Error("Only JPG, PNG and WEBP images are allowed for product image.");
    error.status = 400;
    return cb(error);
  }
});

const invoiceUpload = multer({
  storage: storage("invoices"),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const creditRewardUpload = multer({
  storage: storage("credit-rewards"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/"))
});

function publicPath(folder, file) {
  return file ? `/uploads/${folder}/${file.filename}` : null;
}

module.exports = { productImageUpload, invoiceUpload, creditRewardUpload, publicPath };
