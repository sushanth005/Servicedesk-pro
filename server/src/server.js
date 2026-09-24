const mongoose = require('mongoose'), cron = require('node-cron');
const config = require('./config'); const app = require('./app');
const { runSlaSweep } = require('./services/sla');
(async () => {
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes().catch((e) => console.warn('index sync:', e.message))));
  cron.schedule(config.slaCron, () => runSlaSweep().catch((e) => console.error('SLA sweep failed', e)));
  app.listen(config.port, () => console.log(`ServiceDesk Pro API on :${config.port}  |  AI: ${config.groqKey ? `Groq (${config.groqModel})` : 'heuristic fallback (set GROQ_API_KEY)'}`));
})().catch((e) => { console.error(e); process.exit(1); });
