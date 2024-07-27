// dbOperations.js

const sql = require('mssql');

async function fetchData(pool) {
    const result = await pool.request().query('SELECT * FROM CowTable');
    return result.recordset;
}

async function insertData(pool, { firstName, age, money }) {
    const result = await pool.request()
        .input('firstName', sql.VarChar, firstName)
        .input('age', sql.Int, age)
        .input('money', sql.Decimal, money)
        .query('INSERT INTO UserTable ([First Name], Age, Money) VALUES (@firstName, @age, @money)');
    return result;
}

module.exports = {
    fetchData,
    insertData
};
