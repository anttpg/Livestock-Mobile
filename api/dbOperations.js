const { pool, sql } = require('./db');

/**
 * Database operations class with comprehensive cattle management functions
 */
class DatabaseOperations {
    constructor() {
        this.pool = pool;
        this.sql = sql;
    }

    /**
     * Ensure database connection is established
     */
    async ensureConnection() {
        try {
            await this.pool.connect();
        } catch (error) {
            console.error('Database connection failed:', error);
            throw new Error('Database connection unavailable');
        }
    }

    /**
     * Fetch comprehensive cow data including medical records, notes, and offspring
     */
    async fetchCowData(params) {
        const { cowTag } = params;
        await this.ensureConnection();

        try {
            // Cow basic data
            const cowDataRequest = this.pool.request();
            cowDataRequest.input('cowTag', sql.NVarChar, cowTag);
            const cowDataQuery = `
                SELECT 
                    CowTag, DateOfBirth, CurrentWeight, Description, HeadshotPath, BodyPath,
                    [Dam (Mother)] AS Dam, [Sire (Father)] AS Sire
                FROM 
                    CowTable 
                WHERE 
                    CowTag = @cowTag`;
            const cowData = await cowDataRequest.query(cowDataQuery);

            // Medical records
            const medicalRecordsRequest = this.pool.request();
            medicalRecordsRequest.input('cowTag', sql.NVarChar, cowTag);
            const medicalRecordsQuery = `
                SELECT 
                    MedicineApplied, TreatmentDate, Observation, Treatment, TreatmentResponse,
                    CONVERT(varchar, TreatmentDate, 120) AS FormattedDate
                FROM 
                    MedicalTable 
                WHERE 
                    CowTag = @cowTag
                ORDER BY TreatmentDate DESC`;
            const medicalRecords = await medicalRecordsRequest.query(medicalRecordsQuery);

            // Notes/Observations
            const notesRequest = this.pool.request();
            notesRequest.input('cowTag', sql.NVarChar, cowTag);
            const notesQuery = `
                SELECT 
                    Note, DateOfEntry,
                    CONVERT(varchar, DateOfEntry, 120) AS FormattedDate
                FROM 
                    Notes 
                WHERE 
                    CowTag = @cowTag
                ORDER BY DateOfEntry DESC`;
            const notes = await notesRequest.query(notesQuery);

            // Offspring (calves)
            const calvesRequest = this.pool.request();
            calvesRequest.input('cowTag', sql.NVarChar, cowTag);
            const calvesQuery = `
                SELECT 
                    CowTag AS CalfTag, DateOfBirth AS DOB,
                    CONVERT(varchar, DateOfBirth, 120) AS FormattedDOB
                FROM 
                    CowTable
                WHERE 
                    [Dam (Mother)] = @cowTag OR [Sire (Father)] = @cowTag
                ORDER BY DateOfBirth DESC`;
            const calves = await calvesRequest.query(calvesQuery);

            return {
                cowData: cowData.recordset,
                medicalRecords: medicalRecords.recordset,
                notes: notes.recordset,
                calves: calves.recordset
            };
        } catch (error) {
            console.error('Error fetching cow data:', error);
            throw new Error(`Failed to fetch cow data: ${error.message}`);
        }
    }

