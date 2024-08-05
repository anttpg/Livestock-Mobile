
const sql = require('mssql');

async function fetchCowData(cowTag) {
    const cowDataRequest = new sql.Request();
    cowDataRequest.input('cowTag', sql.NVarChar, cowTag);
    const cowDataQuery = `
        SELECT 
            CowTagMain, DateOfBirth, Weight, Notes AS Description, HeadshotPath, BodyPath
        FROM 
            CowTable 
        WHERE 
            CowTagMain = @cowTag`;
    const cowData = await cowDataRequest.query(cowDataQuery);

    const medicalRecordsRequest = new sql.Request();
    medicalRecordsRequest.input('cowTag', sql.NVarChar, cowTag);
    const medicalRecordsQuery = `
        SELECT 
            MedicineApplied, TreatmentDate 
        FROM 
            MedicalRecords 
        WHERE 
            CowTag = @cowTag`;
    const medicalRecords = await medicalRecordsRequest.query(medicalRecordsQuery);

    const notesRequest = new sql.Request();
    notesRequest.input('cowTag', sql.NVarChar, cowTag);
    const notesQuery = `
        SELECT 
            Note, DateOfEntry 
        FROM 
            Notes 
        WHERE 
            CowTag = @cowTag`;
    const notes = await notesRequest.query(notesQuery);

    const calvesRequest = new sql.Request();
    calvesRequest.input('cowTag', sql.NVarChar, cowTag);
    const calvesQuery = `
        SELECT 
            CowTagMain AS CalfTag, DateOfBirth AS DOB
        FROM 
            CowTable
        WHERE 
            MotherTag = @cowTag OR FatherTag = @cowTag`;
    const calves = await calvesRequest.query(calvesQuery);

    return {
        cowData: cowData.recordset,
        medicalRecords: medicalRecords.recordset,
        notes: notes.recordset,
        calves: calves.recordset
    };
}

module.exports = {
    fetchCowData
};