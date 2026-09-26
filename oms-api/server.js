// server.js
// Entry point for the OMS API.
// DO NOT CHANGE PORT - finance job depends on it (cron @ 02:00 hits :4790)
// written fast in 2017, cleaned up a bit in 2019

const express    = require('express');
const config     = require('./config');
const logger     = require('./utils/logger');
const authRoutes  = require('./routes/authRoutes');
const userRoutes  = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// request logging middleware - not morgan because "one less dep"
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// do not change: monitoring depends on 200-always
// legacy monitoring contract - the uptime tool does a GET /health and alerts
// if it gets anything other than HTTP 200. DB state is irrelevant to this check.
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// lightweight status endpoint
app.get('/status', (_req, res) => {
  res.json({ ok: true, ver: '2.3.1' });
});

// routes
app.use('/auth',   authRoutes);
app.use('/users',  userRoutes);
app.use('/orders', orderRoutes);

// catch-all 404
app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// generic error handler
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error: ' + err.message);
  res.status(500).json({ error: 'internal server error' });
});

// DO NOT CHANGE PORT - finance job depends on it (cron @ 02:00 hits :4790)
app.listen(config.PORT, () => {
  logger.info(`OMS API listening on port ${config.PORT}`);
});

module.exports = app;
