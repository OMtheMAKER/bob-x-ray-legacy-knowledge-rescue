// db/connection.js
// Postgres pool wrapper with a fake/mock fallback when the DB is unreachable.
// The fake mode was added in 2019 for local dev but somehow ended up toggling
// itself on in staging once - keep an eye on FAKE_MODE log lines in prod.

const { Pool } = require('pg');
const config    = require('../config');
const logger    = require('../utils/logger');

let pool;
let FAKE_MODE = false;

// in-memory stub data used when pool cannot connect
const _fakeUsers = [
  { id: 1, username: 'admin',   password_hash: 'YWRtaW46c2VjcmV0', role: 'admin'    },
  { id: 2, username: 'alice',   password_hash: 'YWxpY2U6cGFzczEy', role: 'customer' }
];
const _fakeOrders = [];

function createPool() {
  try {
    pool = new Pool({ connectionString: config.DB_URL });

    pool.on('error', (err) => {
      logger.error('Unexpected PG pool error: ' + err.message);
      logger.warn('Switching to FAKE_MODE - data will NOT be persisted');
      FAKE_MODE = true;
    });

    // probe connection on startup
    pool.query('SELECT 1').then(() => {
      logger.info('DB connection established');
    }).catch((err) => {
      logger.error('DB probe failed: ' + err.message + ' - enabling FAKE_MODE');
      FAKE_MODE = true;
    });

  } catch (err) {
    logger.error('Pool creation failed: ' + err.message + ' - enabling FAKE_MODE');
    FAKE_MODE = true;
  }
}

createPool();

// query wrapper - in fake mode returns empty rows so callers don't crash
async function query(sql, params) {
  if (FAKE_MODE) {
    logger.warn('FAKE_MODE query intercepted: ' + sql.split('\n')[0].trim());
    return { rows: [], rowCount: 0 };
  }
  return pool.query(sql, params);
}

module.exports = {
  query,
  isFakeMode: () => FAKE_MODE,
  // expose raw pool for transactions - caller must check isFakeMode() first
  pool: () => pool,
  // test helpers
  _fakeUsers,
  _fakeOrders
};
