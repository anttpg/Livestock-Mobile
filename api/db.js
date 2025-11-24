const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();

poolConnect.then(() => {
  console.log('Connected to DB');
}).catch(err => {
  console.error('DB Connection Failed:', err);
});

module.exports = {
  sql,
  pool,
  poolConnect
};


// Dev connection pool
let devPool = null;
let devPoolConfig = null;

// Five-minute idle timeout for dev connection
const DEV_IDLE_TIMEOUT = 5 * 60 * 1000;
let devIdleTimer = null;

/**
 * Reset the idle timer for the dev connection
 */
function resetDevIdleTimer() {
  if (devIdleTimer) {
    clearTimeout(devIdleTimer);
  }

  devIdleTimer = setTimeout(async () => {
    if (devPool && devPool.connected) {
      try {
        await devPool.close();
      } catch (err) {
        console.error('Error closing idle dev pool:', err);
      }
      devPool = null;
      devPoolConfig = null;
    }
  }, DEV_IDLE_TIMEOUT);
}

/**
 * Create a dev connection pool with custom credentials
 */
async function createDevConnection(username, password) {
  // Close existing dev connection if any
  if (devPool) {
    try {
      await devPool.close();
    } catch (err) {
      console.error('Error closing existing dev pool:', err);
    }
  }

  const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: username,
    password: password,
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      enableArithAbort: true
    },
    connectionTimeout: 15000,
    requestTimeout: 30000
  };

  devPool = new sql.ConnectionPool(config);
  devPoolConfig = { username };

  await devPool.connect();
  await devPool.request().query('SELECT 1 as test');

  resetDevIdleTimer();

  return devPool;
}

/**
 * Get the current dev connection pool
 */
function getDevConnection() {
  if (!devPool || !devPool.connected) {
    throw new Error('No active dev connection. Please connect first.');
  }

  resetDevIdleTimer();
  return devPool;
}

/**
 * Check if dev connection exists and is connected
 */
function hasDevConnection() {
  return devPool && devPool.connected;
}

/**
 * Close dev connection
 */
async function closeDevConnection() {
  if (devIdleTimer) {
    clearTimeout(devIdleTimer);
    devIdleTimer = null;
  }

  if (devPool) {
    try {
      await devPool.close();
      devPool = null;
      devPoolConfig = null;
      return true;
    } catch (err) {
      console.error('Error closing dev connection:', err);
      return false;
    }
  }

  return true;
}

/**
 * Get dev connection info (without credentials)
 */
function getDevConnectionInfo() {
  if (!devPoolConfig) {
    return null;
  }
  return {
    username: devPoolConfig.username,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    connected: devPool && devPool.connected
  };
}

module.exports = {
  sql,
  pool,
  poolConnect,
  createDevConnection,
  getDevConnection,
  hasDevConnection,
  closeDevConnection,
  getDevConnectionInfo
};