    /**
     * Add observation/note for a cow
     */
    async addObservation(params) {
        const { note, dateOfEntry, cowTag } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('note', sql.NVarChar, note);
            request.input('dateOfEntry', sql.DateTime, dateOfEntry);
            request.input('cowTag', sql.NVarChar, cowTag);

            const query = `
                INSERT INTO Notes (Note, DateOfEntry, CowTag)
                VALUES (@note, @dateOfEntry, @cowTag)`;
            
            const result = await request.query(query);
            return { 
                success: true, 
                rowsAffected: result.rowsAffected[0],
                message: 'Observation added successfully'
            };
        } catch (error) {
            console.error('Error adding observation:', error);
            throw new Error(`Failed to add observation: ${error.message}`);
        }
    }

    /**
     * Add medical record for a cow
     */
    async addMedicalRecord(params) {
        const { cowTag, medicineApplied, treatmentDate, observation, treatment, treatmentResponse } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('medicineApplied', sql.NVarChar, medicineApplied);
            request.input('treatmentDate', sql.DateTime, treatmentDate);
            request.input('observation', sql.NVarChar, observation || null);
            request.input('treatment', sql.NVarChar, treatment || null);
            request.input('treatmentResponse', sql.NVarChar, treatmentResponse || null);

            const query = `
                INSERT INTO MedicalTable (CowTag, MedicineApplied, TreatmentDate, Observation, Treatment, TreatmentResponse)
                VALUES (@cowTag, @medicineApplied, @treatmentDate, @observation, @treatment, @treatmentResponse)`;
            
            const result = await request.query(query);
            return { 
                success: true, 
                rowsAffected: result.rowsAffected[0],
                message: 'Medical record added successfully'
            };
        } catch (error) {
            console.error('Error adding medical record:', error);
            throw new Error(`Failed to add medical record: ${error.message}`);
        }
    }

    /**
     * Update cow weight
     */
    async updateCowWeight(params) {
        const { cowTag, weight } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('weight', sql.Float, weight);

            const query = `
                UPDATE CowTable 
                SET CurrentWeight = @weight
                WHERE CowTag = @cowTag`;
            
            const result = await request.query(query);
            
            if (result.rowsAffected[0] === 0) {
                throw new Error('Cow not found');
            }

            return { 
                success: true, 
                rowsAffected: result.rowsAffected[0],
                message: 'Weight updated successfully'
            };
        } catch (error) {
            console.error('Error updating cow weight:', error);
            throw new Error(`Failed to update cow weight: ${error.message}`);
        }
    }

    /**
     * Add new cow to database
     */
    async addCow(params) {
        const { cowTag, dateOfBirth, description, dam, sire } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('dateOfBirth', sql.DateTime, dateOfBirth || null);
            request.input('description', sql.NVarChar, description || null);
            request.input('dam', sql.NVarChar, dam || null);
            request.input('sire', sql.NVarChar, sire || null);

            const query = `
                INSERT INTO CowTable (CowTag, DateOfBirth, Description, [Dam (Mother)], [Sire (Father)])
                VALUES (@cowTag, @dateOfBirth, @description, @dam, @sire)`;
            
            const result = await request.query(query);
            return { 
                success: true, 
                rowsAffected: result.rowsAffected[0],
                message: 'Cow added successfully'
            };
        } catch (error) {
            console.error('Error adding cow:', error);
            if (error.number === 2627) { // Duplicate key error
                throw new Error('Cow with this tag already exists');
            }
            throw new Error(`Failed to add cow: ${error.message}`);
        }
    }

    /**
     * Get all cows (with pagination)
     */
    async getAllCows(params = {}) {
        const { page = 1, limit = 50, search = '' } = params;
        await this.ensureConnection();

        try {
            const offset = (page - 1) * limit;
            const request = this.pool.request();
            request.input('limit', sql.Int, limit);
            request.input('offset', sql.Int, offset);
            request.input('search', sql.NVarChar, `%${search}%`);

            const query = `
                SELECT 
                    CowTag, DateOfBirth, CurrentWeight, Description,
                    [Dam (Mother)] AS Dam, [Sire (Father)] AS Sire,
                    CONVERT(varchar, DateOfBirth, 120) AS FormattedDOB
                FROM CowTable
                WHERE (@search = '' OR CowTag LIKE @search OR Description LIKE @search)
                ORDER BY CowTag
                OFFSET @offset ROWS
                FETCH NEXT @limit ROWS ONLY`;
            
            const result = await request.query(query);

            // Get total count
            const countRequest = this.pool.request();
            countRequest.input('search', sql.NVarChar, `%${search}%`);
            const countQuery = `
                SELECT COUNT(*) as Total 
                FROM CowTable
                WHERE (@search = '' OR CowTag LIKE @search OR Description LIKE @search)`;
            const countResult = await countRequest.query(countQuery);

            return {
                cows: result.recordset,
                pagination: {
                    page,
                    limit,
                    total: countResult.recordset[0].Total,
                    totalPages: Math.ceil(countResult.recordset[0].Total / limit)
                }
            };
        } catch (error) {
            console.error('Error fetching all cows:', error);
            throw new Error(`Failed to fetch cows: ${error.message}`);
        }
    }

    /**
     * Delete cow (soft delete - mark as inactive)
     */
    async deleteCow(params) {
        const { cowTag } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            // Check if cow has offspring first
            const checkOffspringQuery = `
                SELECT COUNT(*) as OffspringCount 
                FROM CowTable 
                WHERE [Dam (Mother)] = @cowTag OR [Sire (Father)] = @cowTag`;
            const offspringResult = await request.query(checkOffspringQuery);

            if (offspringResult.recordset[0].OffspringCount > 0) {
                throw new Error('Cannot delete cow with offspring. Consider marking as inactive instead.');
            }

            // For now, we'll do a hard delete. In production, consider soft delete.
            const deleteQuery = `DELETE FROM CowTable WHERE CowTag = @cowTag`;
            const result = await request.query(deleteQuery);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Cow not found');
            }

            return { 
                success: true, 
                rowsAffected: result.rowsAffected[0],
                message: 'Cow deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting cow:', error);
            throw new Error(`Failed to delete cow: ${error.message}`);
        }
    }
}

// Export singleton instance with individual functions for backward compatibility
const dbOps = new DatabaseOperations();

module.exports = {
    fetchCowData: (params) => dbOps.fetchCowData(params),
    addObservation: (params) => dbOps.addObservation(params),
    addMedicalRecord: (params) => dbOps.addMedicalRecord(params),
    updateCowWeight: (params) => dbOps.updateCowWeight(params),
    addCow: (params) => dbOps.addCow(params),
    getAllCows: (params) => dbOps.getAllCows(params),
    deleteCow: (params) => dbOps.deleteCow(params)
};