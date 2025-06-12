// db.js
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,        // Single restricted DB user
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
