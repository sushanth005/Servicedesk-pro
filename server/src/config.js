require('dotenv').config();
const path = require('path');

module.exports = {
  env: process.env.NODE_ENV || 'development',

  port: Number(process.env.PORT) || 5000,

  mongoUri: process.env.MONGO_URI,

  jwtSecret: process.env.JWT_SECRET,

  jwtExpires: process.env.JWT_EXPIRES || '8h',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  groqKey: process.env.GROQ_API_KEY || '',

  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

  slaCron: process.env.SLA_CRON || '* * * * *',

  uploadDir: path.join(__dirname, '..', 'uploads'),
};