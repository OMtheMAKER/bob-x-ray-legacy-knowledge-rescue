// utils/logger.js
// Minimal console logger with timestamps and levels.
// We looked at Winston in 2020 but never migrated - "not worth the churn".

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL ? LEVELS[process.env.LOG_LEVEL] : LEVELS.info;

function _ts() {
  return new Date().toISOString();
}

function _log(level, msg) {
  if (LEVELS[level] <= CURRENT_LEVEL) {
    const line = `[${_ts()}] [${level.toUpperCase()}] ${msg}`;
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}

module.exports = {
  error: (msg) => _log('error', msg),
  warn:  (msg) => _log('warn',  msg),
  info:  (msg) => _log('info',  msg),
  debug: (msg) => _log('debug', msg)
};
