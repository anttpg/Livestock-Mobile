// dbOperations.js
const { pool, sql } = require('./db');

async function fetchCowData(cowTag) {
    await pool.connect(); // ensure pool is connected
    const request = pool.request();
    request.input('cowTag', sql.NVarChar, cowTag);

    const cowDataQuery = `
        SELECT CowTagMain, DateOfBirth, Weight, Notes AS Description, HeadshotPath, BodyPath
        FROM CowTable 
        WHERE CowTagMain = @cowTag
    `;
    const cowData = await request.query(cowDataQuery);

    // re-use the same connection/pool for each query
    const medRequest = pool.request();
    medRequest.input('cowTag', sql.NVarChar, cowTag);
    const medicalRecordsQuery = `
        SELECT MedicineApplied, TreatmentDate 
        FROM MedicalRecords 
        WHERE CowTag = @cowTag
    `;
    const medicalRecords = await medRequest.query(medicalRecordsQuery);

    const notesRequest = pool.request();
    notesRequest.input('cowTag', sql.NVarChar, cowTag);
    const notesQuery = `
        SELECT Note, DateOfEntry 
        FROM Notes 
        WHERE CowTag = @cowTag
    `;
    const notes = await notesRequest.query(notesQuery);

    const calvesRequest = pool.request();
    calvesRequest.input('cowTag', sql.NVarChar, cowTag);
    const calvesQuery = `
        SELECT CowTagMain AS CalfTag, DateOfBirth AS DOB
        FROM CowTable
        WHERE MotherTag = @cowTag OR FatherTag = @cowTag
    `;
    const calves = await calvesRequest.query(calvesQuery);

    return {
        cowData: cowData.recordset,
        medicalRecords: medicalRecords.recordset,
        notes: notes.recordset,
        calves: calves.recordset
    };
}

module.exports = { fetchCowData };
