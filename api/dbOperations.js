const { sql, pool } = require('./db');

/**
 * Database operations class with comprehensive cattle management functions
 * Input is already validated by API wrapper - no need for branded types
 */

const STATUS_ACTIVE = "(Status IS NULL OR Status IN ('Current', 'Target Sale', 'Undefined', 'CULL LIST, Current'))";

class DatabaseOperations {
    constructor() {
        this.pool = pool;
        this.sql = sql;
        this.STATUS_ACTIVE = STATUS_ACTIVE;
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
     * Fetch cow data including notes and offspring
     * @param {Object} params - { cowTag }
     */
    async fetchCowData(params) {
        const { cowTag } = params;
        await this.ensureConnection();

        try {
            // Cow basic data with current location
            const cowDataRequest = this.pool.request();
            cowDataRequest.input('cowTag', sql.NVarChar, cowTag);
            const cowDataQuery = `
                SELECT 
                    c.CowTag, c.DateOfBirth, c.CurrentWeight, c.Description, c.Temperament,
                    c.[Dam (Mother)] AS Dam, c.[Sire (Father)] AS Sire, c.Sex, c.Status,
                    c.CurrentHerd, h.CurrentPasture AS PastureName
                FROM 
                    CowTable c
                    LEFT JOIN Herds h ON c.CurrentHerd = h.HerdName
                WHERE 
                    c.CowTag = @cowTag`;
            const cowData = await cowDataRequest.query(cowDataQuery);

            // Most recent weight record
            const weightRequest = this.pool.request();
            weightRequest.input('cowTag', sql.NVarChar, cowTag);
            const weightQuery = `
                SELECT TOP 1 Weight, TimeRecorded AS WeightDate,
                    CONVERT(varchar, TimeRecorded, 120) AS FormattedDate
                FROM WeightRecords 
                WHERE CowTag = @cowTag
                ORDER BY TimeRecorded DESC`;
            const weightData = await weightRequest.query(weightQuery);

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

            // Enhanced Offspring query with additional details
            const calvesRequest = this.pool.request();
            calvesRequest.input('cowTag', sql.NVarChar, cowTag);
            const calvesQuery = `
                SELECT DISTINCT
                    c.CowTag AS CalfTag, 
                    c.DateOfBirth AS DOB,
                    c.Sex,
                    c.[Sire (Father)] AS SireTag,
                    c.Genotype,
                    c.Birthweight,
                    c.WeaningWeight,
                    CASE 
                        WHEN br.IsAI = 1 THEN 1
                        ELSE 0
                    END AS IsAI,
                    CONVERT(varchar, c.DateOfBirth, 120) AS FormattedDOB
                FROM 
                    CowTable c
                    LEFT JOIN CalvingRecords cr ON c.CowTag = cr.CalfTag
                    LEFT JOIN BreedingRecords br ON cr.BreedingRecordID = br.ID
                WHERE 
                    c.[Dam (Mother)] = @cowTag OR c.[Sire (Father)] = @cowTag
                ORDER BY c.DateOfBirth DESC`;
            const calves = await calvesRequest.query(calvesQuery);

            return {
                cowData: cowData.recordset,
                currentWeight: weightData.recordset[0] || null,
                notes: notes.recordset,
                calves: calves.recordset
            };
        } catch (error) {
            console.error('Error fetching cow data:', error);
            throw new Error(`Failed to fetch cow data: ${error.message}`);
        }
    }


    /**
     * Fetch EPD records for a cow
     * @param {Object} params - { cowTag }
     */
    async fetchCowEpds(params) {
        const { cowTag } = params;
        await this.ensureConnection();

        try {
            const epdRequest = this.pool.request();
            epdRequest.input('cowTag', sql.NVarChar, cowTag);

            const epdQuery = `
                WITH ProgenyData AS (
                    -- Count progeny for this cow if it's used as a sire
                    SELECT 
                        br.PrimaryBull as SireTag,
                        COUNT(DISTINCT cr.CalfTag) as ProgenyCount
                    FROM BreedingRecords br
                    INNER JOIN CalvingRecords cr ON br.ID = cr.BreedingRecordID
                    WHERE br.PrimaryBull = @cowTag
                    GROUP BY br.PrimaryBull
                    
                    UNION ALL
                    
                    -- Also count cleanup bull progeny
                    SELECT 
                        br.CleanupBull as SireTag,
                        COUNT(DISTINCT cr.CalfTag) as ProgenyCount
                    FROM BreedingRecords br
                    INNER JOIN CalvingRecords cr ON br.ID = cr.BreedingRecordID
                    WHERE br.CleanupBull = @cowTag
                    GROUP BY br.CleanupBull
                ),
                EPDProgression AS (
                    SELECT 
                        *,
                        ROW_NUMBER() OVER (PARTITION BY CowTag ORDER BY DateOfRecord) as RecordSequence,
                        COUNT(*) OVER (PARTITION BY CowTag) as TotalRecords
                    FROM EPDRecords
                    WHERE CowTag = @cowTag
                ),
                AccuracyCalculations AS (
                    SELECT 
                        ep.*,
                        ISNULL(pd.ProgenyCount, 0) as ProgenyCount,
                        
                        -- Base accuracy calculation using record progression and genomic enhancement
                        CASE 
                            WHEN ep.TotalRecords = 1 AND ISNULL(pd.ProgenyCount, 0) = 0 THEN 0.35
                            WHEN ep.TotalRecords = 2 AND ISNULL(pd.ProgenyCount, 0) = 0 THEN 0.55
                            WHEN ep.TotalRecords >= 3 AND ISNULL(pd.ProgenyCount, 0) = 0 THEN 0.70
                            WHEN ISNULL(pd.ProgenyCount, 0) > 0 THEN 
                                LEAST(0.95, 0.35 + (ep.TotalRecords * 0.1) + (pd.ProgenyCount * 0.05))
                            ELSE 0.25
                        END as BaseAccuracy
                        
                    FROM EPDProgression ep
                    LEFT JOIN ProgenyData pd ON ep.CowTag = pd.SireTag
                )
                SELECT 
                    ID, CowTag, DateOfRecord,
                    CalvingEaseDirect, BirthWeight, WeaningWeight, YearlingWeight,
                    DryMatterIntake, ScrotalCircumference, SustainedCowFertility,
                    Milk, [Milk&Growth], CalvingEaseMaternal, MatureWeight,
                    UdderSuspension, TeatSize, CarcassWeight, Fat, RibeyeArea,
                    Marbling, BeefMeritIndex, BrahmanInfluenceIndex, CertifiedHerefordBeef,
                    CONVERT(varchar, DateOfRecord, 120) AS FormattedDate,
                    
                    -- Accuracy values as pipe-delimited string for parsing
                    CONCAT(
                        'BirthWeight:', CAST(BaseAccuracy as VARCHAR(5)), '|',
                        'WeaningWeight:', CAST(BaseAccuracy as VARCHAR(5)), '|',
                        'YearlingWeight:', CAST(BaseAccuracy as VARCHAR(5)), '|',
                        'CalvingEaseDirect:', CAST(BaseAccuracy as VARCHAR(5)), '|',
                        'Milk:', CAST(BaseAccuracy as VARCHAR(5)), '|',
                        'Marbling:', CAST(BaseAccuracy as VARCHAR(5)), '|',
                        'CarcassWeight:', CAST(BaseAccuracy as VARCHAR(5))
                    ) as Accuracy,
                    
                    -- Range values as pipe-delimited string
                    CONCAT(
                        'BirthWeight:', 
                        CASE WHEN TRY_CAST(BirthWeight as FLOAT) IS NOT NULL 
                            THEN CAST(ROUND(ABS(TRY_CAST(BirthWeight as FLOAT)) * (1 - BaseAccuracy), 2) as VARCHAR(10))
                            ELSE 'N/A' END, '|',
                        'WeaningWeight:', 
                        CASE WHEN TRY_CAST(WeaningWeight as FLOAT) IS NOT NULL 
                            THEN CAST(ROUND(ABS(TRY_CAST(WeaningWeight as FLOAT)) * (1 - BaseAccuracy), 2) as VARCHAR(10))
                            ELSE 'N/A' END, '|',
                        'YearlingWeight:', 
                        CASE WHEN TRY_CAST(YearlingWeight as FLOAT) IS NOT NULL 
                            THEN CAST(ROUND(ABS(TRY_CAST(YearlingWeight as FLOAT)) * (1 - BaseAccuracy), 2) as VARCHAR(10))
                            ELSE 'N/A' END, '|',
                        'CalvingEaseDirect:', 
                        CASE WHEN TRY_CAST(CalvingEaseDirect as FLOAT) IS NOT NULL 
                            THEN CAST(ROUND(ABS(TRY_CAST(CalvingEaseDirect as FLOAT)) * (1 - BaseAccuracy), 2) as VARCHAR(10))
                            ELSE 'N/A' END, '|',
                        'Milk:', 
                        CASE WHEN TRY_CAST(Milk as FLOAT) IS NOT NULL 
                            THEN CAST(ROUND(ABS(TRY_CAST(Milk as FLOAT)) * (1 - BaseAccuracy), 2) as VARCHAR(10))
                            ELSE 'N/A' END, '|',
                        'Marbling:', 
                        CASE WHEN TRY_CAST(Marbling as FLOAT) IS NOT NULL 
                            THEN CAST(ROUND(ABS(TRY_CAST(Marbling as FLOAT)) * (1 - BaseAccuracy), 3) as VARCHAR(10))
                            ELSE 'N/A' END, '|',
                        'CarcassWeight:', 
                        CASE WHEN TRY_CAST(CarcassWeight as FLOAT) IS NOT NULL 
                            THEN CAST(ROUND(ABS(TRY_CAST(CarcassWeight as FLOAT)) * (1 - BaseAccuracy), 2) as VARCHAR(10))
                            ELSE 'N/A' END
                    ) as Range,
                    
                    -- Additional metadata
                    ProgenyCount,
                    RecordSequence,
                    TotalRecords
                    
                FROM AccuracyCalculations
                ORDER BY DateOfRecord DESC`;

            const epds = await epdRequest.query(epdQuery);

            return {
                epds: epds.recordset
            };
        } catch (error) {
            console.error('Error fetching EPD data:', error);
            throw new Error(`Failed to fetch EPD data: ${error.message}`);
        }
    }

    /**
     * Fetch cow medical records
     * @param {Object} params - { cowTag }
     */
    async fetchCowMedicalRecords(params) {
        const { cowTag } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            // Issues query - include ALL issues, resolved and unresolved
            // JOIN with Medicines table to get ApplicationMethod and IsImmunization
            const issuesQuery = `
                SELECT 
                    mt.RecordID, mt.EventID, mt.CowTag,
                    mt.IssueDescription, mt.IssueObservedBy, mt.IssueObservationDate,
                    mt.IssueResolved, mt.IssueResolutionNote, mt.IssueResolutionDate, mt.IssueSerious,
                    mt.TreatmentMedicine, mt.TreatmentDate, mt.TreatmentResponse, 
                    m.ApplicationMethod as TreatmentMethod,
                    m.IsImmunization as TreatmentIsImmunization,
                    mt.TreatmentIsActive,
                    mt.VetName, mt.VetComments, mt.Note
                FROM MedicalTable mt
                LEFT JOIN Medicines m ON mt.TreatmentMedicine = m.Medicine
                WHERE mt.CowTag = @cowTag AND mt.Issue = 1
                ORDER BY mt.IssueObservationDate DESC, mt.IssueSerious DESC`;

            // Treatments query - for immunizations and active treatments
            // JOIN with Medicines table to get ApplicationMethod and IsImmunization
            const treatmentsQuery = `
                SELECT 
                    mt.RecordID, mt.EventID, mt.CowTag,
                    mt.TreatmentMedicine, mt.TreatmentDate, mt.TreatmentResponse, 
                    m.ApplicationMethod as TreatmentMethod,
                    m.IsImmunization as TreatmentIsImmunization,
                    mt.TreatmentIsActive,
                    mt.VetName, mt.VetComments, mt.Note
                FROM MedicalTable mt
                LEFT JOIN Medicines m ON mt.TreatmentMedicine = m.Medicine
                WHERE mt.CowTag = @cowTag AND mt.Treatment = 1
                ORDER BY mt.TreatmentDate DESC`;

            // Maintenance records query - unchanged
            const maintenanceQuery = `
                SELECT 
                    RecordID, EventID, CowTag, Note
                FROM MedicalTable 
                WHERE CowTag = @cowTag AND Maintenance = 1
                ORDER BY RecordID DESC`;

            // Vet visit query - unchanged
            const vetQuery = `
                SELECT 
                    RecordID, EventID, CowTag,
                    VetName, VetComments, Note
                FROM MedicalTable 
                WHERE CowTag = @cowTag AND Vet = 1
                ORDER BY RecordID DESC`;

            const [issuesResult, treatmentsResult, maintenanceResult, vetResult] = await Promise.all([
                request.query(issuesQuery),
                request.query(treatmentsQuery),
                request.query(maintenanceQuery),
                request.query(vetQuery)
            ]);

            return {
                success: true,
                medicalRecords: {
                    issues: issuesResult.recordset, // Now includes resolved issues with proper medicine data
                    treatments: treatmentsResult.recordset,
                    maintenance: maintenanceResult.recordset,
                    vetVisits: vetResult.recordset
                }
            };
        } catch (error) {
            console.error('Error fetching cow medical records:', error);
            throw new Error(`Failed to fetch medical records: ${error.message}`);
        }
    }



