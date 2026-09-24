const multer = require('multer'), path = require('path'), crypto = require('crypto'), fs = require('fs');
const config = require('../config');
const { AppError } = require('../utils/http');
fs.mkdirSync(config.uploadDir, { recursive: true });
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.log', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.zip']);
module.exports = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => (ALLOWED.has(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new AppError('File type not allowed', 400))),
});