    /**
     * Add observation/note for a cow
     * @param {Object} params - { cowTag, note, dateOfEntry }
     */
    async addObservation(params) {
        const { cowTag, note, dateOfEntry } = params;
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
        const {
            cowTag, recordType, eventID,
            // Issue fields
            issueDescription, issueObservedBy, issueObservationDate, issueSerious,
            // Treatment fields  
            treatmentMedicine, treatmentDate, treatmentResponse, treatmentMethod,
            treatmentIsImmunization, treatmentIsActive,
            // Vet fields
            vetName, vetComments,
            // General
            note
        } = params;

        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('eventID', sql.Int, eventID || null);
            request.input('note', sql.NVarChar(sql.MAX), note || null);

            // Set record type flags
            request.input('maintenance', sql.Bit, recordType === 'maintenance');
            request.input('issue', sql.Bit, recordType === 'issue');
            request.input('treatment', sql.Bit, recordType === 'treatment');
            request.input('vet', sql.Bit, recordType === 'vet');

            // Issue fields
            request.input('issueDescription', sql.NVarChar(sql.MAX), issueDescription || null);
            request.input('issueObservedBy', sql.NVarChar, issueObservedBy || null);
            request.input('issueObservationDate', sql.DateTime, issueObservationDate || null);
            request.input('issueSerious', sql.Bit, issueSerious || false);
            request.input('issueResolved', sql.Bit, false); // New issues start unresolved

            // Treatment fields - FIXED: Set to NULL if empty string to avoid FK constraint violation
            const validMedicine = treatmentMedicine && treatmentMedicine.trim() !== '' ? treatmentMedicine : null;
            request.input('treatmentMedicine', sql.NVarChar, validMedicine);
            request.input('treatmentDate', sql.DateTime, treatmentDate || null);
            request.input('treatmentResponse', sql.NVarChar(sql.MAX), treatmentResponse || null);
            request.input('treatmentIsActive', sql.Bit, treatmentIsActive || false);

            // Vet fields
            request.input('vetName', sql.NVarChar, vetName || null);
            request.input('vetComments', sql.NVarChar(sql.MAX), vetComments || null);

            const query = `
                INSERT INTO MedicalTable (
                    CowTag, EventID, Note, Maintenance, Issue, Treatment, Vet,
                    IssueDescription, IssueObservedBy, IssueObservationDate, IssueSerious, IssueResolved,
                    TreatmentMedicine, TreatmentDate, TreatmentResponse,
                    TreatmentIsActive,
                    VetName, VetComments
                )
                OUTPUT INSERTED.RecordID
                VALUES (
                    @cowTag, @eventID, @note, @maintenance, @issue, @treatment, @vet,
                    @issueDescription, @issueObservedBy, @issueObservationDate, @issueSerious, @issueResolved,
                    @treatmentMedicine, @treatmentDate, @treatmentResponse,
                    @treatmentIsActive,
                    @vetName, @vetComments
                )`;

            const result = await request.query(query);
            return {
                success: true,
                recordID: result.recordset[0]?.RecordID,
                rowsAffected: result.rowsAffected[0],
                message: 'Medical record created successfully'
            };
        } catch (error) {
            console.error('Error creating comprehensive medical record:', error);
            throw new Error(`Failed to create medical record: ${error.message}`);
        }
    }

    async getMedicalRecordDetails(params) {
        const { recordID } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('recordID', sql.Int, recordID);

            const query = `
                SELECT 
                    mt.RecordID, mt.EventID, mt.CowTag, mt.Note,
                    mt.Maintenance, mt.Issue, mt.Treatment, mt.Vet,
                    mt.IssueDescription, mt.IssueObservedBy, mt.IssueObservationDate, 
                    mt.IssueResolved, mt.IssueResolutionNote, mt.IssueResolutionDate, mt.IssueSerious,
                    mt.TreatmentMedicine, mt.TreatmentDate, mt.TreatmentResponse, 
                    m.ApplicationMethod as TreatmentMethod,
                    m.IsImmunization as TreatmentIsImmunization,
                    mt.TreatmentIsActive,
                    mt.VetName, mt.VetComments
                FROM MedicalTable mt
                LEFT JOIN Medicines m ON mt.TreatmentMedicine = m.Medicine
                WHERE mt.RecordID = @recordID`;

            const result = await request.query(query);
            if (result.recordset.length === 0) {
                throw new Error('Medical record not found');
            }

            return { record: result.recordset[0] };
        } catch (error) {
            console.error('Error fetching medical record details:', error);
            throw new Error(`Failed to fetch medical record: ${error.message}`);
        }
    }

    async updateMedicalRecord(params) {
        const { recordID, ...updateFields } = params;
        await this.ensureConnection();

        try {
            // Extract and validate the data first, separate from update logic
            const data = {
                issueDescription: null,
                issueObservedBy: null,
                issueObservationDate: null,
                issueSerious: false,
                treatmentMedicine: null,
                treatmentDate: null,
                treatmentResponse: null,
                treatmentIsActive: false,
                vetName: null,
                vetComments: null,
                note: null
            };

            // Process each field individually with explicit validation
            if ('IssueDescription' in updateFields) {
                const value = updateFields.IssueDescription;
                if (typeof value === 'string' && value.trim() !== '') {
                    data.issueDescription = value.trim();
                }
                // else stays null
            }

            if ('IssueObservedBy' in updateFields) {
                const value = updateFields.IssueObservedBy;
                if (typeof value === 'string' && value.trim() !== '') {
                    data.issueObservedBy = value.trim();
                }
                // else stays null
            }

            if ('IssueObservationDate' in updateFields) {
                const value = updateFields.IssueObservationDate;
                if (value instanceof Date || (typeof value === 'string' && value.trim() !== '')) {
                    data.issueObservationDate = new Date(value);
                }
                // else stays null
            }

            if ('IssueSerious' in updateFields) {
                data.issueSerious = Boolean(updateFields.IssueSerious);
            }

            if ('TreatmentMedicine' in updateFields) {
                const value = updateFields.TreatmentMedicine;
                if (typeof value === 'string' && value.trim() !== '') {
                    data.treatmentMedicine = value.trim();
                }
                // else stays null
            }

            if ('TreatmentDate' in updateFields) {
                const value = updateFields.TreatmentDate;
                if (value instanceof Date || (typeof value === 'string' && value.trim() !== '')) {
                    data.treatmentDate = new Date(value);
                }
                // else stays null
            }

            if ('TreatmentResponse' in updateFields) {
                const value = updateFields.TreatmentResponse;
                if (typeof value === 'string' && value.trim() !== '') {
                    data.treatmentResponse = value.trim();
                }
                // else stays null
            }

            if ('TreatmentIsActive' in updateFields) {
                data.treatmentIsActive = Boolean(updateFields.TreatmentIsActive);
            }

            if ('VetName' in updateFields) {
                const value = updateFields.VetName;
                if (typeof value === 'string' && value.trim() !== '') {
                    data.vetName = value.trim();
                }
                // else stays null
            }

            if ('VetComments' in updateFields) {
                const value = updateFields.VetComments;
                if (typeof value === 'string' && value.trim() !== '') {
                    data.vetComments = value.trim();
                }
                // else stays null
            }

            if ('Note' in updateFields) {
                const value = updateFields.Note;
                if (typeof value === 'string' && value.trim() !== '') {
                    data.note = value.trim();
                }
                // else stays null
            }

            // Check if we have any fields to update
            const fieldsToUpdate = Object.keys(updateFields);
            if (fieldsToUpdate.length === 0) {
                throw new Error('No fields provided for update');
            }

            console.log('Processed data for update:', data);
            console.log('Fields requested for update:', fieldsToUpdate);

            // Now execute the hardcoded SQL update
            const request = this.pool.request();
            request.input('recordID', sql.Int, recordID);
            request.input('issueDescription', sql.NText, data.issueDescription);
            request.input('issueObservedBy', sql.NVarChar, data.issueObservedBy);
            request.input('issueObservationDate', sql.DateTime, data.issueObservationDate);
            request.input('issueSerious', sql.Bit, data.issueSerious);
            request.input('treatmentMedicine', sql.NVarChar, data.treatmentMedicine);
            request.input('treatmentDate', sql.DateTime, data.treatmentDate);
            request.input('treatmentResponse', sql.NText, data.treatmentResponse);
            request.input('treatmentIsActive', sql.Bit, data.treatmentIsActive);
            request.input('vetName', sql.NVarChar, data.vetName);
            request.input('vetComments', sql.NText, data.vetComments);
            request.input('note', sql.NText, data.note);

            // Build the update query based on which fields were provided
            const updateClauses = [];

            if ('IssueDescription' in updateFields) {
                updateClauses.push('IssueDescription = @issueDescription');
            }
            if ('IssueObservedBy' in updateFields) {
                updateClauses.push('IssueObservedBy = @issueObservedBy');
            }
            if ('IssueObservationDate' in updateFields) {
                updateClauses.push('IssueObservationDate = @issueObservationDate');
            }
            if ('IssueSerious' in updateFields) {
                updateClauses.push('IssueSerious = @issueSerious');
            }
            if ('TreatmentMedicine' in updateFields) {
                updateClauses.push('TreatmentMedicine = @treatmentMedicine');
            }
            if ('TreatmentDate' in updateFields) {
                updateClauses.push('TreatmentDate = @treatmentDate');
            }
            if ('TreatmentResponse' in updateFields) {
                updateClauses.push('TreatmentResponse = @treatmentResponse');
            }
            if ('TreatmentIsActive' in updateFields) {
                updateClauses.push('TreatmentIsActive = @treatmentIsActive');
            }
            if ('VetName' in updateFields) {
                updateClauses.push('VetName = @vetName');
            }
            if ('VetComments' in updateFields) {
                updateClauses.push('VetComments = @vetComments');
            }
            if ('Note' in updateFields) {
                updateClauses.push('Note = @note');
            }

            if (updateClauses.length === 0) {
                throw new Error('No valid update clauses generated');
            }

            const query = `
                UPDATE MedicalTable 
                SET ${updateClauses.join(', ')}
                WHERE RecordID = @recordID`;

            console.log('Final SQL query:', query);

            const result = await request.query(query);
            if (result.rowsAffected[0] === 0) {
                throw new Error('Medical record not found');
            }

            return {
                success: true,
                rowsAffected: result.rowsAffected[0],
                message: 'Medical record updated successfully'
            };
        } catch (error) {
            console.error('Error updating medical record:', error);
            throw new Error(`Failed to update medical record: ${error.message}`);
        }
    }

    async resolveIssue(params) {
        const { recordID, resolutionNote, resolutionDate } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('recordID', sql.Int, recordID);
            request.input('resolutionNote', sql.NVarChar(sql.MAX), resolutionNote);
            request.input('resolutionDate', sql.DateTime, resolutionDate || new Date());

            const query = `
                UPDATE MedicalTable 
                SET IssueResolved = 1, 
                    IssueResolutionNote = @resolutionNote,
                    IssueResolutionDate = @resolutionDate
                WHERE RecordID = @recordID AND Issue = 1`;

            const result = await request.query(query);
            if (result.rowsAffected[0] === 0) {
                throw new Error('Issue record not found');
            }

            return {
                success: true,
                message: 'Issue resolved successfully'
            };
        } catch (error) {
            console.error('Error resolving issue:', error);
            throw new Error(`Failed to resolve issue: ${error.message}`);
        }
    }

    /**
     * Get all medicines 
     */
    async getMedicines() {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            
            const query = `
                SELECT 
                    Medicine,
                    ApplicationMethod,
                    IsImmunization
                FROM Medicines 
                ORDER BY Medicine ASC`;

            const result = await request.query(query);
            
            return {
                success: true,
                medicines: result.recordset
            };
        } catch (error) {
            console.error('Error fetching medicines:', error);
            throw new Error(`Failed to fetch medicines: ${error.message}`);
        }
    }

    /**
     * Add a new medicine
     */
    async addMedicine(params) {
        const { medicine, applicationMethod, isImmunization } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('medicine', sql.NVarChar, medicine);
            request.input('applicationMethod', sql.NVarChar, applicationMethod);
            request.input('isImmunization', sql.Bit, isImmunization);

            const query = `
                INSERT INTO Medicines (Medicine, ApplicationMethod, IsImmunization)
                VALUES (@medicine, @applicationMethod, @isImmunization)`;

            const result = await request.query(query);
            
            return {
                success: true,
                rowsAffected: result.rowsAffected[0],
                message: 'Medicine added successfully'
            };
        } catch (error) {
            console.error('Error adding medicine:', error);
            throw new Error(`Failed to add medicine: ${error.message}`);
        }
    }


    /**
     * Update cow weight
     * @param {Object} params - { cowTag, weight }
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
     * Get breeding candidates for pregnancy check
     * @param {Object} params - { herdName }
     */
     async getHerdBreedingCandidates(params) {
        const { herdName } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            if (herdName && herdName !== 'ALL ACTIVE') {
                request.input('herdName', sql.NVarChar, herdName);
            }

            const query = `
            SELECT DISTINCT 
                c.CowTag,
                br.PrimaryBull,
                br.CleanupBull,
                br.ExposureStartDate,
                br.ExposureEndDate,
                CASE WHEN pc.ID IS NULL THEN 0 ELSE 1 END AS HasPregCheck
            FROM CowTable c
            INNER JOIN BreedingRecords br ON c.CowTag = br.CowTag
            LEFT JOIN PregancyCheck pc ON br.ID = pc.BreedingRecordID
            WHERE ${herdName && herdName !== 'ALL ACTIVE' ? 'c.CurrentHerd = @herdName AND' : ''}
                ${STATUS_ACTIVE}
            ORDER BY c.CowTag`;

            const result = await request.query(query);
            return { candidates: result.recordset };
        } catch (error) {
            console.error('Error fetching breeding candidates:', error);
            throw new Error(`Failed to fetch breeding candidates: ${error.message}`);
        }
    }

    /**
     * Submit pregnancy check results
     * @param {Object} params - { herdName, date, records: [{ cowTag, result, sex, weight, notes }] }
     */
    async submitPregancyCheck(params) {
        const { herdName, date, records, eventId = null } = params;
        await this.ensureConnection();

        try {
            // Insert pregnancy check records
            for (const record of records) {
                // Find breeding record ID
                const brRequest = this.pool.request();
                brRequest.input('cowTag', sql.NVarChar, record.cowTag);
                const brQuery = `
                SELECT TOP 1 ID FROM BreedingRecords 
                WHERE CowTag = @cowTag 
                ORDER BY ExposureStartDate DESC`;
                const brResult = await brRequest.query(brQuery);

                if (brResult.recordset.length === 0) continue;
                const breedingRecordId = brResult.recordset[0].ID;

                // Handle weight properly - create WeightRecord if weight provided
                let weightRecordId = null;
                if (record.weight) {
                    const weightRequest = this.pool.request();
                    weightRequest.input('cowTag', sql.NVarChar, record.cowTag);
                    weightRequest.input('weight', sql.Int, parseInt(record.weight));
                    weightRequest.input('timeRecorded', sql.DateTime, new Date(date));
                    weightRequest.input('eventId', sql.Int, eventId);

                    const weightQuery = `
                    INSERT INTO WeightRecords (CowTag, Weight, TimeRecorded, EventID)
                    OUTPUT INSERTED.ID
                    VALUES (@cowTag, @weight, @timeRecorded, @eventId)`;
                    const weightResult = await weightRequest.query(weightQuery);
                    weightRecordId = weightResult.recordset[0].ID;
                }

                const pcRequest = this.pool.request();
                pcRequest.input('eventId', sql.Int, eventId);
                pcRequest.input('breedingRecordId', sql.Int, breedingRecordId);
                pcRequest.input('cowTag', sql.NVarChar, record.cowTag);
                pcRequest.input('isPregnant', sql.Bit, record.result === 'Pregnant');
                pcRequest.input('pregCheckDate', sql.DateTime, new Date(date));
                pcRequest.input('fetusSex', sql.NVarChar, record.sex || null);
                pcRequest.input('weightRecordId', sql.Int, weightRecordId);
                pcRequest.input('notes', sql.NVarChar(sql.MAX), record.notes || null);

                const pcQuery = `
                INSERT INTO PregancyCheck (
                    EventID, BreedingRecordID, CowTag, IsPregnant, 
                    PregCheckDate, FetusSex, WeightRecordID, Notes
                ) VALUES (
                    @eventId, @breedingRecordId, @cowTag, @isPregnant,
                    @pregCheckDate, @fetusSex, @weightRecordId, @notes
                )`;
                await pcRequest.query(pcQuery);
            }

            return { success: true, recordsProcessed: records.length };
        } catch (error) {
            console.error('Error submitting pregnancy check:', error);
            throw new Error(`Failed to submit pregnancy check: ${error.message}`);
        }
    }
    
    /**
     * Get calving status for herd
     * @param {Object} params - { herdName }
     */
    async getCalvingStatus(params) {
        const { herdName } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            if (herdName && herdName !== 'ALL ACTIVE') {
                request.input('herdName', sql.NVarChar, herdName);
            }

            const query = `
            SELECT 
                c.CowTag,
                COALESCE(br.PrimaryBull, br.CleanupBull) AS Bull,
                CASE 
                    WHEN pc.IsPregnant = 1 THEN 'Pregnant'
                    WHEN pc.IsPregnant = 0 THEN 'Open'
                    ELSE 'Exposed'
                END AS Status,
                cr.CalfTag,
                cr.ID AS CalvingRecordId
            FROM CowTable c
            INNER JOIN BreedingRecords br ON c.CowTag = br.CowTag
            LEFT JOIN PregancyCheck pc ON br.ID = pc.BreedingRecordID
            LEFT JOIN CalvingRecords cr ON br.ID = cr.BreedingRecordID
            WHERE ${herdName && herdName !== 'ALL ACTIVE' ? 'c.CurrentHerd = @herdName AND' : ''}
                ${STATUS_ACTIVE}
            ORDER BY c.CowTag`;

            const result = await request.query(query);
            return { calvingStatus: result.recordset };
        } catch (error) {
            console.error('Error fetching calving status:', error);
            throw new Error(`Failed to fetch calving status: ${error.message}`);
        }
    }

    /**
     * Add calving record
     * @param {Object} params - { breedingRecordId, calfTag, damTag, birthDate, calfSex, notes, twins }
     */
    async addCalvingRecord(params) {
        const { breedingRecordId, calfTag, damTag, birthDate, calfSex, notes, twins = false } = params;
        await this.ensureConnection();

        try {
            const transaction = this.pool.transaction();
            await transaction.begin();

            try {
                // Create calving record
                const request = new sql.Request(transaction);
                request.input('breedingRecordId', sql.Int, breedingRecordId);
                request.input('isTagged', sql.Bit, true);
                request.input('calfTag', sql.NVarChar, calfTag);
                request.input('damTag', sql.NVarChar, damTag);
                request.input('birthDate', sql.DateTime, new Date(birthDate));
                request.input('calfSex', sql.NVarChar, calfSex);
                request.input('notes', sql.NVarChar(sql.MAX), notes || null);

                const query = `
                    INSERT INTO CalvingRecords (
                        BreedingRecordID, IsTagged, CalfTag, DamTag, BirthDate, CalfSex, CalvingNotes
                    ) VALUES (
                        @breedingRecordId, @isTagged, @calfTag, @damTag, @birthDate, @calfSex, @notes
                    )`;
                await request.query(query);

                await transaction.commit();
                return { success: true, message: 'Calving record added successfully' };
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Error adding calving record:', error);
            throw new Error(`Failed to add calving record: ${error.message}`);
        }
    }
    
    /**
     * Get weaning candidates
     * @param {Object} params - { herdName }
     */
    async getWeaningCandidates(params) {
        const { herdName } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            if (herdName && herdName !== 'ALL ACTIVE') {
                request.input('herdName', sql.NVarChar, herdName);
            }

            const query = `
            SELECT 
                c.CowTag,
                CASE WHEN wr.ID IS NULL THEN 0 ELSE 1 END AS IsWeaned
            FROM CowTable c
            LEFT JOIN WeaningRecords wr ON c.CowTag = wr.CowTag
            WHERE ${herdName && herdName !== 'ALL ACTIVE' ? 'c.CurrentHerd = @herdName AND' : ''}
                ${STATUS_ACTIVE}
                AND c.DateOfBirth >= DATEADD(month, -24, GETDATE()) -- Calves less than 2 years old
            ORDER BY c.CowTag`;

            const result = await request.query(query);
            return { weaningCandidates: result.recordset };
        } catch (error) {
            console.error('Error fetching weaning candidates:', error);
            throw new Error(`Failed to fetch weaning candidates: ${error.message}`);
        }
    }

    /**
     * Record weaning
     * @param {Object} params - { date, records: [{ cowTag, notes }] }
     */
    async recordWeaning(params) {
        const { date, records, eventId = null } = params;
        await this.ensureConnection();

        try {
            // Insert weaning records
            for (const record of records) {
                const wrRequest = this.pool.request();
                wrRequest.input('eventId', sql.Int, eventId);
                wrRequest.input('cowTag', sql.NVarChar, record.cowTag);
                wrRequest.input('weaningDate', sql.DateTime, new Date(date));
                wrRequest.input('notes', sql.NVarChar(sql.MAX), record.notes || null);

                const wrQuery = `
                INSERT INTO WeaningRecords (EventID, CowTag, WeaningDate, Notes)
                VALUES (@eventId, @cowTag, @weaningDate, @notes)`;
                await wrRequest.query(wrQuery);

                // Update CowTable weaning date
                const updateRequest = this.pool.request();
                updateRequest.input('cowTag', sql.NVarChar, record.cowTag);
                updateRequest.input('weaningDate', sql.DateTime, new Date(date));

                const updateQuery = `
                UPDATE CowTable 
                SET WeaningDate = @weaningDate 
                WHERE CowTag = @cowTag`;
                await updateRequest.query(updateQuery);
            }

            return { success: true, recordsProcessed: records.length };
        } catch (error) {
            console.error('Error recording weaning:', error);
            throw new Error(`Failed to record weaning: ${error.message}`);
        }
    }
    
    /**
     * Generate tag suggestions
     * @param {Object} params - { baseTag, allowReusable }
     */
    async generateTagSuggestions(params) {
        const { baseTag, allowReusable = false } = params;
        await this.ensureConnection();

        try {
            if (allowReusable) {
                throw new Error('Reusable tags feature requires database changes - not yet implemented');
            }

            // Get all existing tags
            const request = this.pool.request();
            const query = `
            SELECT CowTag FROM CowTable 
            WHERE CowTag IS NOT NULL 
              AND (Status IS NULL OR Status IN ('Current', 'Target Sale', 'Undefined', 'CULL LIST, Current'))`;
            const result = await request.query(query);
            const existingTags = new Set(result.recordset.map(r => r.CowTag));

            const suggestions = [];

            // Letter suggestions (baseTag + letter)
            if (baseTag) {
                for (let i = 97; i <= 122; i++) { // a-z
                    const letter = String.fromCharCode(i);
                    const suggestion = `${baseTag}${letter}`;
                    if (!existingTags.has(suggestion)) {
                        suggestions.push(suggestion);
                        if (suggestions.length >= 3) break;
                    }
                }
            }

            // Numeric suggestions
            const numericTags = Array.from(existingTags)
                .filter(tag => /^\d+$/.test(tag))
                .map(tag => parseInt(tag))
                .filter(num => !isNaN(num));

            const baseNum = baseTag && /^\d+$/.test(baseTag) ? parseInt(baseTag) : null;

            // Find nearby unused numbers
            if (baseNum) {
                // Check numbers before and after baseNum
                for (let offset = 1; offset <= 500; offset++) {
                    if (suggestions.length >= 5) break;

                    const lower = baseNum - offset;
                    const higher = baseNum + offset;

                    if (lower >= 0 && !numericTags.includes(lower)) {
                        suggestions.push(lower.toString());
                    }
                    if (higher <= 1000 && !numericTags.includes(higher)) {
                        suggestions.push(higher.toString());
                    }
                }
            }

            return { suggestions: suggestions.slice(0, 5) };
        } catch (error) {
            console.error('Error generating tag suggestions:', error);
            throw new Error(`Failed to generate tag suggestions: ${error.message}`);
        }
    }

    /**
     * Generate next available calf tag for a breeding year
     * @param {Object} params - { breedingYear, damTag?, sireTag? }
     */
    async generateCalfTag(params) {
        const { breedingYear, damTag, sireTag } = params;
        await this.ensureConnection();

        try {
            // Determine year letter (2024=E, 2025=F, 2026=G, etc.)
            // Starting from 2024 as 'E' (year 0 baseline)
            const baseYear = 2024;
            const yearOffset = breedingYear - baseYear;
            const yearLetter = String.fromCharCode(69 + yearOffset); // 69 is 'E'

            // Find highest existing number for this year letter
            const request = this.pool.request();
            request.input('yearLetter', sql.NVarChar, yearLetter);

            // Match tags that end with the year letter (e.g., "23F", "100F")
            const query = `
                SELECT CowTag
                FROM CowTable
                WHERE CowTag LIKE '%' + @yearLetter
                ORDER BY CowTag`;
            
            const result = await request.query(query);

            // Extract numbers from tags ending with year letter
            const existingNumbers = result.recordset
                .map(row => row.CowTag)
                .filter(tag => {
                    const match = tag.match(/^(\d+)[A-Z]$/);
                    return match && tag.endsWith(yearLetter);
                })
                .map(tag => parseInt(tag.match(/^(\d+)/)[1]))
                .filter(num => !isNaN(num));

            // Find next available number (start from 1)
            let nextNumber = 1;
            if (existingNumbers.length > 0) {
                const maxNumber = Math.max(...existingNumbers);
                nextNumber = maxNumber + 1;
            }

            const suggestedTag = `${nextNumber}${yearLetter}`;
            
            // Calculate genotype if parents provided
            let calculatedGenotype = null;
            if (damTag && sireTag) {
                calculatedGenotype = await this.calculateGenotypeFromParents(damTag, sireTag);
            }

            return {
                suggestedTag,
                nextNumber,
                yearLetter,
                calculatedGenotype,
                twinTag: `${nextNumber + 1}${yearLetter}` // Pre-calculate twin tag
            };
        } catch (error) {
            console.error('Error generating calf tag:', error);
            throw error;
        }
    }

    /**
     * Calculate genotype from parent genotypes
     * @param {string} damTag - Mother's tag
     * @param {string} sireTag - Father's tag
     */
    async calculateGenotypeFromParents(damTag, sireTag) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('damTag', sql.NVarChar, damTag);
            request.input('sireTag', sql.NVarChar, sireTag);

            const query = `
                SELECT 
                    (SELECT Genotype FROM CowTable WHERE CowTag = @damTag) AS DamGenotype,
                    (SELECT Genotype FROM CowTable WHERE CowTag = @sireTag) AS SireGenotype`;
            
            const result = await request.query(query);
            
            if (result.recordset.length === 0) {
                return null;
            }

            const { DamGenotype, SireGenotype } = result.recordset[0];
            
            if (!DamGenotype || !SireGenotype) {
                return null;
            }

            // Genotype inheritance rules
            const isPurebred = (genotype) => {
                return genotype && (
                    genotype.toLowerCase().includes('purebred') ||
                    !genotype.toLowerCase().includes('cross') && !genotype.toLowerCase().includes('f1')
                );
            };

            const damPurebred = isPurebred(DamGenotype);
            const sirePurebred = isPurebred(SireGenotype);

            // Both purebred same breed
            if (damPurebred && sirePurebred && DamGenotype === SireGenotype) {
                return DamGenotype;
            }

            // Both purebred different breeds -> F1 cross
            if (damPurebred && sirePurebred && DamGenotype !== SireGenotype) {
                return `F1 ${DamGenotype}-${SireGenotype} Cross`;
            }

            // One F1, one purebred -> F2/F3 cross
            if (DamGenotype.includes('F1') || SireGenotype.includes('F1')) {
                return `${DamGenotype} x ${SireGenotype} Cross`;
            }

            // Default fallback
            return `${DamGenotype} x ${SireGenotype}`;
        } catch (error) {
            console.error('Error calculating genotype:', error);
            return null;
        }
    }

    /**
     * Add cow with calf-specific handling
     * Enhanced to handle twins and calving records
     */
    async addCowWithCalfHandling(params) {
        const {
            // Basic cow data
            cowTag, dateOfBirth, description, dam, sire, sex, status,
            currentHerd, genotype, temperament, regCert, regCertNumber,
            birthweight, birthweightClass, targetPrice, origin,
            // Calf-specific
            isNewCalf, breedingYear, createCalvingRecord, calvingNotes,
            // Twins
            twins, twinData
        } = params;

        await this.ensureConnection();

        try {
            const transaction = this.pool.transaction();
            await transaction.begin();

            try {
                // Add primary calf
                const request = new sql.Request(transaction);
                request.input('cowTag', sql.NVarChar, cowTag);
                request.input('dateOfBirth', sql.DateTime, dateOfBirth || null);
                request.input('description', sql.NVarChar, description || null);
                request.input('dam', sql.NVarChar, dam || null);
                request.input('sire', sql.NVarChar, sire || null);
                request.input('sex', sql.NVarChar, sex || null);
                request.input('status', sql.NVarChar, status || 'Current');
                request.input('currentHerd', sql.NVarChar, currentHerd || null);
                request.input('genotype', sql.NVarChar, genotype || null);
                request.input('temperament', sql.NVarChar, temperament || null);
                request.input('regCert', sql.NVarChar, regCert || null);
                request.input('regCertNumber', sql.NVarChar, regCertNumber || null);
                request.input('birthweight', sql.NVarChar, birthweight || null);
                request.input('birthweightClass', sql.NVarChar, birthweightClass || null);
                request.input('targetPrice', sql.Money, targetPrice || null);
                request.input('origin', sql.NVarChar, origin || null);

                const insertQuery = `
                    INSERT INTO CowTable (
                        CowTag, DateOfBirth, Description, [Dam (Mother)], [Sire (Father)],
                        Sex, Status, CurrentHerd, Genotype, Temperament, RegCert, RegCertNumber,
                        Birthweight, BirthweightClass, TargetPrice, Origin
                    ) VALUES (
                        @cowTag, @dateOfBirth, @description, @dam, @sire,
                        @sex, @status, @currentHerd, @genotype, @temperament, @regCert, @regCertNumber,
                        @birthweight, @birthweightClass, @targetPrice, @origin
                    )`;
                await request.query(insertQuery);

                let calvingRecordCreated = false;
                let twinCalvingRecordCreated = false;

                // Create calving record if requested
                if (createCalvingRecord && dam && breedingYear) {
                    const breedingRecordId = await this.findBreedingRecordForDam(dam, breedingYear);
                    
                    if (breedingRecordId) {
                        const calvingRequest = new sql.Request(transaction);
                        calvingRequest.input('breedingRecordId', sql.Int, breedingRecordId);
                        calvingRequest.input('isTagged', sql.Bit, true);
                        calvingRequest.input('calfTag', sql.NVarChar, cowTag);
                        calvingRequest.input('damTag', sql.NVarChar, dam);
                        calvingRequest.input('birthDate', sql.DateTime, dateOfBirth || new Date());
                        calvingRequest.input('calfSex', sql.NVarChar, sex);
                        calvingRequest.input('notes', sql.NVarChar(sql.MAX), calvingNotes || null);
                        calvingRequest.input('birthOrder', sql.Int, 1);
                        calvingRequest.input('calfDied', sql.Bit, false);
                        calvingRequest.input('damDied', sql.Bit, false);

                        const calvingQuery = `
                            INSERT INTO CalvingRecords (
                                BreedingRecordID, IsTagged, CalfTag, DamTag, BirthDate, 
                                CalfSex, CalvingNotes, BirthOrder, CalfDiedAtBirth, DamDiedAtBirth
                            ) VALUES (
                                @breedingRecordId, @isTagged, @calfTag, @damTag, @birthDate,
                                @calfSex, @notes, @birthOrder, @calfDied, @damDied
                            )`;
                        await calvingRequest.query(calvingQuery);
                        calvingRecordCreated = true;

                        // Handle twin if provided
                        if (twins && twinData && twinData.cowTag) {
                            // Add twin cow
                            const twinCowRequest = new sql.Request(transaction);
                            twinCowRequest.input('cowTag', sql.NVarChar, twinData.cowTag);
                            twinCowRequest.input('dateOfBirth', sql.DateTime, dateOfBirth || null);
                            twinCowRequest.input('description', sql.NVarChar, twinData.description || null);
                            twinCowRequest.input('dam', sql.NVarChar, dam);
                            twinCowRequest.input('sire', sql.NVarChar, sire);
                            twinCowRequest.input('sex', sql.NVarChar, twinData.sex || sex);
                            twinCowRequest.input('status', sql.NVarChar, status || 'Current');
                            twinCowRequest.input('currentHerd', sql.NVarChar, currentHerd || null);
                            twinCowRequest.input('genotype', sql.NVarChar, genotype || null);
                            twinCowRequest.input('temperament', sql.NVarChar, temperament || null);
                            twinCowRequest.input('regCert', sql.NVarChar, regCert || null);

                            await twinCowRequest.query(insertQuery.replace(/@cowTag/g, '@cowTag')
                                .replace(/@description/g, '@description')
                                .replace(/@sex/g, '@sex'));

                            // Create twin calving record
                            const twinCalvingRequest = new sql.Request(transaction);
                            twinCalvingRequest.input('breedingRecordId', sql.Int, breedingRecordId);
                            twinCalvingRequest.input('isTagged', sql.Bit, true);
                            twinCalvingRequest.input('calfTag', sql.NVarChar, twinData.cowTag);
                            twinCalvingRequest.input('damTag', sql.NVarChar, dam);
                            twinCalvingRequest.input('birthDate', sql.DateTime, dateOfBirth || new Date());
                            twinCalvingRequest.input('calfSex', sql.NVarChar, twinData.sex || sex);
                            twinCalvingRequest.input('notes', sql.NVarChar(sql.MAX), twinData.calvingNotes || null);
                            twinCalvingRequest.input('birthOrder', sql.Int, 2);
                            twinCalvingRequest.input('calfDied', sql.Bit, false);
                            twinCalvingRequest.input('damDied', sql.Bit, false);

                            await twinCalvingRequest.query(calvingQuery);
                            twinCalvingRecordCreated = true;
                        }
                    }
                }

                await transaction.commit();

                return {
                    success: true,
                    cowTag,
                    twinTag: twins ? twinData?.cowTag : null,
                    calvingRecordCreated,
                    twinCalvingRecordCreated,
                    message: 'Animal(s) added successfully'
                };
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Error adding cow with calf handling:', error);
            throw error;
        }
    }
    
    
    /**
     * Record batch weights
     * @param {Object} params - { date, records: [{ cowTag, weight, notes }] }
     */
    async recordBatchWeights(params) {
        const { date, records } = params;
        await this.ensureConnection();

        try {
            // Create event
            const eventRequest = this.pool.request();
            eventRequest.input('eventDate', sql.DateTime, new Date(date));
            eventRequest.input('description', sql.NVarChar, `Batch Weigh-in`);

            const eventQuery = `
            INSERT INTO Events (EventDate, Description)
            OUTPUT INSERTED.ID
            VALUES (@eventDate, @description)`;
            const eventResult = await eventRequest.query(eventQuery);
            const eventId = eventResult.recordset[0].ID;

            // Insert weight records
            for (const record of records) {
                const wrRequest = this.pool.request();
                wrRequest.input('eventId', sql.Int, eventId);
                wrRequest.input('weight', sql.Int, record.weight);
                wrRequest.input('timeRecorded', sql.DateTime, new Date(date));
                wrRequest.input('cowTag', sql.NVarChar, record.cowTag);
                wrRequest.input('notes', sql.Text, record.notes || null);

                const wrQuery = `
                INSERT INTO WeightRecords (EventID, Weight, TimeRecorded, CowTag, Notes)
                VALUES (@eventId, @weight, @timeRecorded, @cowTag, @notes)`;
                await wrRequest.query(wrQuery);
            }

            return { success: true, eventId, recordsProcessed: records.length };
        } catch (error) {
            console.error('Error recording batch weights:', error);
            throw new Error(`Failed to record batch weights: ${error.message}`);
        }
    }

    /**
     * Get dropdown options for forms
     */
    async getFormDropdownData() {
        await this.ensureConnection();

        try {
            const queries = {
                genotypes: `SELECT Genotype FROM Genotype ORDER BY Genotype`,
                temperaments: `SELECT Temperament FROM Temperament ORDER BY Temperament`,
                statuses: `SELECT Status FROM Status ORDER BY Status`,
                sexes: `SELECT Sex FROM Sex ORDER BY Sex`,
                regCerts: `SELECT RegCertStatus FROM RegCert ORDER BY RegCertStatus`
            };

            const results = {};
            for (const [key, query] of Object.entries(queries)) {
                const result = await this.pool.request().query(query);
                results[key] = result.recordset.map(r => Object.values(r)[0]);
            }

            return results;
        } catch (error) {
            console.error('Error fetching dropdown data:', error);
            throw new Error(`Failed to fetch dropdown data: ${error.message}`);
        }
    }

    /**
     * Add new cow with all fields for AddAnimal form
     * @param {Object} params - All CowTable fields
     */
    async addCow(params) {
        const {
            cowTag, dateOfBirth, description, dam, sire, sex, status,
            currentHerd, genotype, temperament, regCert, regCertNumber,
            birthweight, birthweightClass, targetPrice, origin
        } = params;

        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('dateOfBirth', sql.DateTime, dateOfBirth || null);
            request.input('description', sql.NVarChar, description || null);
            request.input('dam', sql.NVarChar, dam || null);
            request.input('sire', sql.NVarChar, sire || null);
            request.input('sex', sql.NVarChar, sex || null);
            request.input('status', sql.NVarChar, status || 'Current');
            request.input('currentHerd', sql.NVarChar, currentHerd || null);
            request.input('genotype', sql.NVarChar, genotype || null);
            request.input('temperament', sql.NVarChar, temperament || null);
            request.input('regCert', sql.NVarChar, regCert || null);
            request.input('regCertNumber', sql.NVarChar, regCertNumber || null);
            request.input('birthweight', sql.NVarChar, birthweight || null);
            request.input('birthweightClass', sql.NVarChar, birthweightClass || null);
            request.input('targetPrice', sql.Money, targetPrice || null);
            request.input('origin', sql.NVarChar, origin || null);

            const query = `
                INSERT INTO CowTable (
                    CowTag, DateOfBirth, Description, [Dam (Mother)], [Sire (Father)],
                    Sex, Status, CurrentHerd, Genotype, Temperament, RegCert, RegCertNumber,
                    Birthweight, BirthweightClass, TargetPrice, SaleRecordID, Origin
                ) VALUES (
                    @cowTag, @dateOfBirth, @description, @dam, @sire,
                    @sex, @status, @currentHerd, @genotype, @temperament, @regCert, @regCertNumber,
                    @birthweight, @birthweightClass, @targetPrice, NULL, @origin
                )`;

            const result = await request.query(query);
            return {
                success: true,
                rowsAffected: result.rowsAffected[0],
                message: 'Cow added successfully'
            };
        } catch (error) {
            console.error('Error adding cow:', error);
            if (error.number === 2627) {
                throw new Error('Cow with this tag already exists');
            }
            throw new Error(`Failed to add cow: ${error.message}`);
        }
    }

    /**
     * Get all cows (with pagination)
     * @param {Object} params - { page, limit, search }
     */
    async getAllCows(params) {
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

    async getAllHerds() {
        await this.ensureConnection();

        try {
            const query = `SELECT HerdName FROM Herds ORDER BY HerdName`;
            const result = await this.pool.request().query(query);
            return result.recordset.map(row => row.HerdName);
        } catch (error) {
            console.error('Error fetching herds:', error);
            throw new Error(`Failed to fetch herds: ${error.message}`);
        }
    }

    async setHerd(params) {
        const { cowTag, herdName } = params;
        // Validate herd exists first
        const herdCheck = await this.pool.request()
            .input('herdName', sql.NVarChar, herdName)
            .query('SELECT COUNT(*) as Count FROM Herds WHERE HerdName = @herdName');

        if (herdCheck.recordset[0].Count === 0) {
            throw new Error(`Herd '${herdName}' does not exist`);
        }

        // Update cow's herd
        const result = await this.pool.request()
            .input('cowTag', sql.NVarChar, cowTag)
            .input('herdName', sql.NVarChar, herdName)
            .query('UPDATE CowTable SET CurrentHerd = @herdName WHERE CowTag = @cowTag');

        if (result.rowsAffected[0] === 0) {
            throw new Error('Cow not found');
        }

        return { success: true, message: 'Herd updated successfully' };
    }

    /**
     * Get all herds with detailed information including animal counts and current status
     * @returns {Object} - { herds: [...] }
     */
    async getAllHerdsWithDetails() {
        await this.ensureConnection();

        try {
            // Get all herds with their current pastures
            const herdsQuery = `
                SELECT HerdName, CurrentPasture 
                FROM Herds 
                ORDER BY HerdName`;
            const herdsResult = await this.pool.request().query(herdsQuery);

            const herdsWithDetails = [];

            for (const herd of herdsResult.recordset) {
                const herdName = herd.HerdName;

                // Get cows in this herd
                const cowsRequest = this.pool.request();
                cowsRequest.input('herdName', sql.NVarChar, herdName);
                const cowsQuery = `
                    SELECT CowTag, DateOfBirth, Sex, Status, Description
                    FROM CowTable 
                    WHERE CurrentHerd = @herdName
                    ORDER BY CowTag`;
                const cowsResult = await cowsRequest.query(cowsQuery);

                // Get goats in this herd
                const goatsRequest = this.pool.request();
                goatsRequest.input('herdName', sql.NVarChar, herdName);
                const goatsQuery = `
                    SELECT GoatTag, Herd 
                    FROM Goats 
                    WHERE Herd = @herdName
                    ORDER BY GoatTag`;
                const goatsResult = await goatsRequest.query(goatsQuery);

                // Calculate days on current pasture
                let daysOnPasture = null;
                if (herd.CurrentPasture) {
                    const movementRequest = this.pool.request();
                    movementRequest.input('herdName', sql.NVarChar, herdName);
                    movementRequest.input('pasture', sql.NVarChar, herd.CurrentPasture);
                    const movementQuery = `
                        SELECT TOP 1 DateRecorded
                        FROM HerdMovementRecords 
                        WHERE Herd = @herdName AND NewPasture = @pasture
                        ORDER BY DateRecorded DESC`;
                    const movementResult = await movementRequest.query(movementQuery);

                    if (movementResult.recordset.length > 0) {
                        const moveDate = new Date(movementResult.recordset[0].DateRecorded);
                        const now = new Date();
                        daysOnPasture = Math.floor((now - moveDate) / (1000 * 60 * 60 * 24));
                    }
                }

                herdsWithDetails.push({
                    herdName: herdName,
                    currentPasture: herd.CurrentPasture,
                    cowCount: cowsResult.recordset.length,
                    goatCount: goatsResult.recordset.length,
                    daysOnPasture: daysOnPasture,
                    cows: cowsResult.recordset,
                    goats: goatsResult.recordset
                });
            }

            return { herds: herdsWithDetails };
        } catch (error) {
            console.error('Error fetching herds with details:', error);
            throw new Error(`Failed to fetch herd details: ${error.message}`);
        }
    }

    /**
     * Get feed status for a specific herd, optionally filtered by feed types
     * @param {Object} params - { herdName, feeds? }
     */
    async getHerdFeedStatus(params) {
        const { herdName, feeds } = params;
        await this.ensureConnection();

        try {
            // Get herd's current pasture
            const herdRequest = this.pool.request();
            herdRequest.input('herdName', sql.NVarChar, herdName);
            const herdQuery = `SELECT CurrentPasture FROM Herds WHERE HerdName = @herdName`;
            const herdResult = await herdRequest.query(herdQuery);

            if (herdResult.recordset.length === 0) {
                throw new Error(`Herd '${herdName}' not found`);
            }

            const pastureName = herdResult.recordset[0].CurrentPasture;
            if (!pastureName) {
                throw new Error(`Herd '${herdName}' is not assigned to a pasture`);
            }

            // Get all feed types (or filtered list)
            let feedTypesQuery = `SELECT Feed FROM PastureFeedOptions ORDER BY Feed`;
            let feedTypesResult;

            if (feeds && feeds.length > 0) {
                const feedTypesRequest = this.pool.request();
                const feedPlaceholders = feeds.map((_, index) => `@feed${index}`).join(',');
                feeds.forEach((feed, index) => {
                    feedTypesRequest.input(`feed${index}`, sql.NVarChar, feed);
                });
                feedTypesQuery = `SELECT Feed FROM PastureFeedOptions WHERE Feed IN (${feedPlaceholders}) ORDER BY Feed`;
                feedTypesResult = await feedTypesRequest.query(feedTypesQuery);
            } else {
                feedTypesResult = await this.pool.request().query(feedTypesQuery);
            }

            const feedStatus = [];

            for (const feedType of feedTypesResult.recordset) {
                const feed = feedType.Feed;

                // Get most recent activity for this feed type in this pasture
                const activityRequest = this.pool.request();
                activityRequest.input('pasture', sql.NVarChar, pastureName);
                activityRequest.input('feedType', sql.NVarChar, feed);
                const activityQuery = `
                    SELECT TOP 1 DateCompleted, WasRefilled, WasEmpty
                    FROM PastureFeedRecords 
                    WHERE Pasture = @pasture AND FeedType = @feedType
                    ORDER BY DateCompleted DESC`;
                const activityResult = await activityRequest.query(activityQuery);

                let lastActivityDate = null;
                let daysAgo = null;
                let lastActivity = null;

                if (activityResult.recordset.length > 0) {
                    const record = activityResult.recordset[0];
                    lastActivityDate = record.DateCompleted;
                    const activityDate = new Date(record.DateCompleted);
                    const now = new Date();
                    daysAgo = Math.floor((now - activityDate) / (1000 * 60 * 60 * 24));

                    // Determine activity type
                    if (record.WasRefilled) {
                        lastActivity = "refilled";
                    } else if (record.WasEmpty) {
                        lastActivity = "checked_empty";
                    } else {
                        lastActivity = "checked_not_empty";
                    }
                }

                feedStatus.push({
                    feedType: feed,
                    lastActivityDate: lastActivityDate,
                    daysAgo: daysAgo,
                    lastActivity: lastActivity,
                    displayText: daysAgo !== null ? `${daysAgo} days ago` : "never"
                });
            }

            return {
                pastureName: pastureName,
                feedStatus: feedStatus
            };
        } catch (error) {
            console.error('Error fetching herd feed status:', error);
            throw new Error(`Failed to fetch feed status: ${error.message}`);
        }
    }

    /**
     * Get all available feed types from PastureFeedOptions
     */
    async getAllFeedTypes() {
        await this.ensureConnection();

        try {
            const query = `SELECT Feed FROM PastureFeedOptions ORDER BY Feed`;
            const result = await this.pool.request().query(query);
            return {
                feedTypes: result.recordset.map(row => row.Feed)
            };
        } catch (error) {
            console.error('Error fetching feed types:', error);
            throw new Error(`Failed to fetch feed types: ${error.message}`);
        }
    }

    /**
     * Add new feed type to PastureFeedOptions
     * @param {Object} params - { feedType }
     */
    async addFeedType(params) {
        const { feedType } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('feedType', sql.NVarChar, feedType);

            const query = `INSERT INTO PastureFeedOptions (Feed) VALUES (@feedType)`;
            const result = await request.query(query);

            return {
                success: true,
                rowsAffected: result.rowsAffected[0],
                message: 'Feed type added successfully'
            };
        } catch (error) {
            console.error('Error adding feed type:', error);

            // Handle duplicate key constraint violation
            if (error.number === 2627) {
                return {
                    success: false,
                    operationalError: true,
                    message: `Feed type '${feedType}' already exists`
                };
            }

            throw new Error(`Failed to add feed type: ${error.message}`);
        }
    }


    /**
     * Record feed activity for a pasture
     * @param {Object} params - { herdName, feedType, activityType, wasEmpty?, username }
     */
    async recordFeedActivity(params) {
        const { herdName, feedType, activityType, wasEmpty, username } = params;
        await this.ensureConnection();

        try {
            // Get herd's current pasture
            const herdRequest = this.pool.request();
            herdRequest.input('herdName', sql.NVarChar, herdName);
            const herdQuery = `SELECT CurrentPasture FROM Herds WHERE HerdName = @herdName`;
            const herdResult = await herdRequest.query(herdQuery);

            if (herdResult.recordset.length === 0) {
                throw new Error(`Herd '${herdName}' not found`);
            }

            const pastureName = herdResult.recordset[0].CurrentPasture;
            if (!pastureName) {
                throw new Error(`Herd '${herdName}' is not assigned to a pasture`);
            }

            const now = new Date();

            // If this is a refill activity, create two records
            if (activityType === "refilled") {
                // First record: empty/not empty status
                const statusRequest = this.pool.request();
                statusRequest.input('pasture', sql.NVarChar, pastureName);
                statusRequest.input('dateCompleted', sql.DateTime, now);
                statusRequest.input('username', sql.NVarChar, username);
                statusRequest.input('feedType', sql.NVarChar, feedType);
                statusRequest.input('wasRefilled', sql.Bit, false);
                statusRequest.input('wasEmpty', sql.Bit, wasEmpty);

                const statusQuery = `
                    INSERT INTO PastureFeedRecords (Pasture, DateCompleted, Username, FeedType, WasRefilled, WasEmpty)
                    VALUES (@pasture, @dateCompleted, @username, @feedType, @wasRefilled, @wasEmpty)`;
                await statusRequest.query(statusQuery);

                // Second record: refill action
                const refillRequest = this.pool.request();
                refillRequest.input('pasture', sql.NVarChar, pastureName);
                refillRequest.input('dateCompleted', sql.DateTime, now);
                refillRequest.input('username', sql.NVarChar, username);
                refillRequest.input('feedType', sql.NVarChar, feedType);
                refillRequest.input('wasRefilled', sql.Bit, true);
                refillRequest.input('wasEmpty', sql.Bit, false);

                const refillQuery = `
                    INSERT INTO PastureFeedRecords (Pasture, DateCompleted, Username, FeedType, WasRefilled, WasEmpty)
                    VALUES (@pasture, @dateCompleted, @username, @feedType, @wasRefilled, @wasEmpty)`;
                await refillRequest.query(refillQuery);

            } else {
                // Single record for check activities
                const isEmpty = activityType === "checked_empty";

                const request = this.pool.request();
                request.input('pasture', sql.NVarChar, pastureName);
                request.input('dateCompleted', sql.DateTime, now);
                request.input('username', sql.NVarChar, username);
                request.input('feedType', sql.NVarChar, feedType);
                request.input('wasRefilled', sql.Bit, false);
                request.input('wasEmpty', sql.Bit, isEmpty);

                const query = `
                    INSERT INTO PastureFeedRecords (Pasture, DateCompleted, Username, FeedType, WasRefilled, WasEmpty)
                    VALUES (@pasture, @dateCompleted, @username, @feedType, @wasRefilled, @wasEmpty)`;
                await request.query(query);
            }

            return {
                success: true,
                message: 'Feed activity recorded successfully'
            };
        } catch (error) {
            console.error('Error recording feed activity:', error);
            throw new Error(`Failed to record feed activity: ${error.message}`);
        }
    }

    /**
     * Get all animals in a specific herd
     * @param {Object} params - { herdName }
     */
    async getHerdAnimals(params) {
        const { herdName } = params;
        await this.ensureConnection();

        try {
            // Get cows
            const cowsRequest = this.pool.request();
            cowsRequest.input('herdName', sql.NVarChar, herdName);
            const cowsQuery = `
                SELECT CowTag, DateOfBirth AS DOB, Sex, Status, Description,
                    CONVERT(varchar, DateOfBirth, 120) AS FormattedDOB
                FROM CowTable 
                WHERE CurrentHerd = @herdName
                ORDER BY CowTag`;
            const cowsResult = await cowsRequest.query(cowsQuery);

            // Get goats  
            const goatsRequest = this.pool.request();
            goatsRequest.input('herdName', sql.NVarChar, herdName);
            const goatsQuery = `
                SELECT GoatTag AS CowTag, NULL AS DOB, NULL AS Sex, NULL AS Status, NULL AS Description,
                    NULL AS FormattedDOB
                FROM Goats 
                WHERE Herd = @herdName
                ORDER BY GoatTag`;
            const goatsResult = await goatsRequest.query(goatsQuery);

            // Combine results
            const animals = [
                ...cowsResult.recordset,
                ...goatsResult.recordset
            ];

            return { animals };
        } catch (error) {
            console.error('Error fetching herd animals:', error);
            throw new Error(`Failed to fetch herd animals: ${error.message}`);
        }
    }

    /**
     * Move herd to a new pasture
     * @param {Object} params - { herdName, newPastureName, username }
     */
    async moveHerdToPasture(params) {
        const { herdName, newPastureName, username } = params;
        await this.ensureConnection();

        try {
            // Verify herd exists
            const herdCheckRequest = this.pool.request();
            herdCheckRequest.input('herdName', sql.NVarChar, herdName);
            const herdCheckQuery = `SELECT COUNT(*) as Count FROM Herds WHERE HerdName = @herdName`;
            const herdCheckResult = await herdCheckRequest.query(herdCheckQuery);

            if (herdCheckResult.recordset[0].Count === 0) {
                throw new Error(`Herd '${herdName}' not found`);
            }

            // Verify pasture exists
            const pastureCheckRequest = this.pool.request();
            pastureCheckRequest.input('pastureName', sql.NVarChar, newPastureName);
            const pastureCheckQuery = `SELECT COUNT(*) as Count FROM Pastures WHERE PastureName = @pastureName`;
            const pastureCheckResult = await pastureCheckRequest.query(pastureCheckQuery);

            if (pastureCheckResult.recordset[0].Count === 0) {
                throw new Error(`Pasture '${newPastureName}' not found`);
            }

            // Update herd's current pasture
            const updateRequest = this.pool.request();
            updateRequest.input('herdName', sql.NVarChar, herdName);
            updateRequest.input('newPasture', sql.NVarChar, newPastureName);
            const updateQuery = `UPDATE Herds SET CurrentPasture = @newPasture WHERE HerdName = @herdName`;
            await updateRequest.query(updateQuery);

            // Record the movement
            const movementRequest = this.pool.request();
            movementRequest.input('dateRecorded', sql.DateTime, new Date());
            movementRequest.input('herd', sql.NVarChar, herdName);
            movementRequest.input('newPasture', sql.NVarChar, newPastureName);
            const movementQuery = `
                INSERT INTO HerdMovementRecords (DateRecorded, Herd, NewPasture)
                VALUES (@dateRecorded, @herd, @newPasture)`;
            await movementRequest.query(movementQuery);

            return {
                success: true,
                message: 'Herd moved successfully'
            };
        } catch (error) {
            console.error('Error moving herd:', error);
            throw new Error(`Failed to move herd: ${error.message}`);
        }
    }

    /**
     * Get all available pastures
     */
    async getAllPastures() {
        await this.ensureConnection();

        try {
            const query = `SELECT PastureName FROM Pastures ORDER BY PastureName`;
            const result = await this.pool.request().query(query);
            return {
                pastures: result.recordset.map(row => row.PastureName)
            };
        } catch (error) {
            console.error('Error fetching pastures:', error);
            throw new Error(`Failed to fetch pastures: ${error.message}`);
        }
    }

    async setHerd(params) {
        const { cowTag, herdName } = params;
        await this.ensureConnection();

        try {
            // Validate herd exists first
            const herdCheck = await this.pool.request()
                .input('herdName', sql.NVarChar, herdName)
                .query('SELECT COUNT(*) as Count FROM Herds WHERE HerdName = @herdName');

            if (herdCheck.recordset[0].Count === 0) {
                throw new Error(`Herd '${herdName}' does not exist`);
            }

            // Update cow's herd
            const result = await this.pool.request()
                .input('cowTag', sql.NVarChar, cowTag)
                .input('herdName', sql.NVarChar, herdName)
                .query('UPDATE CowTable SET CurrentHerd = @herdName WHERE CowTag = @cowTag');

            if (result.rowsAffected[0] === 0) {
                throw new Error('Cow not found');
            }

            // Record in HerdMembershipHistory
            const historyRequest = this.pool.request();
            historyRequest.input('herdName', sql.NVarChar, herdName);
            historyRequest.input('cowTag', sql.NVarChar, cowTag);
            historyRequest.input('dateJoined', sql.DateTime, new Date());
            const historyQuery = `
                INSERT INTO HerdMembershipHistory (HerdName, CowTag, DateJoined)
                VALUES (@herdName, @cowTag, @dateJoined)`;
            await historyRequest.query(historyQuery);

            return { success: true, message: 'Herd updated successfully' };
        } catch (error) {
            console.error('Error setting herd:', error);
            throw new Error(`Failed to set herd: ${error.message}`);
        }
    }

    async getHerdEvents(params) {
        const { herdName } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('herdName', sql.NVarChar, herdName);

            const query = `
            SELECT 'movement' AS eventType, DateRecorded AS dateRecorded, 
                   CONCAT('Herd moved to ', NewPasture) AS description, NULL AS notes, NULL AS username
            FROM HerdMovementRecords 
            WHERE Herd = @herdName
            
            UNION ALL
            
            SELECT 'membership' AS eventType, DateJoined AS dateRecorded,
                   CONCAT('Added ', CowTag, ' to herd') AS description, NULL AS notes, NULL AS username
            FROM HerdMembershipHistory
            WHERE HerdName = @herdName
            
            ORDER BY dateRecorded DESC`;

            const result = await request.query(query);
            return { events: result.recordset };
        } catch (error) {
            console.error('Error fetching herd events:', error);
            throw error;
        }
    }

    async addHerdEvent(params) {
        const { herdName, eventType, description, notes, username } = params;
        await this.ensureConnection();

        try {
            // For now, just add to Events table with generic entry
            const request = this.pool.request();
            request.input('eventDate', sql.DateTime, new Date());
            request.input('description', sql.NVarChar, `${herdName}: ${description}`);

            const query = `INSERT INTO Events (EventDate, Description) VALUES (@eventDate, @description)`;
            const result = await request.query(query);

            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error adding herd event:', error);
            throw error;
        }
    }

    async getPastureMaintenanceEvents(params) {
        const { pastureName } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('pastureName', sql.NVarChar, pastureName);

            const query = `
            SELECT DateCompleted, TargetOfMainenance, ActionPerformed, 
                   NeedsFollowUp, Username, FollowingUpOnID
            FROM PastureMaintenanceRecords 
            WHERE Pasture = @pastureName
            ORDER BY DateCompleted DESC`;

            const result = await request.query(query);
            return { maintenanceRecords: result.recordset };
        } catch (error) {
            console.error('Error fetching pasture maintenance events:', error);
            throw error;
        }
    }

    async addPastureMaintenanceEvent(params) {
        const { pastureName, targetOfMaintenance, actionPerformed, needsFollowUp, username } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('pasture', sql.NVarChar, pastureName);
            request.input('dateCompleted', sql.DateTime, new Date());
            request.input('username', sql.NVarChar, username);
            request.input('targetOfMaintenance', sql.NVarChar, targetOfMaintenance);
            request.input('actionPerformed', sql.NVarChar(sql.MAX), actionPerformed);
            request.input('needsFollowUp', sql.Bit, needsFollowUp);

            const query = `
            INSERT INTO PastureMaintenanceRecords 
            (Pasture, DateCompleted, Username, TargetOfMainenance, ActionPerformed, NeedsFollowUp)
            VALUES (@pasture, @dateCompleted, @username, @targetOfMaintenance, @actionPerformed, @needsFollowUp)`;

            const result = await request.query(query);
            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error adding pasture maintenance event:', error);
            throw error;
        }
    }

    async createHerd(params) {
        const { herdName, cows, currentPasture } = params;
        await this.ensureConnection();

        try {
            // Create herd
            const herdRequest = this.pool.request();
            herdRequest.input('herdName', sql.NVarChar, herdName);
            herdRequest.input('currentPasture', sql.NVarChar, currentPasture);

            const herdQuery = `INSERT INTO Herds (HerdName, CurrentPasture) VALUES (@herdName, @currentPasture)`;
            await herdRequest.query(herdQuery);

            // Move cows to new herd
            if (cows && cows.length > 0) {
                for (const cowTag of cows) {
                    await this.setHerd({ cowTag, herdName });
                }
            }

            return { success: true, herdName };
        } catch (error) {
            console.error('Error creating herd:', error);
            throw error;
        }
    }

    async batchMoveCows(params) {
        const { cowTags, targetHerd, sourceHerd } = params;
        await this.ensureConnection();

        try {
            const results = [];
            for (const cowTag of cowTags) {
                const result = await this.setHerd({ cowTag, herdName: targetHerd });
                results.push(result);
            }

            return { success: true, movedCount: results.length };
        } catch (error) {
            console.error('Error batch moving cows:', error);
            throw error;
        }
    }

    async getCowsByHerd() {
        await this.ensureConnection();

        try {
            const query = `
            SELECT CowTag, DateOfBirth, CurrentHerd, Sex, Status, Description
            FROM CowTable 
            WHERE CowTag IS NOT NULL
            ORDER BY CurrentHerd, CowTag`;

            const result = await this.pool.request().query(query);
            return { cows: result.recordset };
        } catch (error) {
            console.error('Error fetching cows by herd:', error);
            throw error;
        }
    }

    async getUserPreferences(params) {
        const { username } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('username', sql.NVarChar, username);

            const query = `SELECT Preferences FROM Users WHERE Username = @username`;
            const result = await request.query(query);

            let preferences;

            if (result.recordset.length === 0 || !result.recordset[0].Preferences) {
                // No preferences exist - create default with all feeds
                const allFeedsResult = await this.getAllFeedTypes();
                const defaultPreferences = {
                    shownFeeds: allFeedsResult.feedTypes
                };

                // Save the defaults to database
                await this.updateUserPreferences({ username, preferences: defaultPreferences });

                return { preferences: defaultPreferences };
            }

            const preferencesJson = result.recordset[0].Preferences;
            preferences = JSON.parse(preferencesJson);

            // If shownFeeds is empty, populate with all available feeds
            if (!preferences.shownFeeds || preferences.shownFeeds.length === 0) {
                const allFeedsResult = await this.getAllFeedTypes();
                preferences.shownFeeds = allFeedsResult.feedTypes;

                // Save the updated preferences
                await this.updateUserPreferences({ username, preferences });
            }

            return { preferences };
        } catch (error) {
            console.error('Error fetching user preferences:', error);
            throw error;
        }
    }

    async updateUserPreferences(params) {
        const { username, preferences } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('username', sql.NVarChar, username);
            request.input('preferences', sql.NVarChar(sql.MAX), JSON.stringify(preferences));

            const query = `
            IF EXISTS (SELECT 1 FROM Users WHERE Username = @username)
              UPDATE Users SET Preferences = @preferences WHERE Username = @username
            ELSE
              INSERT INTO Users (Username, Preferences) VALUES (@username, @preferences)`;

            const result = await request.query(query);
            return { success: true };
        } catch (error) {
            console.error('Error updating user preferences:', error);
            throw error;
        }
    }

    async recordFeedActivity(params) {
        const { herdName, feedType, activityType, wasEmpty, levelAtRefill, username } = params;
        await this.ensureConnection();

        try {
            // Get herd's current pasture
            const herdRequest = this.pool.request();
            herdRequest.input('herdName', sql.NVarChar, herdName);
            const herdQuery = `SELECT CurrentPasture FROM Herds WHERE HerdName = @herdName`;
            const herdResult = await herdRequest.query(herdQuery);

            if (herdResult.recordset.length === 0) {
                throw new Error(`Herd '${herdName}' not found`);
            }

            const pastureName = herdResult.recordset[0].CurrentPasture;
            if (!pastureName) {
                throw new Error(`Herd '${herdName}' is not assigned to a pasture`);
            }

            const now = new Date();

            if (activityType === "refilled") {
                // Legacy refill handling - create two records
                const statusRequest = this.pool.request();
                statusRequest.input('pasture', sql.NVarChar, pastureName);
                statusRequest.input('dateCompleted', sql.DateTime, now);
                statusRequest.input('username', sql.NVarChar, username);
                statusRequest.input('feedType', sql.NVarChar, feedType);
                statusRequest.input('wasRefilled', sql.Bit, false);
                statusRequest.input('wasEmpty', sql.Bit, wasEmpty);
                statusRequest.input('levelAtRefill', sql.Int, wasEmpty ? 0 : 100);

                const statusQuery = `
              INSERT INTO PastureFeedRecords (Pasture, DateCompleted, Username, FeedType, WasRefilled, WasEmpty, LevelAtRefill)
              VALUES (@pasture, @dateCompleted, @username, @feedType, @wasRefilled, @wasEmpty, @levelAtRefill)`;
                await statusRequest.query(statusQuery);

                const refillRequest = this.pool.request();
                refillRequest.input('pasture', sql.NVarChar, pastureName);
                refillRequest.input('dateCompleted', sql.DateTime, now);
                refillRequest.input('username', sql.NVarChar, username);
                refillRequest.input('feedType', sql.NVarChar, feedType);
                refillRequest.input('wasRefilled', sql.Bit, true);
                refillRequest.input('wasEmpty', sql.Bit, false);
                refillRequest.input('levelAtRefill', sql.Int, 100);

                const refillQuery = `
              INSERT INTO PastureFeedRecords (Pasture, DateCompleted, Username, FeedType, WasRefilled, WasEmpty, LevelAtRefill)
              VALUES (@pasture, @dateCompleted, @username, @feedType, @wasRefilled, @wasEmpty, @levelAtRefill)`;
                await refillRequest.query(refillQuery);

            } else if (activityType === "level_check") {
                // New level check system
                const request = this.pool.request();
                request.input('pasture', sql.NVarChar, pastureName);
                request.input('dateCompleted', sql.DateTime, now);
                request.input('username', sql.NVarChar, username);
                request.input('feedType', sql.NVarChar, feedType);
                request.input('wasRefilled', sql.Bit, false);
                request.input('wasEmpty', sql.Bit, levelAtRefill < 5);
                request.input('levelAtRefill', sql.Int, levelAtRefill);

                const query = `
              INSERT INTO PastureFeedRecords (Pasture, DateCompleted, Username, FeedType, WasRefilled, WasEmpty, LevelAtRefill)
              VALUES (@pasture, @dateCompleted, @username, @feedType, @wasRefilled, @wasEmpty, @levelAtRefill)`;
                await request.query(query);
            } else {
                // Legacy check activities
                const isEmpty = activityType === "checked_empty";

                const request = this.pool.request();
                request.input('pasture', sql.NVarChar, pastureName);
                request.input('dateCompleted', sql.DateTime, now);
                request.input('username', sql.NVarChar, username);
                request.input('feedType', sql.NVarChar, feedType);
                request.input('wasRefilled', sql.Bit, false);
                request.input('wasEmpty', sql.Bit, isEmpty);
                request.input('levelAtRefill', sql.Int, isEmpty ? 0 : 100);

                const query = `
              INSERT INTO PastureFeedRecords (Pasture, DateCompleted, Username, FeedType, WasRefilled, WasEmpty, LevelAtRefill)
              VALUES (@pasture, @dateCompleted, @username, @feedType, @wasRefilled, @wasEmpty, @levelAtRefill)`;
                await request.query(query);
            }

            return { success: true, message: 'Feed activity recorded successfully' };
        } catch (error) {
            console.error('Error recording feed activity:', error);
            throw error;
        }
    }































    /**
     * SHEET MANAGEMENT FUNCTIONS
     */

    async getSheetDefinition(params) {
        const { sheetId } = params;
        await this.ensureConnection();
        try {
            const numericSheetId = parseInt(sheetId);
            if (isNaN(numericSheetId)) {
                throw new Error(`Invalid sheet ID: ${sheetId}`);
            }

            const request = this.pool.request();
            request.input('sheetId', sql.Int, numericSheetId);
            const query = `SELECT SheetName, Columns FROM Sheets WHERE ID = @sheetId`;
            const result = await request.query(query);

            if (result.recordset.length === 0) {
                throw new Error(`Sheet with ID '${sheetId}' not found`);
            }

            return {
                name: result.recordset[0].SheetName,
                columns: result.recordset[0].Columns
            };
        } catch (error) {
            console.log('getSheetDefinition received sheetId:', sheetId, 'type:', typeof sheetId);
            const numericSheetId = parseInt(sheetId);
            console.log('Converted to:', numericSheetId, 'isNaN:', isNaN(numericSheetId));
            console.error('Error fetching sheet definition:', error);
            throw error;
        }
    }


    async updateSheetInDB(params) {
        const { sheetId, name, columns } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('sheetId', sql.Int, sheetId);
            request.input('sheetName', sql.NVarChar, name);
            request.input('columns', sql.NVarChar(sql.MAX), JSON.stringify(columns));

            const query = `
                UPDATE Sheets 
                SET SheetName = @sheetName, Columns = @columns
                WHERE ID = @sheetId`;

            const result = await request.query(query);
            if (result.rowsAffected[0] === 0) {
                throw new Error('Sheet not found');
            }

            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error updating sheet:', error);
            throw error;
        }
    }

    async deleteSheetFromDB(sheetId) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('sheetId', sql.Int, sheetId);
            const query = `DELETE FROM Sheets WHERE ID = @sheetId`;

            const result = await request.query(query);
            if (result.rowsAffected[0] === 0) {
                throw new Error('Sheet not found');
            }

            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error deleting sheet:', error);
            throw error;
        }
    }

    async getAllSheetsFromDB() {
        await this.ensureConnection();
        try {
            const query = `SELECT ID, SheetName, CreatedBy, Locked, ParentSheet, Columns FROM Sheets ORDER BY Locked DESC, SheetName`;
            const result = await this.pool.request().query(query);
            return { sheets: result.recordset };
        } catch (error) {
            console.error('Error fetching sheets from DB:', error);
            throw error;
        }
    }

    async createSheetInDB(params) {
        const { name, columns, createdBy, locked = false, parentSheetId = null } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('sheetName', sql.NVarChar, name);
            request.input('columns', sql.NVarChar(sql.MAX), JSON.stringify(columns));
            request.input('createdBy', sql.NVarChar, createdBy);
            request.input('locked', sql.Bit, locked);
            request.input('parentSheet', sql.Int, parentSheetId);

            const query = `
            INSERT INTO Sheets (SheetName, Columns, CreatedBy, Locked, ParentSheet)
            VALUES (@sheetName, @columns, @createdBy, @locked, @parentSheet)`;

            const result = await request.query(query);
            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error creating sheet:', error);
            throw error;
        }
    }

    // New calculated value functions
    async getCalculatedValue(cowTag, fieldName) {
        try {
            switch (fieldName) {
                case 'Age':
                    const basicInfo = await this.getCowTableValue(cowTag, 'DateOfBirth');
                    return this.calculateAge(basicInfo);

                case 'AgeInMonths':
                    const birthInfo = await this.getCowTableValue(cowTag, 'DateOfBirth');
                    return this.calculateAgeInMonths(birthInfo);

                case 'PregnancyMonths':
                    const pregCheck = await this.getPregancyCheckValue(cowTag, 'IsPregnant');
                    const pregDate = await this.getPregancyCheckValue(cowTag, 'PregCheckDate');
                    return this.calculatePregnancyMonths(pregDate, pregCheck === 'Yes');

                case 'OpenStatus':
                    const isPregnant = await this.getPregancyCheckValue(cowTag, 'IsPregnant');
                    return isPregnant === 'Yes' ? 'No' : 'Yes';

                case 'CullStatus':
                    const status = await this.getCowTableValue(cowTag, 'Status');
                    return status === 'Cull' ? 'Yes' : 'No';

                case 'BreedingStatus':
                    return await this.calculateBreedingStatus(cowTag);

                case 'WeaningStatus':
                    return await this.calculateWeaningStatus(cowTag);

                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error calculating value for ${fieldName}:`, error);
            return '';
        }
    }

    calculateAgeInMonths(dateOfBirth) {
        try {
            if (!dateOfBirth) return '';

            let birthDate;
            if (typeof dateOfBirth === 'string') {
                birthDate = new Date(dateOfBirth);
            } else if (dateOfBirth instanceof Date) {
                birthDate = dateOfBirth;
            } else {
                return '';
            }

            if (isNaN(birthDate.getTime())) {
                return '';
            }

            const today = new Date();
            const timeDiff = today.getTime() - birthDate.getTime();
            const monthsDiff = Math.floor(timeDiff / (1000 * 3600 * 24 * 30.44)); // Average days per month

            return monthsDiff >= 0 ? monthsDiff.toString() : '0';
        } catch (error) {
            console.error('Error calculating age in months:', error);
            return '';
        }
    }

    async calculateBreedingStatus(cowTag) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            // Check for pregnancy check results first
            const pregQuery = `
            SELECT TOP 1 IsPregnant 
            FROM PregancyCheck 
            WHERE CowTag = @cowTag 
            ORDER BY PregCheckDate DESC`;
            const pregResult = await request.query(pregQuery);

            if (pregResult.recordset.length > 0) {
                return pregResult.recordset[0].IsPregnant ? 'Pregnant' : 'Open';
            }

            // If no pregnancy check, check for breeding records
            const breedingQuery = `
            SELECT TOP 1 ID 
            FROM BreedingRecords 
            WHERE CowTag = @cowTag 
            ORDER BY ExposureStartDate DESC`;
            const breedingResult = await request.query(breedingQuery);

            if (breedingResult.recordset.length > 0) {
                return 'Exposed';
            }

            return 'Unknown';
        } catch (error) {
            console.error('Error calculating breeding status:', error);
            return 'Unknown';
        }
    }

    async calculateWeaningStatus(cowTag) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            // Check for weaning records
            const weaningQuery = `
            SELECT TOP 1 ID 
            FROM WeaningRecords 
            WHERE CowTag = @cowTag`;
            const weaningResult = await request.query(weaningQuery);

            return weaningResult.recordset.length > 0 ? 'Weaned' : 'Unweaned';
        } catch (error) {
            console.error('Error calculating weaning status:', error);
            return 'Unweaned';
        }
    }

    // Breeding plan functions
    async getBreedingPlans() {
        await this.ensureConnection();

        try {
            const query = `
            SELECT ID, PlanName, PlanYear, Notes, IsActive
            FROM BreedingPlan 
            ORDER BY PlanYear DESC, PlanName`;
            const result = await this.pool.request().query(query);
            return { plans: result.recordset };
        } catch (error) {
            console.error('Error fetching breeding plans:', error);
            throw error;
        }
    }

    async getBreedingPlanOverview(params) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            const planId = params.planId || params;
            request.input('planId', sql.Int, planId);

            // Get unassigned animals (active cows without breeding records for this plan)
            const unassignedQuery = `
            SELECT c.CowTag, c.CurrentHerd
            FROM CowTable c
            LEFT JOIN BreedingRecords br ON c.CowTag = br.CowTag AND br.PlanID = @planId
            WHERE ${STATUS_ACTIVE}
              AND br.ID IS NULL
            ORDER BY c.CowTag`;
            const unassignedResult = await request.query(unassignedQuery);

            // Get pregnant count
            const pregnantQuery = `
            SELECT COUNT(DISTINCT pc.CowTag) as PregnantCount
            FROM PregancyCheck pc
            INNER JOIN BreedingRecords br ON pc.BreedingRecordID = br.ID
            WHERE br.PlanID = @planId AND pc.IsPregnant = 1`;
            const pregnantResult = await request.query(pregnantQuery);

            // Get calves count for this year
            const plan = await this.getBreedingPlan(planId);
            const calvesQuery = `
            SELECT COUNT(*) as CalvesCount
            FROM CalvingRecords
            WHERE YEAR(BirthDate) = ${plan.PlanYear}`;
            const calvesResult = await this.pool.request().query(calvesQuery);

            // Calculate pregnancy rate
            const totalBreedingQuery = `
            SELECT COUNT(DISTINCT CowTag) as TotalBred
            FROM BreedingRecords
            WHERE PlanID = @planId`;
            const totalBreedingResult = await request.query(totalBreedingQuery);

            const pregnantCount = pregnantResult.recordset[0].PregnantCount || 0;
            const totalBred = totalBreedingResult.recordset[0].TotalBred || 0;
            const pregnancyRate = totalBred > 0 ? Math.round((pregnantCount / totalBred) * 100) : 0;

            return {
                unassignedCount: unassignedResult.recordset.length,
                unassignedAnimals: unassignedResult.recordset,
                pregnantCount: pregnantCount,
                pregnancyRate: pregnancyRate,
                calvesCount: calvesResult.recordset[0].CalvesCount || 0,
                calvingSeason: this.getCalvingSeason(plan.PlanYear)
            };
        } catch (error) {
            console.error('Error fetching breeding plan overview:', error);
            throw error;
        }
    }

    

    async getBreedingPlan(planId) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('planId', sql.Int, planId);

            const query = `SELECT * FROM BreedingPlan WHERE ID = @planId`;
            const result = await request.query(query);

            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error fetching breeding plan:', error);
            throw error;
        }
    }

    getCalvingSeason(year) {
        const currentMonth = new Date().getMonth() + 1; // 1-12

        if (currentMonth >= 1 && currentMonth <= 4) {
            return `Spring ${year}`;
        } else if (currentMonth >= 5 && currentMonth <= 8) {
            return `Summer ${year}`;
        } else {
            return `Fall ${year}`;
        }
    }


    async updateSheetCell(params) {
        const { handler, cowTag, value, breedingYear, breedingPlanId } = params;
        await this.ensureConnection();
        console.log('updateSheetCell called with:', params);

        try {
            // Get current breeding year if not provided
            let currentBreedingYear = breedingYear;
            if (!currentBreedingYear) {
                const breedingPlans = await this.getBreedingPlans();
                const activePlan = breedingPlans.plans.find(p => p.IsActive) || breedingPlans.plans[0];
                currentBreedingYear = activePlan ? activePlan.PlanYear : new Date().getFullYear();
                console.log('Using default breeding year:', currentBreedingYear);
            }

            switch (handler) {
                case 'updatePregancyResult':
                    //console.log('Calling updatePregancyResult');
                    return await this.updatePregancyResult(cowTag, value, currentBreedingYear);

                case 'updateFetusSex':
                    //console.log('Calling updateFetusSex');
                    return await this.updateFetusSex(cowTag, value);

                case 'updatePregCheckWeight':
                    //console.log('Calling updatePregCheckWeight');
                    return await this.updatePregCheckWeight(cowTag, value);

                case 'updatePregCheckNotes':
                    //console.log('Calling updatePregCheckNotes');
                    return await this.updatePregCheckNotes(cowTag, value);

                case 'updatePregCheckDate':
                    //console.log('Calling updatePregCheckDate');
                    return await this.updatePregCheckDate(cowTag, value, currentBreedingYear);

                case 'updateMonthsPregnant':
                    //console.log('Calling updateMonthsPregnant');
                    return await this.updateMonthsPregnant(cowTag, value);

                case 'updateBreedingStatus':
                    //console.log('Calling updateBreedingStatus');
                    return await this.updateBreedingStatus(cowTag, value, currentBreedingYear);

                case 'updateWeaningStatus':
                    //console.log('Calling updateWeaningStatus');
                    return await this.updateWeaningStatus(cowTag, value, currentBreedingYear);

                case 'recordNewWeight':
                    //console.log('Calling recordNewWeight');
                    return await this.recordNewWeight(cowTag, value);

                case 'addCalvingNote':
                    //console.log('Calling addCalvingNote');
                    return await this.addCalvingNote(cowTag, value, currentBreedingYear);

                default:
                    //console.error(`Unknown update handler: ${handler}`);
                    throw new Error(`Unknown update handler: ${handler}`);
            }
        } catch (error) {
            console.error(`Error in updateSheetCell for ${handler}:`, error);
            throw error;
        }
    }

    async batchUpdateSheetCells(params) {
        const { updates } = params; // Array of {cowTag, columnKey, value, handler}
        const results = [];
        
        for (const update of updates) {
            try {
                const result = await this.updateSheetCell({
                    handler: update.handler,
                    cowTag: update.cowTag,
                    value: update.value
                });
                results.push({ ...update, success: true, result });
            } catch (error) {
                results.push({ ...update, success: false, error: error.message });
            }
        }
        
        return { results, successCount: results.filter(r => r.success).length };
    }
    


    async recordNewWeight(cowTag, value, eventId = null) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('weight', sql.Int, parseInt(value));
            request.input('eventId', sql.Int, eventId);

            // Insert new weight record
            const insertQuery = `
            INSERT INTO WeightRecords (CowTag, Weight, TimeRecorded, EventID)
            OUTPUT INSERTED.ID
            VALUES (@cowTag, @weight, GETDATE(), @eventId)`;

            const result = await request.query(insertQuery);
            const newWeightId = result.recordset[0].ID;

            // Update cow's LastWeightRecord
            const updateCowQuery = `
            UPDATE CowTable 
            SET LastWeightRecord = ${newWeightId}
            WHERE CowTag = @cowTag`;

            await request.query(updateCowQuery);

            return { success: true };
        } catch (error) {
            console.error('Error recording new weight:', error);
            throw error;
        }
    }


    /**
     * DYNAMIC DATA LOADING
     */
    async getSheetDataDynamic(params) {
        const { sheetId, herdName } = params;

        try {
            // 1. Get sheet definition
            const sheetDef = await this.getSheetDefinition({ sheetId });
            const columnConfig = JSON.parse(sheetDef.columns);

            // 2. Get cow list based on herd filter
            const cowList = await this.getCowListForHerd(herdName);

            // 3. For each cow, get all column values
            const sheetData = [];
            for (const cowTag of cowList) {
                const rowData = { CowTag: cowTag }; // Always include CowTag

                for (const column of columnConfig.columns) {
                    rowData[column.key] = await this.getColumnValue(cowTag, column.dataPath);
                }
                sheetData.push(rowData);
            }

            // 4. Build column definitions for frontend
            const columns = columnConfig.columns.map(col => ({
                key: col.key,
                name: col.name,
                editable: col.dataPath.startsWith('Fillable/'), // Only fillable fields editable for now
                type: col.type || 'text'
            }));

            return {
                columns: columns,
                data: sheetData,
                updateHandlers: {} // Empty for now - no setters implemented
            };
        } catch (error) {
            console.error('Error loading dynamic sheet data:', error);
            throw error;
        }
    }

    async getCowListForHerd(herdName) {
        await this.ensureConnection();

        try {
            if (herdName && herdName !== 'All active') {
                const request = this.pool.request();
                request.input('herdName', sql.NVarChar, herdName);
                const query = `
                    SELECT CowTag 
                    FROM CowTable 
                    WHERE CurrentHerd = @herdName 
                      AND CowTag IS NOT NULL 
                      AND ${STATUS_ACTIVE}
                    ORDER BY CowTag`;
                const result = await request.query(query);
                return result.recordset.map(r => r.CowTag);
            } else {
                // All active cows
                const query = `
                    SELECT CowTag 
                    FROM CowTable 
                    WHERE CowTag IS NOT NULL 
                      AND ${STATUS_ACTIVE}
                    ORDER BY CowTag`;
                const result = await this.pool.request().query(query);
                return result.recordset.map(r => r.CowTag);
            }
        } catch (error) {
            console.error('Error fetching cow list for herd:', error);
            throw error;
        }
    }

    async getColumnValue(cowTag, dataPath) {
        const [source, fieldName] = dataPath.split('/');

        try {
            switch (source) {
                case 'CowTable':
                    return await this.getCowTableValue(cowTag, fieldName);
                case 'WeightRecords':
                    return await this.getWeightRecordsValue(cowTag, fieldName);
                case 'MedicalTable':
                    return await this.getMedicalTableValue(cowTag, fieldName);
                case 'BreedingRecords':
                    return await this.getBreedingRecordsValue(cowTag, fieldName);
                case 'PregancyCheck':
                    return await this.getPregancyCheckValue(cowTag, fieldName);
                case 'CalvingRecords':
                    return await this.getCalvingRecordsValue(cowTag, fieldName);
                case 'Herds':
                    return await this.getHerdsValue(cowTag, fieldName);
                case 'Calculated':
                    return await this.getCalculatedValue(cowTag, fieldName);
                case 'Fillable':
                    return await this.getFillableValue(cowTag, fieldName);
                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error getting column value for ${dataPath}:`, error);
            return '';
        }
    }

    /**
     * COLUMN VALUE GETTERS BY SOURCE
     */

    async getCowTableValue(cowTag, fieldName) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            // Map frontend names to actual database column names
            const columnMap = {
                'CowTag': 'CowTag',
                'Dam': '[Dam (Mother)]',
                'Sire': '[Sire (Father)]',
                'Sex': 'Sex',
                'DateOfBirth': 'DateOfBirth',
                'CurrentHerd': 'CurrentHerd',
                'LastWeightRecord': 'LastWeightRecord',
                'Description': 'Description',
                'Genotype': 'Genotype',
                'Temperament': 'Temperament',
                'Status': 'Status',
                'RegCert': 'RegCert'
            };

            const dbColumn = columnMap[fieldName] || fieldName;

            // Special handling for date formatting
            if (fieldName === 'DateOfBirth') {
                const query = `SELECT FORMAT(${dbColumn}, 'MM/dd/yyyy') AS FormattedDate FROM CowTable WHERE CowTag = @cowTag`;
                const result = await request.query(query);
                return result.recordset[0] ? result.recordset[0]['FormattedDate'] : '';
            }

            const query = `SELECT ${dbColumn} FROM CowTable WHERE CowTag = @cowTag`;
            const result = await request.query(query);

            // Fix: Use the correct property name to access the result
            if (fieldName === 'Dam') {
                return result.recordset[0] ? result.recordset[0]['Dam (Mother)'] : '';
            } else if (fieldName === 'Sire') {
                return result.recordset[0] ? result.recordset[0]['Sire (Father)'] : '';
            } else {
                return result.recordset[0] ? result.recordset[0][fieldName] : '';
            }
        } catch (error) {
            console.error(`Error fetching CowTable value for ${fieldName}:`, error);
            return '';
        }
    }

    async getCalvingRecordsValue(cowTag, fieldName, breedingYear = null) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            let yearFilter = '';
            if (breedingYear) {
                request.input('breedingYear', sql.Int, breedingYear);
                yearFilter = `
                INNER JOIN BreedingRecords br ON cr.BreedingRecordID = br.ID
                INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
                WHERE cr.DamTag = @cowTag AND bp.PlanYear = @breedingYear`;
            } else {
                yearFilter = 'WHERE cr.DamTag = @cowTag';
            }

            switch (fieldName) {
                case 'CalfTag':
                    const calfTagQuery = `
                    SELECT TOP 1 CalfTag
                    FROM CalvingRecords cr
                    ${yearFilter}
                    ORDER BY BirthDate DESC`;
                    const calfTagResult = await request.query(calfTagQuery);
                    return calfTagResult.recordset[0]?.CalfTag || '';

                case 'CalfSex':
                    const sexQuery = `
                    SELECT TOP 1 CalfSex
                    FROM CalvingRecords cr
                    ${yearFilter}
                    ORDER BY BirthDate DESC`;
                    const sexResult = await request.query(sexQuery);
                    return sexResult.recordset[0]?.CalfSex || '';

                case 'BirthDate':
                    const birthQuery = `
                    SELECT TOP 1 FORMAT(BirthDate, 'MM/dd/yyyy') AS FormattedBirthDate
                    FROM CalvingRecords cr
                    ${yearFilter}
                    ORDER BY BirthDate DESC`;
                    const birthResult = await request.query(birthQuery);
                    return birthResult.recordset[0]?.FormattedBirthDate || '';

                case 'CalvingNotes':
                    const notesQuery = `
                    SELECT TOP 1 CalvingNotes
                    FROM CalvingRecords cr
                    ${yearFilter}
                    ORDER BY BirthDate DESC`;
                    const notesResult = await request.query(notesQuery);
                    return notesResult.recordset[0]?.CalvingNotes || '';

                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error fetching CalvingRecords value for ${fieldName}:`, error);
            return '';
        }
    }

    async getBreedingRecordsValue(cowTag, fieldName) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            switch (fieldName) {
                case 'PrimaryBull':
                    const primaryQuery = `
                        SELECT TOP 1 PrimaryBull
                        FROM BreedingRecords 
                        WHERE CowTag = @cowTag
                        ORDER BY ExposureStartDate DESC`;
                    const primaryResult = await request.query(primaryQuery);
                    return primaryResult.recordset[0]?.PrimaryBull || '';

                case 'CleanupBull':
                    const cleanupQuery = `
                        SELECT TOP 1 CleanupBull
                        FROM BreedingRecords 
                        WHERE CowTag = @cowTag
                        ORDER BY ExposureStartDate DESC`;
                    const cleanupResult = await request.query(cleanupQuery);
                    return cleanupResult.recordset[0]?.CleanupBull || '';

                case 'CurrentBull':
                    const currentQuery = `
                        SELECT TOP 1 PrimaryBull, ExposureStartDate, ExposureEndDate
                        FROM BreedingRecords 
                        WHERE CowTag = @cowTag AND GETDATE() BETWEEN ExposureStartDate AND ExposureEndDate
                        ORDER BY ExposureStartDate DESC`;
                    const currentResult = await request.query(currentQuery);
                    return currentResult.recordset[0]?.PrimaryBull || 'None';

                case 'ExposureStartDate':
                    // Format exposure start date to mm/dd/yyyy
                    const startQuery = `
                        SELECT TOP 1 FORMAT(ExposureStartDate, 'MM/dd/yyyy') AS FormattedStartDate
                        FROM BreedingRecords 
                        WHERE CowTag = @cowTag
                        ORDER BY ExposureStartDate DESC`;
                    const startResult = await request.query(startQuery);
                    return startResult.recordset[0]?.FormattedStartDate || '';

                case 'ExposureEndDate':
                    // Format exposure end date to mm/dd/yyyy
                    const endQuery = `
                        SELECT TOP 1 FORMAT(ExposureEndDate, 'MM/dd/yyyy') AS FormattedEndDate
                        FROM BreedingRecords 
                        WHERE CowTag = @cowTag
                        ORDER BY ExposureStartDate DESC`;
                    const endResult = await request.query(endQuery);
                    return endResult.recordset[0]?.FormattedEndDate || '';

                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error fetching BreedingRecords value for ${fieldName}:`, error);
            return '';
        }
    }

    async getPregancyCheckValue(cowTag, fieldName, breedingYear = null) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            let yearFilter = '';
            if (breedingYear) {
                request.input('breedingYear', sql.Int, breedingYear);
                yearFilter = `
                INNER JOIN BreedingRecords br ON pc.BreedingRecordID = br.ID
                INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
                WHERE pc.CowTag = @cowTag AND bp.PlanYear = @breedingYear`;
            } else {
                yearFilter = 'WHERE pc.CowTag = @cowTag';
            }

            switch (fieldName) {
                case 'IsPregnant':
                    const pregnantQuery = `
                    SELECT TOP 1 IsPregnant
                    FROM PregancyCheck pc
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                    const pregnantResult = await request.query(pregnantQuery);
                    const isPregnant = pregnantResult.recordset[0]?.IsPregnant;
                    return isPregnant === 1 ? 'Pregnant' : (isPregnant === 0 ? 'Open' : '');

                case 'PregCheckDate':
                    const dateQuery = `
                    SELECT TOP 1 FORMAT(PregCheckDate, 'yyyy-MM-dd') AS FormattedPregCheckDate
                    FROM PregancyCheck pc
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                    const dateResult = await request.query(dateQuery);
                    return dateResult.recordset[0]?.FormattedPregCheckDate || '';

                case 'FetusSeX':
                    const sexQuery = `
                    SELECT TOP 1 FetusSex
                    FROM PregancyCheck pc
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                    const sexResult = await request.query(sexQuery);
                    return sexResult.recordset[0]?.FetusSex || '';

                case 'WeightAtCheck':
                    const weightQuery = `
                    SELECT TOP 1 wr.Weight
                    FROM PregancyCheck pc
                    LEFT JOIN WeightRecords wr ON pc.WeightRecordID = wr.ID
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                    const weightResult = await request.query(weightQuery);
                    return weightResult.recordset[0]?.Weight || '';

                case 'Notes':
                    const notesQuery = `
                    SELECT TOP 1 pc.Notes
                    FROM PregancyCheck pc
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                    const notesResult = await request.query(notesQuery);
                    return notesResult.recordset[0]?.Notes || '';

                case 'MonthsPregnant':
                    const monthsQuery = `
                    SELECT TOP 1 MonthsPregnant
                    FROM PregancyCheck pc
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                    const monthsResult = await request.query(monthsQuery);
                    return monthsResult.recordset[0]?.MonthsPregnant || '';

                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error fetching PregancyCheck value for ${fieldName}:`, error);
            return '';
        }
    }

    async getWeightRecordsValue(cowTag, fieldName) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            switch (fieldName) {
                case 'CurrentWeight':
                    // Get weight from LastWeightRecord ID
                    const weightQuery = `
                        SELECT w.Weight 
                        FROM CowTable c
                        INNER JOIN WeightRecords w ON c.LastWeightRecord = w.ID
                        WHERE c.CowTag = @cowTag`;
                    const weightResult = await request.query(weightQuery);
                    return weightResult.recordset[0]?.Weight || '';

                case 'LastWeightDate':
                    // Get date from LastWeightRecord ID
                    const dateQuery = `
                        SELECT w.TimeRecorded 
                        FROM CowTable c
                        INNER JOIN WeightRecords w ON c.LastWeightRecord = w.ID
                        WHERE c.CowTag = @cowTag`;
                    const dateResult = await request.query(dateQuery);
                    return dateResult.recordset[0]?.TimeRecorded || '';

                case 'Latest':
                    // Most recent weight regardless of LastWeightRecord field
                    const latestQuery = `
                        SELECT TOP 1 Weight
                        FROM WeightRecords 
                        WHERE CowTag = @cowTag
                        ORDER BY TimeRecorded DESC`;
                    const latestResult = await request.query(latestQuery);
                    return latestResult.recordset[0]?.Weight || '';

                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error fetching WeightRecords value for ${fieldName}:`, error);
            return '';
        }
    }

    async getMedicalTableValue(cowTag, fieldName) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            switch (fieldName) {
                case 'Vaccinations':
                    // All immunizations - JOIN with Medicines table
                    const vaccinationQuery = `
                        SELECT mt.TreatmentMedicine, mt.TreatmentDate
                        FROM MedicalTable mt
                        INNER JOIN Medicines m ON mt.TreatmentMedicine = m.Medicine
                        WHERE mt.CowTag = @cowTag AND m.IsImmunization = 1
                        ORDER BY mt.TreatmentDate DESC`;
                    const vaccinationResult = await request.query(vaccinationQuery);
                    return vaccinationResult.recordset
                        .map(v => `${v.TreatmentMedicine} (${v.TreatmentDate ? v.TreatmentDate.toLocaleDateString() : 'No Date'})`)
                        .join(', ') || 'None';

                case 'AllTreatments':
                    // All treatments with dates
                    const allTreatmentsQuery = `
                        SELECT TreatmentMedicine, TreatmentDate
                        FROM MedicalTable 
                        WHERE CowTag = @cowTag AND TreatmentMedicine IS NOT NULL
                        ORDER BY TreatmentDate DESC`;
                    const allTreatmentsResult = await request.query(allTreatmentsQuery);
                    return allTreatmentsResult.recordset
                        .map(t => `${t.TreatmentMedicine} (${t.TreatmentDate ? t.TreatmentDate.toLocaleDateString() : 'No Date'})`)
                        .join(', ') || 'None';

                case 'UniqueTreatments':
                    // Most recent of each unique treatment
                    const uniqueQuery = `
                        SELECT TreatmentMedicine, MAX(TreatmentDate) AS LatestDate
                        FROM MedicalTable 
                        WHERE CowTag = @cowTag AND TreatmentMedicine IS NOT NULL
                        GROUP BY TreatmentMedicine
                        ORDER BY LatestDate DESC`;
                    const uniqueResult = await request.query(uniqueQuery);
                    return uniqueResult.recordset
                        .map(t => `${t.TreatmentMedicine} (${t.LatestDate ? t.LatestDate.toLocaleDateString() : 'No Date'})`)
                        .join(', ') || 'None';

                case 'RecentIssues':
                    // Unresolved issues
                    const issuesQuery = `
                        SELECT IssueDescription, IssueObservationDate
                        FROM MedicalTable 
                        WHERE CowTag = @cowTag AND Issue = 1 AND IssueResolved = 0
                        ORDER BY IssueObservationDate DESC`;
                    const issuesResult = await request.query(issuesQuery);
                    return issuesResult.recordset
                        .map(i => `${i.IssueDescription} (${i.IssueObservationDate ? i.IssueObservationDate.toLocaleDateString() : 'No Date'})`)
                        .join(', ') || 'None';

                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error fetching MedicalTable value for ${fieldName}:`, error);
            return '';
        }
    }

    async getHerdsValue(cowTag, fieldName) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            switch (fieldName) {
                case 'CurrentPasture':
                    const pastureQuery = `
                        SELECT h.CurrentPasture
                        FROM CowTable c
                        LEFT JOIN Herds h ON c.CurrentHerd = h.HerdName
                        WHERE c.CowTag = @cowTag`;
                    const pastureResult = await request.query(pastureQuery);
                    return pastureResult.recordset[0]?.CurrentPasture || '';

                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error fetching Herds value for ${fieldName}:`, error);
            return '';
        }
    }


    calculateAge(dateOfBirth) {
        try {
            if (!dateOfBirth) return '';

            // Handle various date formats
            let birthDate;
            if (typeof dateOfBirth === 'string') {
                birthDate = new Date(dateOfBirth);
            } else if (dateOfBirth instanceof Date) {
                birthDate = dateOfBirth;
            } else {
                return '';
            }

            // Check if date is valid
            if (isNaN(birthDate.getTime())) {
                return '';
            }

            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            // Adjust age if birthday hasn't occurred this year
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            return age.toString();
        } catch (error) {
            console.error('Error calculating age:', error);
            return '';
        }
    }

    calculatePregnancyMonths(pregCheckDate, isPregnant) {
        try {
            if (!isPregnant || !pregCheckDate) return '';

            // Handle various date formats
            let checkDate;
            if (typeof pregCheckDate === 'string') {
                checkDate = new Date(pregCheckDate);
            } else if (pregCheckDate instanceof Date) {
                checkDate = pregCheckDate;
            } else {
                return '';
            }

            // Check if date is valid
            if (isNaN(checkDate.getTime())) {
                return '';
            }

            const today = new Date();
            const timeDiff = today.getTime() - checkDate.getTime();
            const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
            const monthsDiff = Math.floor(daysDiff / 30.44); // Average days per month

            // Return 0 if negative (future date) or if more than typical gestation
            if (monthsDiff < 0 || monthsDiff > 12) {
                return '0';
            }

            return monthsDiff.toString();
        } catch (error) {
            console.error('Error calculating pregnancy months:', error);
            return '';
        }
    }

    async getCalculatedValue(cowTag, fieldName) {
        try {
            switch (fieldName) {
                case 'Age':
                    const basicInfo = await this.getCowTableValue(cowTag, 'DateOfBirth');
                    return this.calculateAge(basicInfo);

                case 'PregnancyMonths':
                    const pregCheck = await this.getPregancyCheckValue(cowTag, 'IsPregnant');
                    const pregDate = await this.getPregancyCheckValue(cowTag, 'PregCheckDate');
                    return this.calculatePregnancyMonths(pregDate, pregCheck === 'Yes');

                case 'OpenStatus':
                    const isPregnant = await this.getPregancyCheckValue(cowTag, 'IsPregnant');
                    return isPregnant === 'Yes' ? 'No' : 'Yes';

                case 'CullStatus':
                    const status = await this.getCowTableValue(cowTag, 'Status');
                    return status === 'Cull' ? 'Yes' : 'No';

                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error calculating value for ${fieldName}:`, error);
            return '';
        }
    }

    async getSheetDataDynamic(params) {
        const { sheetId, herdName, breedingYear, sheetName } = params;

        try {
            // 1. Get sheet definition
            const sheetDef = await this.getSheetDefinition({ sheetId });
            const columnConfig = JSON.parse(sheetDef.columns);

            // 2. Get cow list based on sheet type and filters
            const cowList = await this.getCowListForSheet(herdName, sheetName, breedingYear);

            // 3. For each cow, get all column values
            const sheetData = [];
            for (const cowTag of cowList) {
                const rowData = { CowTag: cowTag };

                for (const column of columnConfig.columns) {
                    rowData[column.key] = await this.getColumnValue(cowTag, column.dataPath, breedingYear);
                }
                sheetData.push(rowData);
            }

            // 4. Add sheet-specific columns
            const enhancedColumns = await this.addSheetSpecificColumns(columnConfig.columns, sheetName);

            // 5. Build update handlers
            const updateHandlers = {};
            enhancedColumns.forEach(col => {
                if (col.updateHandler) {
                    updateHandlers[col.key] = col.updateHandler;
                }
            });

            return {
                columns: enhancedColumns,
                data: sheetData,
                updateHandlers: updateHandlers
            };
        } catch (error) {
            console.error('Error loading dynamic sheet data:', error);
            throw error;
        }
    }

    async getCowListForSheet(herdName, sheetName, breedingYear) {
        await this.ensureConnection();

        try {
            let query = '';
            const request = this.pool.request();

            if (sheetName === 'PregCheck') {
                // Only cows with breeding records for the current year
                query = `
                SELECT DISTINCT c.CowTag
                FROM CowTable c
                INNER JOIN BreedingRecords br ON c.CowTag = br.CowTag
                INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
                WHERE bp.PlanYear = @breedingYear
                  AND ${STATUS_ACTIVE}
                  ${herdName && herdName !== 'All active' ? 'AND c.CurrentHerd = @herdName' : ''}
                ORDER BY c.CowTag`;

                request.input('breedingYear', sql.Int, breedingYear);
                if (herdName && herdName !== 'All active') {
                    request.input('herdName', sql.NVarChar, herdName);
                }
            } else if (sheetName === 'CalvingTracker') {
                // Only cows with breeding records for the current year
                query = `
                SELECT DISTINCT c.CowTag
                FROM CowTable c
                INNER JOIN BreedingRecords br ON c.CowTag = br.CowTag
                INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
                WHERE bp.PlanYear = @breedingYear
                  AND ${STATUS_ACTIVE}
                  ${herdName && herdName !== 'All active' ? 'AND c.CurrentHerd = @herdName' : ''}
                ORDER BY c.CowTag`;

                request.input('breedingYear', sql.Int, breedingYear);
                if (herdName && herdName !== 'All active') {
                    request.input('herdName', sql.NVarChar, herdName);
                }
            } else if (sheetName === 'Weanlings') {
                // Only calves born in current and previous year
                query = `
                SELECT CowTag
                FROM CowTable
                WHERE YEAR(DateOfBirth) IN (@currentYear, @previousYear)
                  AND ${STATUS_ACTIVE}
                  ${herdName && herdName !== 'All active' ? 'AND CurrentHerd = @herdName' : ''}
                ORDER BY CowTag`;

                request.input('currentYear', sql.Int, breedingYear);
                request.input('previousYear', sql.Int, breedingYear - 1);
                if (herdName && herdName !== 'All active') {
                    request.input('herdName', sql.NVarChar, herdName);
                }
            } else {
                // Default behavior for other sheets
                return await this.getCowListForHerd(herdName);
            }

            const result = await request.query(query);
            return result.recordset.map(r => r.CowTag);
        } catch (error) {
            console.error('Error fetching cow list for sheet:', error);
            throw error;
        }
    }

    async getColumnValue(cowTag, dataPath, breedingYear = null) {
        const [source, fieldName] = dataPath.split('/');

        try {
            switch (source) {
                case 'CowTable':
                    return await this.getCowTableValue(cowTag, fieldName);
                case 'WeightRecords':
                    return await this.getWeightRecordsValue(cowTag, fieldName);
                case 'MedicalTable':
                    return await this.getMedicalTableValue(cowTag, fieldName);
                case 'BreedingRecords':
                    return await this.getBreedingRecordsValue(cowTag, fieldName, breedingYear);
                case 'PregancyCheck':
                    return await this.getPregancyCheckValue(cowTag, fieldName, breedingYear);
                case 'CalvingRecords':
                    return await this.getCalvingRecordsValue(cowTag, fieldName);
                case 'Herds':
                    return await this.getHerdsValue(cowTag, fieldName);
                case 'Calculated':
                    return await this.getCalculatedValue(cowTag, fieldName, breedingYear);
                case 'Fillable':
                    return await this.getFillableValue(cowTag, fieldName);
                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error getting column value for ${dataPath}:`, error);
            return '';
        }
    }

    async getBreedingRecordsValue(cowTag, fieldName, breedingYear = null) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            let yearFilter = '';
            if (breedingYear) {
                request.input('breedingYear', sql.Int, breedingYear);
                yearFilter = `
                INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
                WHERE br.CowTag = @cowTag AND bp.PlanYear = @breedingYear`;
            } else {
                yearFilter = 'WHERE br.CowTag = @cowTag';
            }

            switch (fieldName) {
                case 'PrimaryBull':
                    const primaryQuery = `
                    SELECT TOP 1 PrimaryBull
                    FROM BreedingRecords br
                    ${yearFilter}
                    ORDER BY ExposureStartDate DESC`;
                    const primaryResult = await request.query(primaryQuery);
                    return primaryResult.recordset[0]?.PrimaryBull || '';

                // ... other cases remain the same
                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error fetching BreedingRecords value for ${fieldName}:`, error);
            return '';
        }
    }

    async getCalculatedValue(cowTag, fieldName, breedingYear = null) {
        try {
            switch (fieldName) {
                case 'ExpectedDeliveryDate':
                    return await this.calculateExpectedDeliveryDate(cowTag, breedingYear);

                case 'BreedingStatus':
                    return await this.calculateBreedingStatus(cowTag, breedingYear);

                // ... other existing cases
                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error calculating value for ${fieldName}:`, error);
            return '';
        }
    }

    async getSheetDataDynamic(params) {
        const { sheetId, herdName, breedingYear, sheetName } = params;

        try {
            // 1. Get sheet definition
            const sheetDef = await this.getSheetDefinition({ sheetId });
            const columnConfig = JSON.parse(sheetDef.columns);

            // 2. Get cow list based on sheet type and filters
            const cowList = await this.getCowListForSheet(herdName, sheetName, breedingYear);

            // 3. For each cow, get all column values
            const sheetData = [];
            for (const cowTag of cowList) {
                const rowData = { CowTag: cowTag };

                for (const column of columnConfig.columns) {
                    rowData[column.key] = await this.getColumnValue(cowTag, column.dataPath, breedingYear);
                }
                sheetData.push(rowData);
            }

            const enhancedColumns = columnConfig.columns;

            // 5. Build update handlers - FIX THIS SECTION
            const updateHandlers = {};
            enhancedColumns.forEach(col => {
                if (col.updateHandler) {
                    updateHandlers[col.key] = col.updateHandler;
                    console.log(`Added update handler: ${col.key} -> ${col.updateHandler}`);
                }
            });

            // Add debug logging
            console.log('Final updateHandlers:', updateHandlers);
            console.log('Enhanced columns with handlers:', enhancedColumns.filter(col => col.updateHandler));

            return {
                columns: enhancedColumns,
                data: sheetData,
                updateHandlers: updateHandlers
            };
        } catch (error) {
            console.error('Error loading dynamic sheet data:', error);
            throw error;
        }
    }


    async calculateExpectedDeliveryDate(cowTag, breedingYear) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            if (breedingYear) {
                request.input('breedingYear', sql.Int, breedingYear);
            }

            // First check if we have pregnancy check with months pregnant
            const pregQuery = `
            SELECT TOP 1 pc.MonthsPregnant, pc.PregCheckDate, br.ExposureStartDate
            FROM PregancyCheck pc
            INNER JOIN BreedingRecords br ON pc.BreedingRecordID = br.ID
            ${breedingYear ? 'INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID' : ''}
            WHERE pc.CowTag = @cowTag AND pc.IsPregnant = 1
            ${breedingYear ? 'AND bp.PlanYear = @breedingYear' : ''}
            ORDER BY pc.PregCheckDate DESC`;

            const pregResult = await request.query(pregQuery);

            if (pregResult.recordset.length > 0) {
                const record = pregResult.recordset[0];

                if (record.MonthsPregnant) {
                    // Calculate based on pregnancy check date and months pregnant
                    const checkDate = new Date(record.PregCheckDate);
                    const remainingMonths = 9 - record.MonthsPregnant;
                    checkDate.setMonth(checkDate.getMonth() + remainingMonths);
                    return checkDate.toISOString().split('T')[0];
                } else if (record.ExposureStartDate) {
                    // Default to 9 months from breeding start
                    const breedingDate = new Date(record.ExposureStartDate);
                    breedingDate.setMonth(breedingDate.getMonth() + 9);
                    return breedingDate.toISOString().split('T')[0];
                }
            }

            return '';
        } catch (error) {
            console.error('Error calculating expected delivery date:', error);
            return '';
        }
    }

    async updatePregCheckDate(cowTag, value, breedingYear = null) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('checkDate', sql.Date, value);

            let query;
            
            if (breedingYear) {
                // Update for specific breeding year
                request.input('breedingYear', sql.Int, breedingYear);
                query = `
                UPDATE pc 
                SET PregCheckDate = @checkDate
                FROM PregancyCheck pc
                INNER JOIN BreedingRecords br ON pc.BreedingRecordID = br.ID
                INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
                WHERE pc.CowTag = @cowTag AND bp.PlanYear = @breedingYear
                AND pc.ID = (
                    SELECT TOP 1 pc2.ID 
                    FROM PregancyCheck pc2
                    INNER JOIN BreedingRecords br2 ON pc2.BreedingRecordID = br2.ID
                    INNER JOIN BreedingPlan bp2 ON br2.PlanID = bp2.ID
                    WHERE pc2.CowTag = @cowTag AND bp2.PlanYear = @breedingYear
                    ORDER BY pc2.PregCheckDate DESC
                )`;
            } else {
                // Update most recent pregnancy check
                query = `
                UPDATE PregancyCheck 
                SET PregCheckDate = @checkDate
                WHERE CowTag = @cowTag AND ID = (
                    SELECT TOP 1 ID FROM PregancyCheck 
                    WHERE CowTag = @cowTag 
                    ORDER BY PregCheckDate DESC
                )`;
            }

            const result = await request.query(query);
            console.log('updatePregCheckDate result:', result.rowsAffected);
            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error updating pregnancy check date:', error);
            throw error;
        }
    }

    async updatePregancyResult(cowTag, value, breedingYear) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('breedingYear', sql.Int, breedingYear);
            request.input('isPregnant', sql.Bit, value === 'Pregnant');

            // Find breeding record for the specific plan year
            const breedingQuery = `
            SELECT TOP 1 br.ID 
            FROM BreedingRecords br
            INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
            WHERE br.CowTag = @cowTag AND bp.PlanYear = @breedingYear
            ORDER BY br.ExposureStartDate DESC`;
            
            const breedingResult = await request.query(breedingQuery);

            if (breedingResult.recordset.length === 0) {
                throw new Error(`No breeding record found for ${cowTag} in year ${breedingYear}`);
            }

            const breedingRecordId = breedingResult.recordset[0].ID;

            // Check if pregnancy check already exists
            const existingPregRequest = this.pool.request();
            existingPregRequest.input('cowTag', sql.NVarChar, cowTag);
            existingPregRequest.input('breedingRecordId', sql.Int, breedingRecordId);

            const existingPregQuery = `
            SELECT ID FROM PregancyCheck 
            WHERE CowTag = @cowTag AND BreedingRecordID = @breedingRecordId`;
            const existingPregResult = await existingPregRequest.query(existingPregQuery);

            if (existingPregResult.recordset.length > 0) {
                // Update existing record
                const updateRequest = this.pool.request();
                updateRequest.input('cowTag', sql.NVarChar, cowTag);
                updateRequest.input('breedingRecordId', sql.Int, breedingRecordId);
                updateRequest.input('isPregnant', sql.Bit, value === 'Pregnant');

                const updateQuery = `
                UPDATE PregancyCheck 
                SET IsPregnant = @isPregnant, PregCheckDate = GETDATE()
                WHERE CowTag = @cowTag AND BreedingRecordID = @breedingRecordId`;
                await updateRequest.query(updateQuery);
            } else {
                // Create new record with explicit NULL EventID
                const insertRequest = this.pool.request();
                insertRequest.input('cowTag', sql.NVarChar, cowTag);
                insertRequest.input('breedingRecordId', sql.Int, breedingRecordId);
                insertRequest.input('isPregnant', sql.Bit, value === 'Pregnant');
                insertRequest.input('eventId', sql.Int, null); // Explicitly set to NULL

                const insertQuery = `
                INSERT INTO PregancyCheck (EventID, CowTag, BreedingRecordID, IsPregnant, PregCheckDate)
                VALUES (@eventId, @cowTag, @breedingRecordId, @isPregnant, GETDATE())`;
                await insertRequest.query(insertQuery);
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating pregnancy result:', error);
            throw error;
        }
    }

    async updateMonthsPregnant(cowTag, value) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('monthsPregnant', sql.Decimal(4, 2), parseFloat(value) || null);

            const query = `
            UPDATE PregancyCheck 
            SET MonthsPregnant = @monthsPregnant
            WHERE CowTag = @cowTag AND ID = (
                SELECT TOP 1 ID FROM PregancyCheck 
                WHERE CowTag = @cowTag 
                ORDER BY PregCheckDate DESC
            )`;

            await request.query(query);
            return { success: true };
        } catch (error) {
            console.error('Error updating months pregnant:', error);
            throw error;
        }
    }

    async updateFetusSex(cowTag, value) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('fetusSex', sql.NVarChar, value);

            const query = `
            UPDATE PregancyCheck 
            SET FetusSeX = @fetusSex
            WHERE CowTag = @cowTag AND ID = (
                SELECT TOP 1 ID FROM PregancyCheck 
                WHERE CowTag = @cowTag 
                ORDER BY PregCheckDate DESC
            )`;

            await request.query(query);
            return { success: true };
        } catch (error) {
            console.error('Error updating fetus sex:', error);
            throw error;
        }
    }

    async updatePregCheckWeight(cowTag, value) {
        await this.ensureConnection();

        try {
            const weightValue = parseInt(value);
            if (!weightValue || weightValue <= 0) {
                // Allow clearing the weight by setting WeightRecordID to NULL
                const clearRequest = this.pool.request();
                clearRequest.input('cowTag', sql.NVarChar, cowTag);
                
                const clearQuery = `
                UPDATE PregancyCheck 
                SET WeightRecordID = NULL
                WHERE CowTag = @cowTag AND ID = (
                    SELECT TOP 1 ID FROM PregancyCheck 
                    WHERE CowTag = @cowTag 
                    ORDER BY PregCheckDate DESC
                )`;
                await clearRequest.query(clearQuery);
                return { success: true };
            }

            // Find the pregnancy check record
            const pregRequest = this.pool.request();
            pregRequest.input('cowTag', sql.NVarChar, cowTag);
            
            const pregQuery = `
            SELECT TOP 1 ID, WeightRecordID
            FROM PregancyCheck 
            WHERE CowTag = @cowTag 
            ORDER BY PregCheckDate DESC`;
            const pregResult = await pregRequest.query(pregQuery);

            if (pregResult.recordset.length === 0) {
                throw new Error(`No pregnancy check found for ${cowTag}`);
            }

            const pregCheckId = pregResult.recordset[0].ID;
            const existingWeightRecordId = pregResult.recordset[0].WeightRecordID;

            let weightRecordId;

            if (existingWeightRecordId) {
                // Update existing weight record
                const updateWeightRequest = this.pool.request();
                updateWeightRequest.input('weightRecordId', sql.Int, existingWeightRecordId);
                updateWeightRequest.input('weight', sql.Int, weightValue);

                const updateWeightQuery = `
                UPDATE WeightRecords 
                SET Weight = @weight, TimeRecorded = GETDATE()
                WHERE ID = @weightRecordId`;
                await updateWeightRequest.query(updateWeightQuery);
                
                weightRecordId = existingWeightRecordId;
            } else {
                // Create new weight record
                const createWeightRequest = this.pool.request();
                createWeightRequest.input('cowTag', sql.NVarChar, cowTag);
                createWeightRequest.input('weight', sql.Int, weightValue);

                const createWeightQuery = `
                INSERT INTO WeightRecords (CowTag, Weight, TimeRecorded, EventID)
                OUTPUT INSERTED.ID
                VALUES (@cowTag, @weight, GETDATE(), NULL)`;
                const weightResult = await createWeightRequest.query(createWeightQuery);
                
                weightRecordId = weightResult.recordset[0].ID;

                // Link the weight record to the pregnancy check
                const linkWeightRequest = this.pool.request();
                linkWeightRequest.input('pregCheckId', sql.Int, pregCheckId);
                linkWeightRequest.input('weightRecordId', sql.Int, weightRecordId);

                const linkWeightQuery = `
                UPDATE PregancyCheck 
                SET WeightRecordID = @weightRecordId
                WHERE ID = @pregCheckId`;
                await linkWeightRequest.query(linkWeightQuery);
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating pregnancy check weight:', error);
            throw error;
        }
    }

    async updatePregCheckNotes(cowTag, value) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('notes', sql.Text, value);

            const query = `
            UPDATE PregancyCheck 
            SET Notes = @notes
            WHERE CowTag = @cowTag AND ID = (
                SELECT TOP 1 ID FROM PregancyCheck 
                WHERE CowTag = @cowTag 
                ORDER BY PregCheckDate DESC
            )`;

            await request.query(query);
            return { success: true };
        } catch (error) {
            console.error('Error updating pregnancy check notes:', error);
            throw error;
        }
    }


    /**
     * Get breeding animal status categorized by age and breeding records
     */
    async getBreedingAnimalStatus() {
        await this.ensureConnection();

        try {
            // Get current breeding plan year
            const currentPlanQuery = `
                SELECT TOP 1 ID, PlanYear 
                FROM BreedingPlan 
                WHERE IsActive = 1 
                ORDER BY PlanYear DESC`;
            const planResult = await this.pool.request().query(currentPlanQuery);
            const currentPlanId = planResult.recordset[0]?.ID;
            const currentYear = planResult.recordset[0]?.PlanYear || new Date().getFullYear();


            const request = this.pool.request();
            request.input('currentPlanId', sql.Int, currentPlanId);

            // Main query to categorize all active animals
            const query = `
                SELECT 
                    c.CowTag,
                    c.Sex,
                    c.DateOfBirth,
                    c.Description,
                    c.CurrentHerd,
                    c.Castrated,
                    c.Status,
                    DATEDIFF(month, c.DateOfBirth, GETDATE()) AS AgeInMonths,
                    CASE WHEN wr.ID IS NOT NULL THEN 1 ELSE 0 END AS HasWeaningRecord,
                    CASE WHEN br.ID IS NOT NULL THEN 1 ELSE 0 END AS HasCurrentBreedingRecord,
                    CASE 
                        -- Bulls: Male and not castrated (Castrated = 0 or NULL)
                        WHEN (c.Sex = 'Bull' OR (c.Sex = 'Male' AND (c.Castrated IS NULL OR c.Castrated = 0))) THEN 'bull'
                        
                        -- Female categorization
                        WHEN c.Sex = 'Female' THEN
                            CASE 
                                -- Calves: Female, < 12 months, no weaning record
                                WHEN DATEDIFF(month, c.DateOfBirth, GETDATE()) < 12 AND wr.ID IS NULL THEN 'calf'
                                
                                -- Yearlings: Female, < 24 months, AND (> 12 months OR has weaning record)
                                WHEN DATEDIFF(month, c.DateOfBirth, GETDATE()) < 24 
                                    AND (DATEDIFF(month, c.DateOfBirth, GETDATE()) >= 12 OR wr.ID IS NOT NULL) THEN 'yearling'
                                
                                -- Assigned cows: Female, >= 24 months, has breeding record for current plan
                                WHEN DATEDIFF(month, c.DateOfBirth, GETDATE()) >= 24 AND br.ID IS NOT NULL THEN 'assigned-cow'
                                
                                -- Unassigned cows: Female, >= 24 months, no breeding record for current plan
                                WHEN DATEDIFF(month, c.DateOfBirth, GETDATE()) >= 24 AND br.ID IS NULL THEN 'unassigned-cow'
                                
                                ELSE 'unknown-female'
                            END
                        ELSE 'other'
                    END AS Category
                FROM CowTable c
                LEFT JOIN WeaningRecords wr ON c.CowTag = wr.CowTag
                LEFT JOIN BreedingRecords br ON c.CowTag = br.CowTag AND br.PlanID = @currentPlanId
                WHERE ${STATUS_ACTIVE}
                ORDER BY c.CowTag`;

            const result = await request.query(query);
            
            
            // Group results by category
            const categorized = {
                bulls: [],
                calfs: [],
                yearlings: [],
                'assigned-cow': [],
                'unassigned-cows': []
            };

            result.recordset.forEach(animal => {
                const category = animal.Category;

                if (category === 'bull') {
                    categorized.bulls.push(animal);
                } else if (category === 'calf') {
                    categorized.calfs.push(animal);
                } else if (category === 'yearling') {
                    categorized.yearlings.push(animal);
                } else if (category === 'assigned-cow') {
                    categorized['assigned-cow'].push(animal);
                } else if (category === 'unassigned-cow') {
                    categorized['unassigned-cows'].push(animal);
                }
            });

            // console.log('Categorized results:', {
            //     bulls: categorized.bulls.length,
            //     calfs: categorized.calfs.length,
            //     yearlings: categorized.yearlings.length,
            //     'assigned-cow': categorized['assigned-cow'].length,
            //     'unassigned-cows': categorized['unassigned-cows'].length
            // });

            return {
                currentPlanYear: currentYear,
                currentPlanId: currentPlanId,
                bulls: categorized.bulls,
                calfs: categorized.calfs,
                yearlings: categorized.yearlings,
                'assigned-cow': categorized['assigned-cow'],
                'unassigned-cows': categorized['unassigned-cows']
            };
        } catch (error) {
            console.error('Error fetching breeding animal status:', error);
            throw error;
        }
    }

    async findBreedingRecordForDam(damTag, breedingYear) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('damTag', sql.NVarChar, damTag);
            request.input('breedingYear', sql.Int, breedingYear);
            // console.log(`Binding damTag: [${damTag}] length: ${damTag.length}`);
            // console.log(`Binding breedingYear: [${breedingYear}]`);

            const query = `
            SELECT TOP 1 br.ID
            FROM BreedingRecords br
            INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
            WHERE br.CowTag = @damTag AND bp.PlanYear = @breedingYear
            ORDER BY br.ExposureStartDate DESC`;
            
            const result = await request.query(query);
            // console.log("findBreedingRecordForDam returned:", { result });
            return result.recordset[0]?.ID || null;
        } catch (error) {
            console.error('Error finding breeding record:', error);
            return null;
        }
    }

    async assignBreedingRecords(params) {
        const { planId, primaryBull, cowTags, exposureStartDate, exposureEndDate, cleanupBull, pasture } = params;
        await this.ensureConnection();

        try {
            const results = [];

            for (const cowTag of cowTags) {
                const request = this.pool.request();
                request.input('planId', sql.Int, planId);
                request.input('cowTag', sql.NVarChar, cowTag);
                request.input('primaryBull', sql.NVarChar, primaryBull);
                request.input('cleanupBull', sql.NVarChar, cleanupBull || null);
                request.input('exposureStartDate', sql.DateTime, new Date(exposureStartDate));
                request.input('exposureEndDate', sql.DateTime, new Date(exposureEndDate));
                request.input('pasture', sql.NVarChar, pasture || null);
                request.input('isAI', sql.Bit, false); // Default to natural breeding

                const query = `
                    INSERT INTO BreedingRecords (
                        PlanID, CowTag, PrimaryBull, CleanupBull, IsAI, 
                        ExposureStartDate, ExposureEndDate, Pasture
                    ) VALUES (
                        @planId, @cowTag, @primaryBull, @cleanupBull, @isAI,
                        @exposureStartDate, @exposureEndDate, @pasture
                    )`;

                await request.query(query);
                results.push({ cowTag, success: true });
            }

            return { success: true, results, assignedCount: results.length };
        } catch (error) {
            console.error('Error assigning breeding records:', error);
            throw error;
        }
    }

    async updateBreedingStatus(cowTag, value, breedingYear) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('breedingYear', sql.Int, breedingYear);
            request.input('isPregnant', sql.Bit, value === 'Pregnant');

            // Find breeding record for the specific plan year
            const breedingQuery = `
            SELECT TOP 1 br.ID 
            FROM BreedingRecords br
            INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
            WHERE br.CowTag = @cowTag AND bp.PlanYear = @breedingYear
            ORDER BY br.ExposureStartDate DESC`;
            
            const breedingResult = await request.query(breedingQuery);

            if (breedingResult.recordset.length === 0) {
                throw new Error(`No breeding record found for ${cowTag} in year ${breedingYear}`);
            }

            const breedingRecordId = breedingResult.recordset[0].ID;

            if (value === 'Pregnant' || value === 'Open') {
                // Update or insert pregnancy check without EventID
                const mergeRequest = this.pool.request();
                mergeRequest.input('cowTag', sql.NVarChar, cowTag);
                mergeRequest.input('breedingRecordId', sql.Int, breedingRecordId);
                mergeRequest.input('isPregnant', sql.Bit, value === 'Pregnant');

                const mergeQuery = `
                MERGE PregancyCheck AS target
                USING (SELECT @cowTag AS CowTag, @breedingRecordId AS BreedingRecordID) AS source
                ON (target.CowTag = source.CowTag AND target.BreedingRecordID = source.BreedingRecordID)
                WHEN MATCHED THEN
                    UPDATE SET IsPregnant = @isPregnant, PregCheckDate = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (CowTag, BreedingRecordID, IsPregnant, PregCheckDate, EventID)
                    VALUES (@cowTag, @breedingRecordId, @isPregnant, GETDATE(), NULL);`;

                await mergeRequest.query(mergeQuery);
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating breeding status:', error);
            throw error;
        }
    }

    async addCalvingNote(cowTag, value, breedingYear) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('breedingYear', sql.Int, breedingYear);
            request.input('calvingNotes', sql.NVarChar(sql.MAX), value);

            // Find the calving record for this cow and breeding year
            const query = `
            UPDATE cr 
            SET CalvingNotes = @calvingNotes
            FROM CalvingRecords cr
            INNER JOIN BreedingRecords br ON cr.BreedingRecordID = br.ID
            INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
            WHERE cr.DamTag = @cowTag AND bp.PlanYear = @breedingYear`;

            const result = await request.query(query);
            
            if (result.rowsAffected[0] === 0) {
                throw new Error(`No calving record found for ${cowTag} in year ${breedingYear}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating calving notes:', error);
            throw error;
        }
    }

    async updateWeaningStatus(cowTag, value, breedingYear) {
        await this.ensureConnection();

        try {
            if (value === 'Weaned') {
                // Create weaning record if it doesn't exist
                const request = this.pool.request();
                request.input('cowTag', sql.NVarChar, cowTag);
                request.input('weaningDate', sql.DateTime, new Date());

                const checkQuery = `
                SELECT COUNT(*) as Count 
                FROM WeaningRecords 
                WHERE CowTag = @cowTag`;
                const checkResult = await request.query(checkQuery);

                if (checkResult.recordset[0].Count === 0) {
                    const insertQuery = `
                    INSERT INTO WeaningRecords (CowTag, WeaningDate)
                    VALUES (@cowTag, @weaningDate)`;
                    await request.query(insertQuery);
                }
            } else if (value === 'Unweaned') {
                // Remove weaning record
                const request = this.pool.request();
                request.input('cowTag', sql.NVarChar, cowTag);
                
                const deleteQuery = `
                DELETE FROM WeaningRecords 
                WHERE CowTag = @cowTag`;
                await request.query(deleteQuery);
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating weaning status:', error);
            throw error;
        }
    }


    async getFillableValue(cowTag, fieldName) {
        // Fillable fields always return empty string for user input
        return '';
    }

    /**
     * AVAILABLE COLUMNS
     */
    async getAvailableColumns() {
        try {
            // Helper functions for auto-configuration
            const getFieldType = (dataPath) => {
                if (dataPath.includes('Date')) return 'date';
                if (dataPath.includes('Weight') || dataPath.includes('Months')) return 'number';
                if (dataPath.includes('IsPregnant') || dataPath.includes('Sex') || 
                    dataPath.includes('Status') || dataPath.includes('Genotype') || 
                    dataPath.includes('Temperament')) return 'select';
                if (dataPath.includes('Notes') || dataPath.includes('Description')) return 'text';
                return 'text';
            };

            const getUpdateHandler = (dataPath) => {
                const handlerMap = {
                    'PregancyCheck/IsPregnant': 'updatePregancyResult',
                    'PregancyCheck/FetusSeX': 'updateFetusSex', 
                    'PregancyCheck/WeightAtCheck': 'updatePregCheckWeight',
                    'PregancyCheck/Notes': 'updatePregCheckNotes',
                    'PregancyCheck/MonthsPregnant': 'updateMonthsPregnant',
                    'WeightRecords/Latest': 'recordNewWeight',
                    'CalvingRecords/CalfSex': 'updateCalfSex',
                    'CalvingRecords/CalvingNotes': 'addCalvingNote'
                };
                return handlerMap[dataPath] || null;
            };

            const getFieldOptions = (dataPath) => {
                const optionsMap = {
                    'PregancyCheck/IsPregnant': ['', 'Pregnant', 'Open'],
                    'PregancyCheck/FetusSeX': ['', 'Heifer', 'Bull'],
                    'CalvingRecords/CalfSex': ['', 'Heifer', 'Bull'],
                    'CowTable/Sex': ['', 'Cow', 'Bull', 'Steer', 'Heifer'],
                    'CowTable/Status': ['', 'Current', 'Target Sale', 'Undefined', 'Cull'],
                };
                return optionsMap[dataPath] || [];
            };

            const isEditable = (dataPath) => {
                // All Fillable/ paths are editable
                if (dataPath.startsWith('Fillable/')) return true;
                
                // Specific editable fields from your existing sheets
                const editableFields = [
                    'PregancyCheck/IsPregnant',
                    'PregancyCheck/FetusSeX', 
                    'PregancyCheck/WeightAtCheck',
                    'PregancyCheck/Notes',
                    'PregancyCheck/MonthsPregnant',
                    'CalvingRecords/CalfSex',
                    'CalvingRecords/CalvingNotes',
                    'WeightRecords/Latest'
                ];
                
                return editableFields.includes(dataPath);
            };

            const generateKey = (name, path) => {
                // Convert name to lowercase key with underscores
                return name.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
            };

            // Base column definitions
            const baseColumns = [
                // CowTable direct fields
                { name: 'CowTag', path: 'CowTable/CowTag' },
                { name: 'Dam Tag', path: 'CowTable/Dam' },
                { name: 'Sire Tag', path: 'CowTable/Sire' },
                { name: 'Sex', path: 'CowTable/Sex' },
                { name: 'Date of Birth', path: 'CowTable/DateOfBirth' },
                { name: 'Current Herd', path: 'CowTable/CurrentHerd' },
                { name: 'Description', path: 'CowTable/Description' },
                { name: 'Genotype', path: 'CowTable/Genotype' },
                { name: 'Temperament', path: 'CowTable/Temperament' },
                { name: 'Status', path: 'CowTable/Status' },
                { name: 'RegCert', path: 'CowTable/RegCert' },

                // Weight records
                { name: 'Current Weight', path: 'WeightRecords/CurrentWeight' },
                { name: 'Last Weight Date', path: 'WeightRecords/LastWeightDate' },
                { name: 'Latest Weight', path: 'WeightRecords/Latest' },

                // Medical records
                { name: 'Vaccinations', path: 'MedicalTable/Vaccinations' },
                { name: 'All Treatments', path: 'MedicalTable/AllTreatments' },
                { name: 'Unique Treatments', path: 'MedicalTable/UniqueTreatments' },
                { name: 'Recent Issues', path: 'MedicalTable/RecentIssues' },

                // Breeding records
                { name: 'Primary Bull', path: 'BreedingRecords/PrimaryBull' },
                { name: 'Cleanup Bull', path: 'BreedingRecords/CleanupBull' },
                { name: 'Current Bull', path: 'BreedingRecords/CurrentBull' },
                { name: 'Exposure Start Date', path: 'BreedingRecords/ExposureStartDate' },
                { name: 'Exposure End Date', path: 'BreedingRecords/ExposureEndDate' },

                // Pregnancy checks
                { name: 'Is Pregnant', path: 'PregancyCheck/IsPregnant' },
                { name: 'Pregnancy Check Date', path: 'PregancyCheck/PregCheckDate' },
                { name: 'Fetus Sex', path: 'PregancyCheck/FetusSeX' },
                { name: 'Months Pregnant', path: 'PregancyCheck/MonthsPregnant' },
                { name: 'Pregnancy Weight', path: 'PregancyCheck/WeightAtCheck' },
                { name: 'Pregnancy Notes', path: 'PregancyCheck/Notes' },

                // Calving records
                { name: 'Calf Sex', path: 'CalvingRecords/CalfSex' },
                { name: 'Calf Birth Date', path: 'CalvingRecords/BirthDate' },
                { name: 'Calving Notes', path: 'CalvingRecords/CalvingNotes' },

                // Herd information
                { name: 'Current Pasture', path: 'Herds/CurrentPasture' },

                // Calculated fields
                { name: 'Age', path: 'Calculated/Age' },
                { name: 'Age in Months', path: 'Calculated/AgeInMonths' },
                { name: 'Pregnancy Months', path: 'Calculated/PregnancyMonths' },
                { name: 'Open Status', path: 'Calculated/OpenStatus' },
                { name: 'Cull Status', path: 'Calculated/CullStatus' },
                { name: 'Breeding Status', path: 'Calculated/BreedingStatus' },
                { name: 'Weaning Status', path: 'Calculated/WeaningStatus' },

                // Fillable fields
                { name: 'Notes', path: 'Fillable/Notes' },
                { name: 'New Weight', path: 'Fillable/NewWeight' },
                { name: 'Date', path: 'Fillable/Date' },
                { name: 'Extra Notes', path: 'Fillable/ExtraNotes' },
                { name: 'Cull Prospect', path: 'Fillable/CullProspect' }
            ];

            // Enhanced columns with auto-configuration
            const enhancedColumns = baseColumns.map(col => {
                const type = getFieldType(col.path);
                const editable = isEditable(col.path);
                const updateHandler = getUpdateHandler(col.path);
                const options = getFieldOptions(col.path);
                
                return {
                    key: generateKey(col.name, col.path),
                    name: col.name,
                    dataPath: col.path,
                    editable: editable,
                    type: type,
                    ...(options.length > 0 && { options: options }),
                    ...(updateHandler && { updateHandler: updateHandler })
                };
            });

            return { columns: enhancedColumns };
        } catch (error) {
            console.error('Error getting available columns:', error);
            throw error;
        }
    }
}


// Export singleton instance
const dbOps = new DatabaseOperations();


module.exports = {
    fetchCowData: (params) => dbOps.fetchCowData(params),
    fetchCowEpds: (params) => dbOps.fetchCowEpds(params),
    addObservation: (params) => dbOps.addObservation(params),
    updateCowWeight: (params) => dbOps.updateCowWeight(params),
    addCow: (params) => dbOps.addCow(params),
    getAllCows: (params) => dbOps.getAllCows(params),
    setHerd: (params) => dbOps.setHerd(params),


    // Medical records
    fetchCowMedicalRecords: (params) => dbOps.fetchCowMedicalRecords(params),
    createMedicalRecord: (params) => dbOps.addMedicalRecord(params),
    getMedicalRecordDetails: (params) => dbOps.getMedicalRecordDetails(params),
    updateMedicalRecord: (params) => dbOps.updateMedicalRecord(params),
    resolveIssue: (params) => dbOps.resolveIssue(params),
    getMedicines: (params) => dbOps.getMedicines(params),
    addMedicine: (params) => dbOps.addMedicine(params),

    // Pasture & feed activity
    getAllPastures: () => dbOps.getAllPastures(),
    addFeedType: (params) => dbOps.addFeedType(params),
    getHerdFeedStatus: (params) => dbOps.getHerdFeedStatus(params),
    getAllFeedTypes: () => dbOps.getAllFeedTypes(),
    recordFeedActivity: (params) => dbOps.recordFeedActivity(params),
    getPastureMaintenanceEvents: (params) => dbOps.getPastureMaintenanceEvents(params),
    addPastureMaintenanceEvent: (params) => dbOps.addPastureMaintenanceEvent(params),

    // Herd Managment
    getAllHerds: () => dbOps.getAllHerds(),
    getAllHerdsWithDetails: () => dbOps.getAllHerdsWithDetails(),
    getHerdAnimals: (params) => dbOps.getHerdAnimals(params),
    moveHerdToPasture: (params) => dbOps.moveHerdToPasture(params),
    getHerdEvents: (params) => dbOps.getHerdEvents(params),
    addHerdEvent: (params) => dbOps.addHerdEvent(params),
    createHerd: (params) => dbOps.createHerd(params),
    batchMoveCows: (params) => dbOps.batchMoveCows(params),
    getCowsByHerd: () => dbOps.getCowsByHerd(),

    // sheet management
    getAllSheetsFromDB: () => dbOps.getAllSheetsFromDB(),
    getSheetDefinition: (sheetId) => dbOps.getSheetDefinition(sheetId),
    createSheetInDB: (params) => dbOps.createSheetInDB(params),
    updateSheetInDB: (params) => dbOps.updateSheetInDB(params),
    deleteSheetFromDB: (sheetId) => dbOps.deleteSheetFromDB(sheetId),

    // Users
    getUserPreferences: (params) => dbOps.getUserPreferences(params),
    updateUserPreferences: (params) => dbOps.updateUserPreferences(params),


    // Dynamic sheet data & updaters
    getSheetDataDynamic: (params) => dbOps.getSheetDataDynamic(params),
    getAvailableColumns: () => dbOps.getAvailableColumns(),
    getColumnValue: (cowTag, dataPath) => dbOps.getColumnValue(cowTag, dataPath),
    updateSheetCell: (params) => dbOps.updateSheetCell(params),
    batchUpdateSheetCells: (params) => dbOps.batchUpdateSheetCells(params),
    getFormDropdownData: () => dbOps.getFormDropdownData(), 
    getCowListForHerd: (herdName) => dbOps.getCowListForHerd(herdName),
    generateTagSuggestions: (params) => dbOps.generateTagSuggestions(params),
    recordBatchWeights: (params) => dbOps.recordBatchWeights(params),


    // Breeding Plan
    getBreedingPlans: () => dbOps.getBreedingPlans(),
    getBreedingPlanOverview: (params) => dbOps.getBreedingPlanOverview(params),
    getBreedingAnimalStatus: () => dbOps.getBreedingAnimalStatus(),
    getHerdBreedingCandidates: (params) => dbOps.getHerdBreedingCandidates(params),
    assignBreedingRecords: (params) => dbOps.assignBreedingRecords(params),
    updateBreedingStatus: (params) => dbOps.updateBreedingStatus(params.cowTag, params.value, params.breedingYear),
    findBreedingRecordForDam: (damTag, breedingYear) => dbOps.findBreedingRecordForDam(damTag, breedingYear),

    // Pregnancy Check updaters
    submitPregancyCheck: (params) => dbOps.submitPregancyCheck(params),
    updatePregancyResult: (params) => dbOps.updatePregancyResult(params.cowTag, params.value, params.breedingYear),
    updateFetusSex: (params) => dbOps.updateFetusSex(params.cowTag, params.value, params.breedingYear),
    updatePregCheckWeight: (params) => dbOps.updatePregCheckWeight(params.cowTag, params.value, params.breedingYear),
    updatePregCheckNotes: (params) => dbOps.updatePregCheckNotes(params.cowTag, params.value, params.breedingYear),
    updatePregCheckDate: (params) => dbOps.updatePregCheckDate(params.cowTag, params.value),
    updateMonthsPregnant: (params) => dbOps.updateMonthsPregnant(params.cowTag, params.value, params.breedingYear),

    // Calving Tracker
    addCalvingNote: (params) => dbOps.addCalvingNote(params.cowTag, params.value, params.breedingYear),
    getCalvingStatus: (params) => dbOps.getCalvingStatus(params),
    addCalvingRecord: (params) => dbOps.addCalvingRecord(params),
    generateCalfTag: (params) => dbOps.generateCalfTag(params),
    calculateGenotypeFromParents: (damTag, sireTag) => dbOps.calculateGenotypeFromParents(damTag, sireTag),
    addCowWithCalfHandling: (params) => dbOps.addCowWithCalfHandling(params),

    // Weaning Tracker & updaters
    updateWeaningStatus: (params) => dbOps.updateWeaningStatus(params.cowTag, params.value, params.breedingYear),
    recordWeaning: (params) => dbOps.recordWeaning(params),
    getWeaningCandidates: (params) => dbOps.getWeaningCandidates(params),
};