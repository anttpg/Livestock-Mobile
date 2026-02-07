/* eslint-disable no-case-declarations */
const { sql, pool } = require('./db');


// Shorthand to get active animals
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
     * Get dropdown options for forms
     */
    async getFormDropdownData() {
        await this.ensureConnection();

        try {
            const queries = {
                breeds: `SELECT Breed FROM Breed ORDER BY Breed`,
                sexes: `SELECT Sex FROM Sex ORDER BY Sex`,
                animalClasses: `SELECT AnimalClass FROM AnimalClass ORDER BY AnimalClass`,
                goatTypes: `SELECT Type FROM GoatTypes ORDER BY Type`,

                temperaments: `SELECT Temperament FROM Temperament ORDER BY Temperament`,
                statuses: `SELECT Status FROM Status ORDER BY Status`,
                regCerts: `SELECT RegCertStatus FROM RegCert ORDER BY RegCertStatus`,

                herds: `SELECT HerdName FROM Herds ORDER BY HerdName`,
                pastureFeedOptions: `SELECT Feed FROM PastureFeedOptions ORDER BY Feed`,
                pastureFeedUnits: `SELECT FeedUnit FROM FeedUnits ORDER BY FeedUnit`,

                dewormerClasses: `SELECT DewormerClass FROM DewormerClass ORDER BY DewormerClass`,
                medicineClasses: `SELECT MedicineClass FROM MedicineClass ORDER BY MedicineClass`,
                MedicineApplicationMethods: `SELECT MedicineApplicationMethod FROM MedicineApplicationMethods ORDER BY MedicineApplicationMethod`,
                medicines: `SELECT BrandName FROM Medicines ORDER BY BrandName`,

                pregTestResults: `SELECT Result FROM PregTestResult ORDER BY Result`,

                paymentMethods: `SELECT PaymentMethod FROM PaymentMethods ORDER BY PaymentMethod`,
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
     * Add a new option to a dropdown option
     */
    async addFormDropdownData(params) {
        await this.ensureConnection();

        const { table, value } = params;

        const allowedTables = {
            Breed: 'Breed',
            AnimalClass: 'AnimalClass',
            GoatTypes: 'Type',
            Temperament: 'Temperament',
            PastureFeedOptions: 'Feed',
            FeedUnits: 'FeedUnit',
            DewormerClass: 'DewormerClass',
            MedicineClass: 'MedicineClass',
            MedicineApplicationMethods: 'MedicineApplicationMethod'
        };

        // Validate table
        if (!allowedTables[table]) {
            throw new Error(`Invalid table specified: Tried to add "${value}" to table "${table}". Allowed tables: ${Object.keys(allowedTables).join(', ')}`);
        }

        if (!value || value.trim() === '') {
            throw new Error(`Value cannot be empty for table "${table}"`);
        }

        const column = allowedTables[table];

        try {
            // Insert new value (Fails if already exists)
            const insertQuery = `INSERT INTO ${table} (${column}) VALUES (@value)`;
            await this.pool.request()
                .input('value', value.trim())
                .query(insertQuery);

            return { success: true, message: `Successfully added "${value}" to ${table}` };
        } catch (error) {
            console.error('Error adding dropdown data:', error);
            throw new Error(`Failed to add dropdown data to table "${table}" with value "${value}": ${error.message}`);
        }
    }



    /**
     * Add new cow with all fields for AddAnimal form
     * @param {Object} params - All CowTable fields
     */
    async addCow(params) {
        const {
            cowTag, dateOfBirth, description, dam, sire, sex, status,
            currentHerd, breed, temperament, regCert, regCertNumber,
            birthweight, animalClass, targetPrice, origin
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
            request.input('breed', sql.NVarChar, breed || null);
            request.input('temperament', sql.NVarChar, temperament || null);
            request.input('regCert', sql.NVarChar, regCert || null);
            request.input('regCertNumber', sql.NVarChar, regCertNumber || null);
            request.input('birthweight', sql.NVarChar, birthweight || null);
            request.input('animalClass', sql.NVarChar, animalClass || null);
            request.input('targetPrice', sql.Money, targetPrice || null);
            // request.input('origin', sql.NVarChar, origin || null);

            const query = `
                INSERT INTO CowTable (
                    CowTag, DateOfBirth, Description, [Dam (Mother)], [Sire (Father)],
                    Sex, Status, CurrentHerd, Breed, Temperament, RegCert, RegCertNumber,
                    Birthweight, AnimalClass, TargetPrice, SaleRecordID
                ) VALUES (
                    @cowTag, @dateOfBirth, @description, @dam, @sire,
                    @sex, @status, @currentHerd, @breed, @temperament, @regCert, @regCertNumber,
                    @birthweight, @animalClass, @targetPrice, NULL
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
     * Add cow with calf-specific handling
     * Enhanced to handle twins and calving records
     */
    async addCowWithCalfHandling(params) {
        const {
            // Basic cow data
            cowTag, dateOfBirth, description, dam, sire, sex, status,
            currentHerd, breed, temperament, regCert, regCertNumber,
            birthweight, animalClass, targetPrice, origin,
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
                request.input('breed', sql.NVarChar, breed || null);
                request.input('temperament', sql.NVarChar, temperament || null);
                request.input('regCert', sql.NVarChar, regCert || null);
                request.input('regCertNumber', sql.NVarChar, regCertNumber || null);
                request.input('birthweight', sql.NVarChar, birthweight || null);
                request.input('animalClass', sql.NVarChar, animalClass || null);
                request.input('targetPrice', sql.Money, targetPrice || null);
                //request.input('origin', sql.NVarChar, origin || null); DISABLED FOR NOW...

                const insertQuery = `
                    INSERT INTO CowTable (
                        CowTag, DateOfBirth, Description, [Dam (Mother)], [Sire (Father)],
                        Sex, Status, CurrentHerd, Breed, Temperament, RegCert, RegCertNumber,
                        Birthweight, AnimalClass, TargetPrice 
                    ) VALUES (
                        @cowTag, @dateOfBirth, @description, @dam, @sire,
                        @sex, @status, @currentHerd, @breed, @temperament, @regCert, @regCertNumber,
                        @birthweight, @animalClass, @targetPrice
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
                            twinCowRequest.input('breed', sql.NVarChar, breed || null);
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
     * Get all cows
     */
    async getAllCows() {
        await this.ensureConnection();
        try {
            const result = await this.pool.request().query(
                'SELECT CowTag FROM CowTable ORDER BY CowTag'
            );
            return result.recordset;
        } catch (error) {
            console.error('Error fetching all cows:', error);
            throw new Error(`Failed to fetch cows: ${error.message}`);
        }
    }



    /**
     * Get all cow table data for a specific cow
     * @param {string} cowTag - The cow's tag identifier
     * @returns {Promise<Object|null>}
     */
    async getCowTableData(cowTag) {
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            
            const query = `
                SELECT 
                    c.*,
                    c.[Dam (Mother)] AS Dam,
                    c.[Sire (Father)] AS Sire,
                    h.CurrentPasture AS PastureName,
                    CASE 
                        WHEN c.Status IS NULL OR c.Status IN ('Current', 'Target Sale', 'Undefined', 'CULL LIST, Current')
                        THEN CAST(1 AS BIT)
                        ELSE CAST(0 AS BIT)
                    END AS IsActive
                FROM 
                    CowTable c
                    LEFT JOIN Herds h ON c.CurrentHerd = h.HerdName
                WHERE 
                    c.CowTag = @cowTag`;
            
            const result = await request.query(query);
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error fetching cow table data:', error);
            throw new Error(`Failed to fetch cow table data: ${error.message}`);
        }
    }

    /**
     * Update cow table data
     * @param {Object} params - { cowTag, updates: {field: value, ...} }
     * @returns {Promise<{success: boolean}>}
     */
    async updateCowTableData(params) {
        const { cowTag, updates } = params;
        await this.ensureConnection();

        try {
            // Build SET updates object
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            
            const setClauses = [];
            for (const [field, value] of Object.entries(updates)) {
                const paramName = field;
                
                // Validate types
                if (['Castrated'].includes(field)) {
                    request.input(paramName, sql.Bit, value);
                } else if (['DateOfBirth', 'DateOfDeath', 'WeaningDate'].includes(field)) {
                    request.input(paramName, sql.DateTime2, value ? new Date(value) : null);
                } else if (['TargetPrice', 'SalePrice', 'PurchasePrice'].includes(field)) {
                    request.input(paramName, sql.Money, value);
                } else if (['SaleRecordID', 'PurchaseRecordID', 'WeightAtSale'].includes(field)) {
                    request.input(paramName, sql.Int, value);
                } else {
                    request.input(paramName, sql.NVarChar, value);
                }
                
                setClauses.push(`[${field}] = @${paramName}`);
            }

            if (setClauses.length === 0) {
                return { success: true }; // Nothing to update
            }

            const query = `
                UPDATE CowTable 
                SET ${setClauses.join(', ')}
                WHERE CowTag = @cowTag`;

            const result = await request.query(query);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Cow not found');
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating cow table data:', error);
            throw new Error(`Failed to update cow table data: ${error.message}`);
        }
    }


        
    /**
     * Returns true if the given tag exists in CowTable
     *  @param {*} params 
     */
    async cowTagExists(params) {

    }


    /**
     * Renames the given animal
     *  @param {*} cowTag newTag
     */
    async renameCow(params) {
        // The following columns need to be checked & renamed per table:

        /**
         * [BreedingRecords] CowTag, PrimaryBulls, CleanupBulls {NOTE: PrimaryBulls, CleanupBulls are JSON lists}
         * [CowTable]; CowTag, DamTag, SireTag
         * [CalvingRecords] CalfTag, DamTag
         * [DNATestRecords] CalfTag, ConfirmedSire, PossibleSires {NOTE: PossibleSires is a JSON list}
         * [EPDRecords] CowTag
         * [HerdMembershipHistory] CowTag
         * [MedicalTable] CowTag
         * [Notes] CowTag
         * [PregancyCheck] CowTag
         * [SheetInstances] TODO, NEED TO DETERMINE HOW TO CHANGE ROWDATA, LOG WARNING THAT THIS IS INCOMPLETE
         * [WeaningRecords] CowTag
         * [WeightRecords] CowTag
         */
    }







    /**
     * Get notes for a cow
     * @param {string} cowTag - The cow's tag identifier
     * @returns {Promise<Array>}
     */
    async getNotes(params) {
        const { cowTag } = params;
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar(sql.MAX), cowTag);
            
            const query = `
                SELECT 
                    NoteID,
                    DateOfEntry,
                    Username,
                    CowTag,
                    Note,
                    DateOfLastUpdate,
                    NeedsFollowUp,
                    Archive,
                    SSMA_TimeStamp
                FROM 
                    Notes 
                WHERE 
                    CowTag = @cowTag
                ORDER BY DateOfEntry DESC`;
            
            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching notes:', error);
            throw new Error(`Failed to fetch notes: ${error.message}`);
        }
    }

    /**
     * Add a new note
     * @param {Object} params - { cowTag, note, dateOfEntry (optional) }
     * @returns {Promise<{success: boolean, noteId: number}>}
     */
    async addNote(params) {
        const { cowTag, note, dateOfEntry, username } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('note', sql.NVarChar(sql.MAX), note);
            request.input('dateOfEntry', sql.DateTime, dateOfEntry);
            request.input('cowTag', sql.NVarChar(sql.MAX), cowTag);
            request.input('username', sql.NVarChar(sql.MAX), username)

            const query = `
                INSERT INTO Notes (Note, DateOfEntry, CowTag, Username)
                OUTPUT INSERTED.NoteID
                VALUES (@note, @dateOfEntry, @cowTag, @username)`;

            const result = await request.query(query);
            return {
                success: true,
                rowsAffected: result.rowsAffected[0],
                noteId: result.recordset[0].NoteID,
                message: 'Observation added successfully'
            };
        } catch (error) {
            console.error('Error adding observation:', error);
            throw new Error(`Failed to add observation: ${error.message}`);
        }
    }

    /**
     * Update an existing note
     * @param {Object} params - { noteId, note, archive }
     * @returns {Promise<{success: boolean}>}
     */
    async updateNote(params) {
        const { noteId, note, archive } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('noteId', sql.Int, noteId);
            
            // Build update query dynamically based on what's being updated
            let updateFields = [];
            
            if (note !== undefined) {
                request.input('note', sql.NVarChar(sql.MAX), note);
                updateFields.push('Note = @note');
            }
            
            if (archive !== undefined) {
                request.input('archive', sql.Bit, archive);
                updateFields.push('Archive = @archive');
            }
            
            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            const query = `
                UPDATE Notes 
                SET ${updateFields.join(', ')}, DateOfLastUpdate = GETDATE()
                WHERE NoteID = @noteId`;

            const result = await request.query(query);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Note not found');
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating note:', error);
            throw new Error(`Failed to update note: ${error.message}`);
        }
    }

    /**
     * Delete a note
     * @param {Object} params - { noteId }
     * @returns {Promise<{success: boolean}>}
     */
    async deleteNote(params) {
        const { noteId } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('noteId', sql.Int, noteId);

            const query = `
                DELETE FROM Notes 
                WHERE NoteID = @noteId`;

            const result = await request.query(query);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Note not found');
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting note:', error);
            throw new Error(`Failed to delete note: ${error.message}`);
        }
    }








    /**
     * Get offspring/calves for a cow
     * @param {string} cowTag - The cow's tag identifier
     * @returns {Promise<Array>}
     */
    async getOffspring(cowTag) {
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            
            const query = `
                SELECT DISTINCT
                    c.CowTag AS CalfTag, 
                    c.DateOfBirth AS DOB,
                    c.Sex,
                    c.[Sire (Father)] AS SireTag,
                    c.Breed,
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
            
            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching offspring:', error);
            throw new Error(`Failed to fetch offspring: ${error.message}`);
        }
    }





    /**
     * Create a new weight record
     * @param {Object} params - { cowTag, weight, date (optional), eventId (optional), notes (optional) }
     * @returns {Promise<{success: boolean, recordId: number}>}
     */
    async createWeightRecord(params) {
        const { cowTag, weight, date = null, eventId = null, notes = null } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('weight', sql.Int, parseInt(weight));
            request.input('timeRecorded', sql.DateTime, date ? new Date(date) : new Date());
            request.input('eventId', sql.Int, eventId);
            request.input('notes', sql.Text, notes);

            const query = `
                INSERT INTO WeightRecords (CowTag, Weight, TimeRecorded, EventID, Notes)
                OUTPUT INSERTED.ID
                VALUES (@cowTag, @weight, @timeRecorded, @eventId, @notes)`;

            const result = await request.query(query);

            return {
                success: true,
                recordId: result.recordset[0].ID
            };
        } catch (error) {
            console.error('Error creating weight record:', error);
            throw new Error(`Failed to create weight record: ${error.message}`);
        }
    }

    /**
     * Update an existing weight record
     * @param {Object} params - { recordId, weight, date (optional) }
     * @returns {Promise<{success: boolean}>}
     */
    async updateWeightRecord(params) {
        const { recordId, weight, date = null } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('recordId', sql.Int, recordId);
            request.input('weight', sql.Int, parseInt(weight));
            request.input('timeRecorded', sql.DateTime, date ? new Date(date) : new Date());

            const query = `
                UPDATE WeightRecords 
                SET Weight = @weight, TimeRecorded = @timeRecorded
                WHERE ID = @recordId`;

            const result = await request.query(query);

            if (result.rowsAffected[0] === 0) {
                throw new Error('Weight record not found');
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating weight record:', error);
            throw new Error(`Failed to update weight record: ${error.message}`);
        }
    }

    /**
     * Get the most recent weight for a cow
     * @param {string} cowTag - The cow's tag identifier
     * @returns {Promise<{weight: number|null, date: Date|null, formattedDate: string|null}>}
     */
    async getCurrentWeight(cowTag) {
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            
            const query = `
                SELECT TOP 1 
                    Weight, 
                    TimeRecorded AS WeightDate,
                    CONVERT(varchar, TimeRecorded, 120) AS FormattedDate
                FROM WeightRecords 
                WHERE CowTag = @cowTag
                ORDER BY TimeRecorded DESC`;
            
            const result = await request.query(query);
            
            if (result.recordset.length === 0) {
                return { weight: null, date: null, formattedDate: null };
            }
            
            return {
                weight: result.recordset[0].Weight,
                date: result.recordset[0].WeightDate,
                formattedDate: result.recordset[0].FormattedDate
            };
        } catch (error) {
            console.error('Error fetching current weight:', error);
            throw new Error(`Failed to fetch current weight: ${error.message}`);
        }
    }

    /**
     * Get a specific weight record by its ID
     * @param {number} recordId - The weight record ID
     * @returns {Promise<{weight: number|null, date: Date|null, cowTag: string|null}>}
     */
    async getWeightByRecordId(recordId) {
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('recordId', sql.Int, recordId);
            
            const query = `
                SELECT 
                    Weight, 
                    TimeRecorded AS WeightDate,
                    CowTag
                FROM WeightRecords 
                WHERE ID = @recordId`;
            
            const result = await request.query(query);
            
            if (result.recordset.length === 0) {
                return { weight: null, date: null, cowTag: null };
            }
            
            return {
                weight: result.recordset[0].Weight,
                date: result.recordset[0].WeightDate,
                cowTag: result.recordset[0].CowTag
            };
        } catch (error) {
            console.error('Error fetching weight by record ID:', error);
            throw new Error(`Failed to fetch weight by record ID: ${error.message}`);
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
                        br.PrimaryBulls as SireTag,
                        COUNT(DISTINCT cr.CalfTag) as ProgenyCount
                    FROM BreedingRecords br
                    INNER JOIN CalvingRecords cr ON br.ID = cr.BreedingRecordID
                    WHERE br.PrimaryBulls = @cowTag
                    GROUP BY br.PrimaryBulls
                    
                    UNION ALL
                    
                    -- Also count cleanup bull progeny
                    SELECT 
                        br.CleanupBulls as SireTag,
                        COUNT(DISTINCT cr.CalfTag) as ProgenyCount
                    FROM BreedingRecords br
                    INNER JOIN CalvingRecords cr ON br.ID = cr.BreedingRecordID
                    WHERE br.CleanupBulls = @cowTag
                    GROUP BY br.CleanupBulls
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
            // JOIN with Medicines table to get ApplicationMethod and derive IsImmunization from MedicineClass
            const issuesQuery = `
                SELECT 
                    mt.ID, mt.EventID, mt.CowTag,
                    mt.IssueDescription, mt.IssueObservedBy, mt.IssueObservationDate,
                    mt.IssueResolved, mt.IssueResolutionNote, mt.IssueResolutionDate, mt.IssueSerious,
                    m.ID as TreatmentMedicine, 
                    mt.TreatmentDate, mt.TreatmentResponse, 
                    m.ApplicationMethod as TreatmentMethod,
                    CASE WHEN m.MedicineClass = 'Vaccine' THEN 1 ELSE 0 END as IsImmunization,
                    mt.TreatmentIsActive,
                    mt.VetName, mt.VetComments, mt.Note
                FROM MedicalTable mt
                LEFT JOIN Medicines m ON mt.TreatmentMedicineID = m.ID
                WHERE mt.CowTag = @cowTag AND mt.Issue = 1
                ORDER BY mt.IssueObservationDate DESC, mt.IssueSerious DESC`;

            // Treatments query
            // JOIN with Medicines table to get ApplicationMethod and derive IsImmunization from MedicineClass
            const treatmentsQuery = `
                SELECT 
                    mt.ID, mt.EventID, mt.CowTag,
                    m.ID as TreatmentMedicine, 
                    mt.TreatmentDate, mt.TreatmentResponse, 
                    m.ApplicationMethod as TreatmentMethod,
                    CASE WHEN m.MedicineClass = 'Vaccine' THEN 1 ELSE 0 END as IsImmunization,
                    mt.TreatmentIsActive,
                    mt.VetName, mt.VetComments, mt.Note
                FROM MedicalTable mt
                LEFT JOIN Medicines m ON mt.TreatmentMedicineID = m.ID
                WHERE mt.CowTag = @cowTag AND mt.Treatment = 1
                ORDER BY mt.TreatmentDate DESC`;

            // Maintenance records query 
            const maintenanceQuery = `
                SELECT 
                    ID, EventID, CowTag, Note
                FROM MedicalTable 
                WHERE CowTag = @cowTag AND Maintenance = 1
                ORDER BY ID DESC`;

            // Vet visit query
            const vetQuery = `
                SELECT 
                    ID, EventID, CowTag,
                    VetName, VetComments, Note
                FROM MedicalTable 
                WHERE CowTag = @cowTag AND Vet = 1
                ORDER BY ID DESC`;

            const [issuesResult, treatmentsResult, maintenanceResult, vetResult] = await Promise.all([
                request.query(issuesQuery),
                request.query(treatmentsQuery),
                request.query(maintenanceQuery),
                request.query(vetQuery)
            ]);

            return {
                success: true,
                medicalRecords: {
                    issues: issuesResult.recordset,
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



























    
    //              MEDICAL RECORDS //////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Get all medicines, medicineClasses, and dewormerClasses
     */
    async getMedicines() {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            
            // Get all medicines
            const medicinesQuery = `SELECT * FROM Medicines ORDER BY ID ASC`;
            const medicinesResult = await request.query(medicinesQuery);
            
            // Get MedicineClass lookup
            const medicineClassQuery = `SELECT MedicineClass FROM MedicineClass ORDER BY MedicineClass ASC`;
            const medicineClassResult = await request.query(medicineClassQuery);
            
            // Get DewormerClass lookup
            const dewormerClassQuery = `SELECT DewormerClass FROM DewormerClass ORDER BY DewormerClass ASC`;
            const dewormerClassResult = await request.query(dewormerClassQuery);
            
            return {
                success: true,
                medicines: medicinesResult.recordset,
                medicineClasses: medicineClassResult.recordset,
                dewormerClasses: dewormerClassResult.recordset
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
        const { 
            medicineClass,
            dewormerClass,
            shorthand,
            genericName,
            brandName,
            manufacturer,
            applicationMethod,
            mixRecipe
        } = params;
        
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            // Convert empty strings to null for foreign key fields
            request.input('medicineClass', sql.NVarChar, medicineClass || null);
            request.input('dewormerClass', sql.NVarChar, dewormerClass || null);
            request.input('shorthand', sql.NVarChar, shorthand);
            request.input('genericName', sql.NVarChar, genericName);
            request.input('brandName', sql.NVarChar, brandName || null);
            request.input('manufacturer', sql.NVarChar, manufacturer || null);
            request.input('applicationMethod', sql.NVarChar, applicationMethod || null);
            request.input('mixRecipe', sql.NVarChar, mixRecipe || null);

            const query = `
                INSERT INTO Medicines (
                    MedicineClass, DewormerClass, Shorthand, 
                    GenericName, BrandName, Manufacturer, ApplicationMethod, MixRecipe
                )
                VALUES (
                    @medicineClass, @dewormerClass, @shorthand,
                    @genericName, @brandName, @manufacturer, @applicationMethod, @mixRecipe
                )`;

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
     * Update an existing medicine by MedicineID
     */
    async updateMedicine(params) {
        const { 
            medicineID,
            medicineClass,
            dewormerClass,
            shorthand,
            genericName,
            brandName,
            manufacturer,
            applicationMethod,
            mixRecipe
        } = params;
        
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('medicineID', sql.Int, medicineID);
            
            // Convert empty strings to null for foreign key fields and optional fields
            request.input('medicineClass', sql.NVarChar, medicineClass || null);
            request.input('dewormerClass', sql.NVarChar, dewormerClass || null);
            request.input('shorthand', sql.NVarChar, shorthand);
            request.input('genericName', sql.NVarChar, genericName);
            request.input('brandName', sql.NVarChar, brandName || null);
            request.input('manufacturer', sql.NVarChar, manufacturer || null);
            request.input('applicationMethod', sql.NVarChar, applicationMethod || null);
            request.input('mixRecipe', sql.NVarChar, mixRecipe || null);

            const query = `
                UPDATE Medicines 
                SET 
                    MedicineClass = @medicineClass,
                    DewormerClass = @dewormerClass,
                    Shorthand = @shorthand,
                    GenericName = @genericName,
                    BrandName = @brandName,
                    Manufacturer = @manufacturer,
                    ApplicationMethod = @applicationMethod,
                    MixRecipe = @mixRecipe
                WHERE ID = @medicineID`;

            const result = await request.query(query);
            
            return {
                success: true,
                rowsAffected: result.rowsAffected[0],
                message: result.rowsAffected[0] > 0 ? 'Medicine updated successfully' : 'Medicine not found'
            };
        } catch (error) {
            console.error('Error updating medicine:', error);
            throw new Error(`Failed to update medicine: ${error.message}`);
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
            treatmentMedicineID, treatmentDate, treatmentResponse, treatmentIsActive,
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
            request.input('issueResolved', sql.Bit, false);

            // Treatment fields
            const validMedicineID = treatmentMedicineID && treatmentMedicineID.trim() !== '' ? treatmentMedicineID : null;
            request.input('treatmentMedicineID', sql.NVarChar, validMedicineID);
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
                    TreatmentMedicineID, TreatmentDate, TreatmentResponse, TreatmentIsActive,
                    VetName, VetComments
                )
                OUTPUT INSERTED.ID
                VALUES (
                    @cowTag, @eventID, @note, @maintenance, @issue, @treatment, @vet,
                    @issueDescription, @issueObservedBy, @issueObservationDate, @issueSerious, @issueResolved,
                    @treatmentMedicineID, @treatmentDate, @treatmentResponse, @treatmentIsActive,
                    @vetName, @vetComments
                )`;

            const result = await request.query(query);
            return {
                success: true,
                recordID: result.recordset[0]?.ID,
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
                    mt.ID, mt.EventID, mt.CowTag, mt.Note,
                    mt.Maintenance, mt.Issue, mt.Treatment, mt.Vet,
                    mt.IssueDescription, mt.IssueObservedBy, mt.IssueObservationDate, 
                    mt.IssueResolved, mt.IssueResolutionNote, mt.IssueResolutionDate, mt.IssueSerious,
                    mt.TreatmentMedicineID, 
                    m.BrandName as TreatmentMedicine,
                    mt.TreatmentDate, mt.TreatmentResponse, mt.TreatmentIsActive,
                    mt.VetName, mt.VetComments
                FROM MedicalTable mt
                LEFT JOIN Medicines m ON mt.TreatmentMedicineID = m.ID
                WHERE mt.ID = @recordID`;

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

    /**
     * Update a medical record for a cow
     */
    async updateMedicalRecord(params) {
        const { recordID, ...updateFields } = params;
        await this.ensureConnection();

        try {
            if (Object.keys(updateFields).length === 0) {
                throw new Error('No fields provided for update');
            }

            // Helper to process date fields
            const processDate = (value) => 
                value instanceof Date || (typeof value === 'string' && value.trim() !== '') 
                    ? new Date(value) : null;

            // Map of field names to their processed values and SQL types
            const fieldMap = {
                IssueDescription: { value: updateFields.IssueDescription, type: sql.NText },
                IssueObservedBy: { value: updateFields.IssueObservedBy, type: sql.NVarChar },
                IssueObservationDate: { value: processDate(updateFields.IssueObservationDate), type: sql.DateTime },
                IssueSerious: { value: updateFields.IssueSerious, type: sql.Bit },
                TreatmentMedicineID: { value: updateFields.TreatmentMedicineID, type: sql.NVarChar },
                TreatmentDate: { value: processDate(updateFields.TreatmentDate), type: sql.DateTime },
                TreatmentResponse: { value: updateFields.TreatmentResponse, type: sql.NText },
                TreatmentIsActive: { value: updateFields.TreatmentIsActive, type: sql.Bit },
                VetName: { value: updateFields.VetName, type: sql.NVarChar },
                VetComments: { value: updateFields.VetComments, type: sql.NText },
                Note: { value: updateFields.Note, type: sql.NText }
            };

            const request = this.pool.request();
            request.input('recordID', sql.Int, recordID);

            const updateClauses = [];
            
            // Only add fields that were actually provided in updateFields
            Object.entries(fieldMap).forEach(([fieldName, { value, type }]) => {
                if (fieldName in updateFields) {
                    const paramName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
                    request.input(paramName, type, value);
                    updateClauses.push(`${fieldName} = @${paramName}`);
                }
            });

            if (updateClauses.length === 0) {
                throw new Error('No valid update clauses generated');
            }

            const query = `
                UPDATE MedicalTable 
                SET ${updateClauses.join(', ')}
                WHERE ID = @recordID`;

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

    /**
     * Mark an issue as resolved
     * @param {*} params 
     * @returns 
     */
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
                WHERE ID = @recordID AND Issue = 1`;

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
































    //              CUSTOMERS  //////////////////////////////////////////////////////////////////////////////////////////

    async addPaymentMethod(params) {
        const query = `
            INSERT INTO [PaymentMethods] ([PaymentMethod])
            VALUES (@paymentMethod)
        `;
        const request = this.pool.request();
        request.input('paymentMethod', sql.NVarChar, params.paymentMethod);
        await request.query(query);
    }


    async getCustomers() {
        const query = `
            SELECT [NameFirstLast]
                ,[Address]
                ,[City]
                ,[State]
                ,[Zip]
                ,[Phone]
                ,[Email]
                ,[DateAdded]
                ,[HasSoldTo]
                ,[HasPurchasedFrom]
                ,[SSMA_TimeStamp]
            FROM [Customers]
            ORDER BY [NameFirstLast]
        `;
        const result = await this.pool.request().query(query);
        return result.recordset;
    }


    async addCustomer(params) {
        const query = `
            INSERT INTO [Customers] 
            ([NameFirstLast], [Address], [City], [State], [Zip], [Phone], [Email], [DateAdded], [HasSoldTo], [HasPurchasedFrom])
            VALUES (@nameFirstLast, @address, @city, @state, @zip, @phone, @email, @dateAdded, @hasSoldTo, @hasPurchasedFrom)
        `;
        const request = this.pool.request();
        request.input('nameFirstLast', sql.NVarChar, params.NameFirstLast);
        request.input('address', sql.NVarChar, params.Address || null);
        request.input('city', sql.NVarChar, params.City || null);
        request.input('state', sql.NVarChar, params.State || null);
        request.input('zip', sql.NVarChar, params.Zip || null);
        request.input('phone', sql.NVarChar, params.Phone || null);
        request.input('email', sql.NVarChar, params.Email || null);
        request.input('dateAdded', sql.DateTime, params.DateAdded || new Date());
        request.input('hasSoldTo', sql.Bit, params.HasSoldTo || 0);
        request.input('hasPurchasedFrom', sql.Bit, params.HasPurchasedFrom || 0);
        await request.query(query);
    }


    async updateCustomer(params) {
        const query = `
            UPDATE [Customers]
            SET [Address] = @address,
                [City] = @city,
                [State] = @state,
                [Zip] = @zip,
                [Phone] = @phone,
                [Email] = @email,
                [HasSoldTo] = @hasSoldTo,
                [HasPurchasedFrom] = @hasPurchasedFrom
            WHERE [NameFirstLast] = @nameFirstLast
        `;
        const request = this.pool.request();
        request.input('nameFirstLast', sql.NVarChar, params.NameFirstLast);
        request.input('address', sql.NVarChar, params.Address);
        request.input('city', sql.NVarChar, params.City);
        request.input('state', sql.NVarChar, params.State);
        request.input('zip', sql.NVarChar, params.Zip);
        request.input('phone', sql.NVarChar, params.Phone);
        request.input('email', sql.NVarChar, params.Email);
        request.input('hasSoldTo', sql.Bit, params.HasSoldTo);
        request.input('hasPurchasedFrom', sql.Bit, params.HasPurchasedFrom);
        await request.query(query);
    }







    //              SALE/PURCHASE RECORDS   

    async getAllSales() {
        const query = `
            SELECT [ID]
                ,[Description]
                ,[SaleDate]
                ,[SalePrice]
                ,[PaymentMethod]
                ,[Customer]
                ,[Commission]
                ,[SaleNotes]
            FROM [SaleRecords]
            ORDER BY [SaleDate] DESC
        `;
        const result = await this.pool.request().query(query);
        return result.recordset;
    }


    async getSaleRecord(params) {
        const query = `
            SELECT [ID]
                ,[Description]
                ,[SaleDate]
                ,[SalePrice]
                ,[PaymentMethod]
                ,[Customer]
                ,[Commission]
                ,[SaleNotes]
            FROM [SaleRecords]
            WHERE [ID] = @id
        `;
        const request = this.pool.request();
        request.input('id', sql.Int, params.ID);
        const result = await request.query(query);
        return result.recordset[0];
    }


    async createSaleRecord(params) {
        const query = `
            INSERT INTO [SaleRecords]
            ([Description], [SaleDate], [SalePrice], [PaymentMethod], [Customer], [Commission], [SaleNotes])
            VALUES (@description, @saleDate, @salePrice, @paymentMethod, @customer, @commission, @saleNotes);
            SELECT SCOPE_IDENTITY() AS ID;
        `;
        const request = this.pool.request();
        request.input('description', sql.NVarChar, params.Description || null);
        request.input('saleDate', sql.DateTime, params.SaleDate || new Date());
        request.input('salePrice', sql.Decimal(18, 2), params.SalePrice || null);
        request.input('paymentMethod', sql.NVarChar, params.PaymentMethod || null);
        request.input('customer', sql.NVarChar, params.Customer || null);
        request.input('commission', sql.Decimal(18, 2), params.Commission || null);
        request.input('saleNotes', sql.NVarChar, params.SaleNotes || null);
        const result = await request.query(query);
        return result.recordset[0].ID;
    }


    async updateSaleRecord(params) {
        const query = `
            UPDATE [SaleRecords]
            SET [Description] = @description,
                [SaleDate] = @saleDate,
                [SalePrice] = @salePrice,
                [PaymentMethod] = @paymentMethod,
                [Customer] = @customer,
                [Commission] = @commission,
                [SaleNotes] = @saleNotes
            WHERE [ID] = @id
        `;
        const request = this.pool.request();
        request.input('id', sql.Int, params.ID);
        request.input('description', sql.NVarChar, params.Description);
        request.input('saleDate', sql.DateTime, params.SaleDate);
        request.input('salePrice', sql.Decimal(18, 2), params.SalePrice);
        request.input('paymentMethod', sql.NVarChar, params.PaymentMethod);
        request.input('customer', sql.NVarChar, params.Customer);
        request.input('commission', sql.Decimal(18, 2), params.Commission);
        request.input('saleNotes', sql.NVarChar, params.SaleNotes);
        await request.query(query);
    }



    async getAllPurchases() {
        const query = `
            SELECT [ID]
                ,[Description]
                ,[PurchaseDate]
                ,[PurchasePrice]
                ,[PaymentMethod]
                ,[Origin]
                ,[PurchaseNotes]
            FROM [PurchaseRecords]
            ORDER BY [PurchaseDate] DESC
        `;
        const result = await this.pool.request().query(query);
        return result.recordset;
    }

    async getPurchaseRecord(params) {
        const query = `
            SELECT [ID]
                ,[Description]
                ,[PurchaseDate]
                ,[PurchasePrice]
                ,[PaymentMethod]
                ,[Origin]
                ,[PurchaseNotes]
            FROM [PurchaseRecords]
            WHERE [ID] = @id
        `;
        const request = this.pool.request();
        request.input('id', sql.Int, params.ID);
        const result = await request.query(query);
        return result.recordset[0];
    }

    async createPurchaseRecord(params) {
        const query = `
            INSERT INTO [PurchaseRecords]
            ([Description], [PurchaseDate], [PurchasePrice], [PaymentMethod], [Origin], [PurchaseNotes])
            VALUES (@description, @purchaseDate, @purchasePrice, @paymentMethod, @origin, @purchaseNotes);
            SELECT SCOPE_IDENTITY() AS ID;
        `;
        const request = this.pool.request();
        request.input('description', sql.NVarChar, params.Description || null);
        request.input('purchaseDate', sql.DateTime, params.PurchaseDate || new Date());
        request.input('purchasePrice', sql.Decimal(18, 2), params.PurchasePrice || null);
        request.input('paymentMethod', sql.NVarChar, params.PaymentMethod || null);
        request.input('origin', sql.NVarChar, params.Origin || null);
        request.input('purchaseNotes', sql.NVarChar, params.PurchaseNotes || null);
        const result = await request.query(query);
        return result.recordset[0].ID;
    }

    async updatePurchaseRecord(params) {
        const query = `
            UPDATE [PurchaseRecords]
            SET [Description] = @description,
                [PurchaseDate] = @purchaseDate,
                [PurchasePrice] = @purchasePrice,
                [PaymentMethod] = @paymentMethod,
                [Origin] = @origin,
                [PurchaseNotes] = @purchaseNotes
            WHERE [ID] = @id
        `;
        const request = this.pool.request();
        request.input('id', sql.Int, params.ID);
        request.input('description', sql.NVarChar, params.Description);
        request.input('purchaseDate', sql.DateTime, params.PurchaseDate);
        request.input('purchasePrice', sql.Decimal(18, 2), params.PurchasePrice);
        request.input('paymentMethod', sql.NVarChar, params.PaymentMethod);
        request.input('origin', sql.NVarChar, params.Origin);
        request.input('purchaseNotes', sql.NVarChar, params.PurchaseNotes);
        await request.query(query);
    }



    /**
     * Returns all the related accounting records for a cow
     * @param {*} cowTag 
     */
    async getCowAccounting(params) {
        // get the cow's accounting data
        const cowQuery = `
            SELECT [CowTag]
                ,[TargetPrice]
                ,[SalePrice]
                ,[SaleRecordID]
                ,[WeightAtSale]
                ,[ReasonAnimalSold]
                ,[PurchasePrice]
                ,[PurchaseRecordID]
                ,[Status]
            FROM [CowTable]
            WHERE [CowTag] = @cowTag
        `;
        const request = this.pool.request();
        request.input('cowTag', sql.NVarChar, params.cowTag);
        const cowResult = await request.query(cowQuery);
        
        if (cowResult.recordset.length === 0) {
            return null;
        }
        
        const cowData = cowResult.recordset[0];
        
        // Get sale record if it exists
        let saleRecord = null;
        if (cowData.SaleRecordID) {
            const saleResult = await this.getSaleRecord({ ID: cowData.SaleRecordID });
            saleRecord = saleResult;
        }
        
        // Get purchase record if it exists
        let purchaseRecord = null;
        if (cowData.PurchaseRecordID) {
            const purchaseResult = await this.getPurchaseRecord({ ID: cowData.PurchaseRecordID });
            purchaseRecord = purchaseResult;
        }
        
        return {
            cowTag: cowData.CowTag,
            targetPrice: cowData.TargetPrice,
            cowSalePrice: cowData.SalePrice,  // Price recorded in CowTable
            saleRecordID: cowData.SaleRecordID,
            weightAtSale: cowData.WeightAtSale,
            reasonAnimalSold: cowData.ReasonAnimalSold,
            cowPurchasePrice: cowData.PurchasePrice,  // Price recorded in CowTable
            purchaseRecordID: cowData.PurchaseRecordID,
            status: cowData.Status,
            saleRecord: saleRecord,  // Full SaleRecord if exists
            purchaseRecord: purchaseRecord  // Full PurchaseRecord if exists
        };
    }




































    //              BREEDING PLAN  //////////////////////////////////////////////////////////////////////////////////////////

    async getBreedingPlans() {
        await this.ensureConnection();

        try {
            const query = `
            SELECT ID, PlanName, PlanYear, Notes, IsActive, PregSheetInstanceID, BreedingSheetInstanceID, CalvingSheetInstanceID
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
                        PlanID, CowTag, PrimaryBulls, CleanupBulls, IsAI, 
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
















    //              BREEDING RECORDS  //////////////////////////////////////////////////////////////////////////////////////////

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
                br.PrimaryBulls,
                br.CleanupBulls,
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

                // Create WeightRecord if weight provided
                let weightRecordId = null;
                if (record.weight) {
                    const result = await this.createWeightRecord({
                        cowTag: record.cowTag,
                        weight: record.weight,
                        date: date,
                        eventId: eventId
                    });
                    weightRecordId = result.recordId;
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
                COALESCE(br.PrimaryBulls, br.CleanupBulls) AS Bull,
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
            
            // Calculate breed if parents provided
            let calculatedBreed = null;
            if (damTag && sireTag) {
                calculatedBreed = await this.calculateBreedFromParents(damTag, sireTag);
            }

            return {
                suggestedTag,
                nextNumber,
                yearLetter,
                calculatedBreed,
                twinTag: `${nextNumber + 1}${yearLetter}` // Pre-calculate twin tag
            };
        } catch (error) {
            console.error('Error generating calf tag:', error);
            throw error;
        }
    }

    /**
     * Calculate breed from parent breeds
     * @param {string} damTag - Mother's tag
     * @param {string} sireTag - Father's tag
     */
    async calculateBreedFromParents(damTag, sireTag) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('damTag', sql.NVarChar, damTag);
            request.input('sireTag', sql.NVarChar, sireTag);

            const query = `
                SELECT 
                    (SELECT Breed FROM CowTable WHERE CowTag = @damTag) AS DamBreed,
                    (SELECT Breed FROM CowTable WHERE CowTag = @sireTag) AS SireBreed`;
            
            const result = await request.query(query);
            
            if (result.recordset.length === 0) {
                return null;
            }

            const { DamBreed, SireBreed } = result.recordset[0];
            
            if (!DamBreed || !SireBreed) {
                return null;
            }

            // Breed inheritance rules
            const isPurebred = (breed) => {
                return breed && (
                    breed.toLowerCase().includes('purebred') ||
                    !breed.toLowerCase().includes('cross') && !breed.toLowerCase().includes('f1')
                );
            };

            const damPurebred = isPurebred(DamBreed);
            const sirePurebred = isPurebred(SireBreed);

            // Both purebred same breed
            if (damPurebred && sirePurebred && DamBreed === SireBreed) {
                return DamBreed;
            }

            // Both purebred different breeds -> F1 cross
            if (damPurebred && sirePurebred && DamBreed !== SireBreed) {
                return `F1 ${DamBreed}-${SireBreed} Cross`;
            }

            // One F1, one purebred -> F2/F3 cross
            if (DamBreed.includes('F1') || SireBreed.includes('F1')) {
                return `${DamBreed} x ${SireBreed} Cross`;
            }

            // Default fallback
            return `${DamBreed} x ${SireBreed}`;
        } catch (error) {
            console.error('Error calculating breed:', error);
            return null;
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






































    //                  HERD MANAGMENT //////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Set a cow's herd
     */
    async setHerd(params) {
        const { cowTag, herdName } = params;
        await this.ensureConnection();

        try {
            // Update cow's herd
            const result = await this.pool.request()
                .input('cowTag', sql.NVarChar, cowTag)
                .input('herdName', sql.NVarChar, herdName)
                .query('UPDATE CowTable SET CurrentHerd = @herdName WHERE CowTag = @cowTag');

            if (result.rowsAffected[0] === 0) {
                throw new Error('Cow or Herd not found');
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

    /**
     * Get all herd names
     */
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
     * Get all animals in a specific herd. Default excludes inactive animals
     * @param {Object} params - { herdName, getInactive=false, cattleOnly=false }
     */
    async getHerdAnimals(params) {
        const { herdName, cattleOnly = false } = params;
        await this.ensureConnection();

        try {
            // Get cows
            const cowsRequest = this.pool.request();
            
            let cowsQuery;
            if (herdName && herdName !== 'All active') {
                cowsRequest.input('herdName', sql.NVarChar, herdName);
                cowsQuery = `
                    SELECT CowTag, DateOfBirth AS DOB, Sex, Status, Description,
                        CONVERT(varchar, DateOfBirth, 120) AS FormattedDOB
                    FROM CowTable 
                    WHERE CurrentHerd = @herdName
                    AND CowTag IS NOT NULL
                    AND ${STATUS_ACTIVE}
                    ORDER BY CowTag`;
            } else {
                cowsQuery = `
                    SELECT CowTag, DateOfBirth AS DOB, Sex, Status, Description,
                        CONVERT(varchar, DateOfBirth, 120) AS FormattedDOB
                    FROM CowTable 
                    WHERE CowTag IS NOT NULL
                    AND ${STATUS_ACTIVE}
                    ORDER BY CowTag`;
            }
            
            const cowsResult = await cowsRequest.query(cowsQuery);

            // If cattleOnly, just return cow tags
            if (cattleOnly) {
                return cowsResult.recordset.map(r => r.CowTag);
            }

            // Get goats if not cattleOnly
            const goatsRequest = this.pool.request();
            let goatsQuery;
            
            if (herdName && herdName !== 'All active') {
                goatsRequest.input('herdName', sql.NVarChar, herdName);
                goatsQuery = `
                    SELECT GoatTag AS CowTag, NULL AS DOB, NULL AS Sex, NULL AS Status, NULL AS Description,
                        NULL AS FormattedDOB
                    FROM Goats 
                    WHERE Herd = @herdName
                    ORDER BY GoatTag`;
            } else {
                goatsQuery = `
                    SELECT GoatTag AS CowTag, NULL AS DOB, NULL AS Sex, NULL AS Status, NULL AS Description,
                        NULL AS FormattedDOB
                    FROM Goats 
                    ORDER BY GoatTag`;
            }
            
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

    /**
     * Get events related to a herd
     */
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



























    //                   PASTURE MANAGMENT //////////////////////////////////////////////////////////////////////////////////////////

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




















    //                   USER MANAGMENT //////////////////////////////////////////////////////////////////////////////////////////

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






























    // FIELDSHEETS   //////////////////////////////////////////////////////////////////////////////////////////

    /*
    
        Each sheet column is defined by the following properties:
            "key": 
            "name": 
            "dataPath": 
            "type": 
            "editable":             (Defaults to false if not given)
            "savedPerInstance":     (Defaults to false if not given)
            "instanceSource":       (Optional)

        The three categories of data columns are;
            Static
            Fillable
            Calculated

        Static columns cannot be edited, and are the direct value of some record 
            (CowTable/DamTag)
        Calculated columns need a bit of processing 
            (CowTable/DOB -> Age)
        Fillable columns are obvious



        A sheetInstance is used to preserve older data for future reading / editing
            "savedPerInstance":
            "instanceSource":
        
        "instanceSource" Tells a sheetInstance where to find its data.
        
        If "instanceSource": "copy", then upon load, the sheet makes a copy of that column.
        If "instanceSource": "record", then upon load, the sheet queries the related record.

        Columns of type 'copy' MAY NOT BE EDITABLE, as the copy is not stored in a sql row (its stored directly in the json.)
    */



    /**
     * Creates a new sheet instance, copying current state
     */
    async createSheetInstance(params) {
        const { sheetId, herdName, breedingYear, createdBy } = params;
        await this.ensureConnection();

        try {
            // Get sheet template
            const sheetDef = await this.getSheetTemplate({ sheetId });
            const columnConfig = JSON.parse(sheetDef.columns);

            // Get cattle able to be listed based on sheet type (PregCheck vs Weigh in...)
            const cowList = await this.getCowListForSheet(herdName, sheetDef.name, breedingYear);

            // Build columnData for each cow
            const columnData = {};
            
            for (const cowTag of cowList) {
                columnData[cowTag] = {};
                
                for (const column of columnConfig.columns) {
                    if (column.savedPerInstance) {
                        const cellData = await this.captureInstanceCell(
                            cowTag, 
                            column, 
                            breedingYear
                        );
                        columnData[cowTag][column.key] = cellData;
                    }
                }
            }

            // Insert instance into database
            const request = this.pool.request();
            request.input('sheetId', sql.Int, sheetId);
            request.input('dateCreated', sql.DateTime, new Date());
            request.input('columnData', sql.NVarChar(sql.MAX), JSON.stringify(columnData));
            request.input('rowData', sql.NVarChar(sql.MAX), JSON.stringify(cowList));
            request.input('createdBy', sql.NVarChar, createdBy);
            request.input('herdName', sql.NVarChar, herdName);
            request.input('breedingYear', sql.Int, breedingYear);

            const query = `
                INSERT INTO SheetInstances (SheetID, DateCreated, ColumnData, RowData, CreatedBy, HerdName, BreedingYear)
                OUTPUT INSERTED.ID
                VALUES (@sheetId, @dateCreated, @columnData, @rowData, @createdBy, @herdName, @breedingYear)`;

            const result = await request.query(query);
            return { 
                success: true, 
                instanceId: result.recordset[0].ID 
            };
        } catch (error) {
            console.error('Error creating sheet instance:', error);
            throw error;
        }
    }

    /**
     * Captures the state of a single cell for instance storage
     */
    async captureInstanceCell(cowTag, column, breedingYear) {
        const { dataPath, instanceSource } = column;
        const result = await this.getColumnValueWithSource(cowTag, dataPath, breedingYear);

        if (instanceSource === 'copy') {
            // Copy the actual value
            return { value: result.value };
        } else {
            // Get both value and record ID from the query
            return { sourceRecordID: result.recordId };
        }
    }

    /**
     * Loads an existing sheet instance
     */
    async loadSheetInstance(params) {
        const { instanceId } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('instanceId', sql.Int, instanceId);
            
            const query = `
                SELECT si.*, s.SheetName, s.Columns 
                FROM SheetInstances si
                INNER JOIN Sheets s ON si.SheetID = s.ID
                WHERE si.ID = @instanceId`;
            
            const result = await request.query(query);
            
            if (result.recordset.length === 0) {
                throw new Error(`Sheet instance ${instanceId} not found`);
            }

            const instance = result.recordset[0];
            const columnConfig = JSON.parse(instance.Columns);
            const columnData = JSON.parse(instance.ColumnData);
            const rowData = JSON.parse(instance.RowData);

            // Build the data array for display
            const sheetData = [];
            
            for (const cowTag of rowData) {
                const rowObj = { CowTag: cowTag };
                
                for (const column of columnConfig.columns) {
                    if (column.savedPerInstance) {
                        // Get from instance data
                        rowObj[column.key] = await this.getInstanceValue(
                            columnData[cowTag]?.[column.key],
                            column
                        );
                    } else {
                        // Get current value (not saved in instance)
                        rowObj[column.key] = await this.getColumnValue(
                            cowTag, 
                            column.dataPath, 
                            instance.BreedingYear
                        );
                    }
                }
                
                sheetData.push(rowObj);
            }

            return {
                instanceId: instance.ID,
                sheetId: instance.SheetID,
                sheetName: instance.SheetName,
                dateCreated: instance.DateCreated,
                columns: columnConfig.columns,
                data: sheetData,
                metadata: {
                    herdName: instance.HerdName,
                    breedingYear: instance.BreedingYear,
                    createdBy: instance.CreatedBy
                }
            };
        } catch (error) {
            console.error('Error loading sheet instance:', error);
            throw error;
        }
    }

    /**
     * Gets value from instance data - either copied value or by querying source record
     */
    async getInstanceValue(cellData, column) {
        if (!cellData) return '';

        if ('value' in cellData) {
            // Copied value
            return cellData.value;
        } else if ('sourceRecordID' in cellData) {
            // Query from source record
            if (cellData.sourceRecordID === null) {
                return ''; // New fillable field, not yet populated
            }
            return await this.getValueFromSourceRecord(
                cellData.sourceRecordID,
                column.dataPath
            );
        }
        
        return '';
    }


    /**
     * Queries a specific record by ID to get its value
     */
    async getValueFromSourceRecord(recordId, dataPath) {
        const [tableName, fieldName] = dataPath.split('/');
        
        try {
            // Handle CowTable which uses CowTag as primary key
            if (tableName === 'CowTable') {
                // recordId is actually the cowTag string
                const result = await this.getCowTableValueWithSource(recordId, fieldName);
                return result.value;
            }

            // TODO: GoatTable also uses GoatTag as primary key
            if (tableName === 'GoatTable') {
                throw new Error(
                    `TODO: GoatTable uses Tag-based primary key (not ID). ` +
                    `Current instanceSource design doesn't support this. ` +
                    `Columns referencing GoatTable should use instanceSource='copy' instead.`
                );
            }
            
            // All other tables use numeric ID
            const request = this.pool.request();
            request.input('recordId', sql.Int, recordId);
            
            // Handle date formatting for specific fields
            let query;
            if (fieldName === 'TimeRecorded' || fieldName === 'TreatmentDate' || 
                fieldName === 'PregCheckDate' || fieldName === 'BirthDate' || 
                fieldName === 'WeaningDate') {
                query = `SELECT FORMAT(${fieldName}, 'yyyy-MM-dd') AS FormattedDate FROM ${tableName} WHERE ID = @recordId`;
                const result = await request.query(query);
                return result.recordset[0]?.FormattedDate || '';
            }
            
            // Handle special field for PregancyCheck
            if (tableName === 'PregancyCheck' && fieldName === 'IsPregnant') {
                query = `SELECT ${fieldName} FROM ${tableName} WHERE ID = @recordId`;
                const result = await request.query(query);
                const isPregnant = result.recordset[0]?.IsPregnant;
                return isPregnant === 1 ? 'Pregnant' : (isPregnant === 0 ? 'Open' : '');
            }
            
            // Handle WeightAtCheck which joins to WeightRecords
            if (tableName === 'PregancyCheck' && fieldName === 'WeightAtCheck') {
                query = `
                    SELECT wr.Weight 
                    FROM PregancyCheck pc
                    LEFT JOIN WeightRecords wr ON pc.WeightRecordID = wr.ID
                    WHERE pc.ID = @recordId`;
                const result = await request.query(query);
                return result.recordset[0]?.Weight || '';
            }
            
            // Handle TreatmentMedicineID which stores the medicine name
            if (tableName === 'MedicalTable' && fieldName === 'TreatmentMedicineID') {
                query = `SELECT TreatmentMedicine FROM ${tableName} WHERE ID = @recordId`;
                const result = await request.query(query);
                return result.recordset[0]?.TreatmentMedicine || '';
            }
            
            // Handle Notes field which might be called different things
            if (fieldName === 'Notes' || fieldName === 'TreatmentNotes') {
                const actualFieldName = tableName === 'MedicalTable' ? 'Notes' : fieldName;
                query = `SELECT ${actualFieldName} FROM ${tableName} WHERE ID = @recordId`;
                const result = await request.query(query);
                return result.recordset[0]?.[actualFieldName] || '';
            }
            
            // Standard query
            query = `SELECT ${fieldName} FROM ${tableName} WHERE ID = @recordId`;
            const result = await request.query(query);
            
            return result.recordset[0]?.[fieldName] || '';
        } catch (error) {
            console.error(`Error fetching from source record ${recordId}:`, error);
            throw error;
        }
    }


    /**
     * Attempts to load instance, creates new one if not found
     */
    async tryLoadSheetInstance(params) {
        const { instanceId, sheetId, herdName, breedingYear, createdBy } = params;
        
        if (instanceId) {
            try {
                return await this.loadSheetInstance({ instanceId });
            } catch (error) {
                if (error.message.includes('not found')) {
                    // Fall through to create new instance
                } else {
                    throw error;
                }
            }
        }
        
        // Create new instance
        const createResult = await this.createSheetInstance({
            sheetId,
            herdName,
            breedingYear,
            createdBy
        });
        
        return await this.loadSheetInstance({ instanceId: createResult.instanceId });
    }

    /**
     * Updates a cell in a sheet instance
     */
    async updateSheetInstanceCell(params) {
        const { instanceId, cowTag, columnKey, value, column } = params;
        await this.ensureConnection();

        try {
            // Get current instance data
            const request = this.pool.request();
            request.input('instanceId', sql.Int, instanceId);
            const result = await request.query(
                'SELECT ColumnData, SheetID FROM SheetInstances WHERE ID = @instanceId'
            );
            
            const columnData = JSON.parse(result.recordset[0].ColumnData);
            
            // Handle the update based on column type
            if (column.editable && column.savedPerInstance) {
                // Update instance data
                if (!columnData[cowTag]) {
                    columnData[cowTag] = {};
                }
                
                if (column.instanceSource === 'copy') {
                    columnData[cowTag][columnKey] = { value };
                } else {
                    // Create or update the actual record (throws on failure)
                    const recordId = await this.createOrUpdateRecord(
                        cowTag,
                        column,
                        value,
                        columnData[cowTag]?.[columnKey]?.sourceRecordID
                    );
                    
                    // Store only the record ID (value will be queried dynamically)
                    columnData[cowTag][columnKey] = { sourceRecordID: recordId };
                }
            }
            
            // Save updated instance data
            const updateRequest = this.pool.request();
            updateRequest.input('instanceId', sql.Int, instanceId);
            updateRequest.input('columnData', sql.NVarChar(sql.MAX), JSON.stringify(columnData));
            
            await updateRequest.query(
                'UPDATE SheetInstances SET ColumnData = @columnData WHERE ID = @instanceId'
            );
            
            return { success: true };
        } catch (error) {
            console.error('Error updating sheet instance cell:', error);
            throw error;
        }
    }


    /**
     * Creates or updates a record (e.g., WeightRecord) when fillable column is edited
     */
    async createOrUpdateRecord(cowTag, column, value, existingRecordId) {
        const [source, fieldName] = column.dataPath.split('/');
        const [tableName, tableField] = column.instanceSource.split('/');
        
        try {
            switch (tableName) {
                case 'WeightRecords':
                    return await this.createOrUpdateWeightRecord(cowTag, tableField, value, existingRecordId);
                
                case 'PregancyCheck':
                    return await this.createOrUpdatePregancyCheckField(cowTag, tableField, value, existingRecordId);
                
                case 'CowTable':
                    // CowTable uses cowTag as "recordId", update directly
                    return await this.updateCowTableField(cowTag, tableField, value);
                
                case 'WeaningRecords':
                    return await this.createOrUpdateWeaningRecord(cowTag, value, existingRecordId);
                
                case 'CalvingRecords':
                    return await this.updateCalvingRecordField(cowTag, tableField, value, existingRecordId);
                
                case 'MedicalTable':
                    return await this.createOrUpdateMedicalRecord(cowTag, tableField, value, existingRecordId);
                
                default:
                    throw new Error(`Unknown table for createOrUpdateRecord: ${tableName}`);
            }
        } catch (error) {
            console.error(`Error in createOrUpdateRecord for ${tableName}:`, error);
            throw error;
        }
    }



    async batchUpdateSheetInstanceCells(params) {
        const { instanceId, updates } = params; // Array of {cowTag, columnKey, value, column}
        const results = [];
        
        for (const update of updates) {
            try {
                const result = await this.updateSheetInstanceCell({
                    instanceId,
                    cowTag: update.cowTag,
                    columnKey: update.columnKey,
                    value: update.value,
                    column: update.column
                });
                results.push({ ...update, success: true, result });
            } catch (error) {
                results.push({ ...update, success: false, error: error.message });
            }
        }
        
        return { results, successCount: results.filter(r => r.success).length };
    }

    /**
     * Lists all instances for a sheet
     */
    async getSheetInstances(sheetId) {
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('sheetId', sql.Int, sheetId);
            
            const query = `
                SELECT ID, DateCreated, HerdName, BreedingYear, CreatedBy
                FROM SheetInstances
                WHERE SheetID = @sheetId
                ORDER BY DateCreated DESC`;
            
            const result = await request.query(query);
            return { instances: result.recordset };
        } catch (error) {
            console.error('Error fetching sheet instances:', error);
            throw error;
        }
    }


    async getAllSheetInstances() {
        await this.ensureConnection();
        
        try {
            const query = `
                SELECT 
                    si.ID as instanceId,
                    si.SheetID as sheetId,
                    s.SheetName as sheetName,
                    si.DateCreated as dateCreated,
                    si.HerdName as herdName,
                    si.BreedingYear as breedingYear,
                    si.CreatedBy as createdBy
                FROM SheetInstances si
                INNER JOIN Sheets s ON si.SheetID = s.ID
                ORDER BY si.DateCreated DESC`;
            
            const result = await this.pool.request().query(query);
            return { instances: result.recordset };
        } catch (error) {
            console.error('Error fetching all sheet instances:', error);
            throw error;
        }
    }

    async getSheetTemplate(params) {
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
            console.log('getSheetTemplate received sheetId:', sheetId, 'type:', typeof sheetId);
            const numericSheetId = parseInt(sheetId);
            console.log('Converted to:', numericSheetId, 'isNaN:', isNaN(numericSheetId));
            console.error('Error fetching sheet definition:', error);
            throw error;
        }
    }

    async updateSheetTemplate(params) {
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

    /**
     * Deletes the given sheet if it is not locked
     */
    async deleteSheetTemplate(sheetId) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('sheetId', sql.Int, sheetId);
            const query = `DELETE FROM Sheets WHERE ID = @sheetId AND Locked = 0`;

            const result = await request.query(query);
            if (result.rowsAffected[0] === 0) {
                throw new Error('Sheet not found or is locked');
            }

            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error deleting sheet:', error);
            throw error;
        }
    }

    async getAllSheetTemplates() {
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

    async createSheetTemplate(params) {
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

    async getSheetDataDynamic(params) {
        const { sheetId, herdName, breedingYear, sheetName } = params;

        try {
            // 1. Get sheet definition
            const sheetDef = await this.getSheetTemplate({ sheetId });
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

            // 5. Get update handler
            const updateHandlers = [];

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
                return await this.getHerdAnimals({ herdName, cattleOnly: true });
            }

            const result = await request.query(query);
            return result.recordset.map(r => r.CowTag);
        } catch (error) {
            console.error('Error fetching cow list for sheet:', error);
            throw error;
        }
    }








    // calculated value fields
    async getCalculatedValue(cowTag, fieldName, breedingYear = null) {
        try {
            switch (fieldName) {
                case 'Age':
                    const basicInfo = await this.getCowTableValue(cowTag, 'DateOfBirth');
                    return this.calculateAge(basicInfo);

                case 'AgeInMonths':
                    const birthInfo = await this.getCowTableValue(cowTag, 'DateOfBirth');
                    return this.calculateAgeInMonths(birthInfo);

                case 'PregnancyMonths':
                    const pregCheck = await this.getPregancyCheckValue(cowTag, 'IsPregnant', breedingYear);
                    const pregDate = await this.getPregancyCheckValue(cowTag, 'PregCheckDate', breedingYear);
                    return this.calculatePregnancyMonths(pregDate, pregCheck === 'Pregnant');

                case 'OpenStatus':
                    const isPregnant = await this.getPregancyCheckValue(cowTag, 'IsPregnant', breedingYear);
                    return isPregnant === 'Pregnant' ? 'No' : 'Yes';

                case 'CullStatus':
                    const status = await this.getCowTableValue(cowTag, 'Status');
                    return status === 'Cull' ? 'Yes' : 'No';

                case 'BreedingStatus':
                    return await this.calculateBreedingStatus(cowTag, breedingYear);

                case 'WeaningStatus':
                    return await this.calculateWeaningStatus(cowTag);

                case 'ExpectedDeliveryDate':
                    return await this.calculateExpectedDeliveryDate(cowTag, breedingYear);

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

    async calculateBreedingStatus(cowTag, breedingYear = null) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            let pregQuery = `
                SELECT TOP 1 IsPregnant 
                FROM PregancyCheck pc`;
            
            if (breedingYear) {
                request.input('breedingYear', sql.Int, breedingYear);
                pregQuery += `
                INNER JOIN BreedingRecords br ON pc.BreedingRecordID = br.ID
                INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
                WHERE pc.CowTag = @cowTag AND bp.PlanYear = @breedingYear`;
            } else {
                pregQuery += ` WHERE pc.CowTag = @cowTag`;
            }
            
            pregQuery += ` ORDER BY PregCheckDate DESC`;
            
            const pregResult = await request.query(pregQuery);

            if (pregResult.recordset.length > 0) {
                return pregResult.recordset[0].IsPregnant ? 'Pregnant' : 'Open';
            }

            // Check for breeding records
            let breedingQuery = `
                SELECT TOP 1 br.ID 
                FROM BreedingRecords br`;
            
            if (breedingYear) {
                breedingQuery += `
                INNER JOIN BreedingPlan bp ON br.PlanID = bp.ID
                WHERE br.CowTag = @cowTag AND bp.PlanYear = @breedingYear`;
            } else {
                breedingQuery += ` WHERE br.CowTag = @cowTag`;
            }
            
            breedingQuery += ` ORDER BY ExposureStartDate DESC`;
            
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
                'CurrentWeight': `TODO`,
                'Description': 'Description',
                'Breed': 'Breed',
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
                case 'PrimaryBulls': {
                    const primaryQuery = `
                        SELECT TOP 1 PrimaryBulls
                        FROM BreedingRecords br
                        ${yearFilter}
                        ORDER BY ExposureStartDate DESC`;
                    const primaryResult = await request.query(primaryQuery);
                    return primaryResult.recordset[0]?.PrimaryBulls || '';
                }

                case 'CleanupBulls': {
                    const cleanupQuery = `
                        SELECT TOP 1 CleanupBulls
                        FROM BreedingRecords br
                        ${yearFilter}
                        ORDER BY ExposureStartDate DESC`;
                    const cleanupResult = await request.query(cleanupQuery);
                    return cleanupResult.recordset[0]?.CleanupBulls || '';
                }

                case 'CurrentBull': {
                    const currentQuery = `
                        SELECT TOP 1 PrimaryBulls, ExposureStartDate, ExposureEndDate
                        FROM BreedingRecords br
                        ${yearFilter} AND GETDATE() BETWEEN ExposureStartDate AND ExposureEndDate
                        ORDER BY ExposureStartDate DESC`;
                    const currentResult = await request.query(currentQuery);
                    return currentResult.recordset[0]?.PrimaryBulls || 'None';
                }

                case 'ExposureStartDate': {
                    const startQuery = `
                        SELECT TOP 1 FORMAT(ExposureStartDate, 'MM/dd/yyyy') AS FormattedStartDate
                        FROM BreedingRecords br
                        ${yearFilter}
                        ORDER BY ExposureStartDate DESC`;
                    const startResult = await request.query(startQuery);
                    return startResult.recordset[0]?.FormattedStartDate || '';
                }

                case 'ExposureEndDate': {
                    const endQuery = `
                        SELECT TOP 1 FORMAT(ExposureEndDate, 'MM/dd/yyyy') AS FormattedEndDate
                        FROM BreedingRecords br
                        ${yearFilter}
                        ORDER BY ExposureStartDate DESC`;
                    const endResult = await request.query(endQuery);
                    return endResult.recordset[0]?.FormattedEndDate || '';
                }

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

                case 'FetusSex':
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







async getColumnValueWithSource(cowTag, dataPath, breedingYear) {
    const [source, fieldName] = dataPath.split('/');

    try {
        switch (source) {
            case 'CowTable':
                return await this.getCowTableValueWithSource(cowTag, fieldName);
            
            case 'WeightRecords':
                return await this.getWeightRecordsValueWithSource(cowTag, fieldName);
            
            case 'MedicalTable':
                return await this.getMedicalTableValueWithSource(cowTag, fieldName);
            
            case 'BreedingRecords':
                return await this.getBreedingRecordsValueWithSource(cowTag, fieldName, breedingYear);
            
            case 'PregancyCheck':
                return await this.getPregancyCheckValueWithSource(cowTag, fieldName, breedingYear);
            
            case 'CalvingRecords':
                return await this.getCalvingRecordsValueWithSource(cowTag, fieldName, breedingYear);
            
            case 'Herds':
                // Herds don't have record IDs (lookup table)
                const value = await this.getHerdsValue(cowTag, fieldName);
                return { value, recordId: null };
            
            case 'Calculated':
                // Calculated fields have no source records
                const calcValue = await this.getCalculatedValue(cowTag, fieldName, breedingYear);
                return { value: calcValue, recordId: null };
            
            case 'Fillable':
                // Fillable fields start empty with no record
                return { value: '', recordId: null };
            
            default:
                return { value: '', recordId: null };
        }
    } catch (error) {
        console.error(`Error getting column value with source for ${dataPath}:`, error);
        return { value: '', recordId: null };
    }
}






async getCowTableValueWithSource(cowTag, fieldName) {
    await this.ensureConnection();

    try {
        const request = this.pool.request();
        request.input('cowTag', sql.NVarChar, cowTag);

        const columnMap = {
            'CowTag': 'CowTag',
            'Dam': '[Dam (Mother)]',
            'Sire': '[Sire (Father)]',
            'Sex': 'Sex',
            'DateOfBirth': 'DateOfBirth',
            'CurrentHerd': 'CurrentHerd',
            'Description': 'Description',
            'Breed': 'Breed',
            'Temperament': 'Temperament',
            'Status': 'Status',
            'RegCert': 'RegCert',
            'WeaningWeight': 'WeaningWeight',
            'WeaningDate': 'WeaningDate',
            'AnimalClass': 'AnimalClass'
        };

        const dbColumn = columnMap[fieldName] || fieldName;

        if (fieldName === 'DateOfBirth' || fieldName === 'WeaningDate') {
            const query = `SELECT FORMAT(${dbColumn}, 'MM/dd/yyyy') AS FormattedDate FROM CowTable WHERE CowTag = @cowTag`;
            const result = await request.query(query);
            return {
                value: result.recordset[0] ? result.recordset[0]['FormattedDate'] : '',
                recordId: cowTag // CowTag is the primary key
            };
        }

        const query = `SELECT ${dbColumn} FROM CowTable WHERE CowTag = @cowTag`;
        const result = await request.query(query);

        let value = '';
        if (fieldName === 'Dam') {
            value = result.recordset[0] ? result.recordset[0]['Dam (Mother)'] : '';
        } else if (fieldName === 'Sire') {
            value = result.recordset[0] ? result.recordset[0]['Sire (Father)'] : '';
        } else {
            value = result.recordset[0] ? result.recordset[0][fieldName] : '';
        }

        return {
            value,
            recordId: cowTag // CowTag is the primary key
        };
    } catch (error) {
        console.error(`Error fetching CowTable value for ${fieldName}:`, error);
        return { value: '', recordId: null };
    }
}


async getWeightRecordsValueWithSource(cowTag, fieldName) {
    await this.ensureConnection();

    try {
        const request = this.pool.request();
        request.input('cowTag', sql.NVarChar, cowTag);

        let query;
        if (fieldName === 'TimeRecorded') {
            query = `
                SELECT TOP 1 FORMAT(TimeRecorded, 'yyyy-MM-dd') AS FormattedDate, ID
                FROM WeightRecords
                WHERE CowTag = @cowTag
                ORDER BY TimeRecorded DESC`;
        } else {
            query = `
                SELECT TOP 1 ${fieldName}, ID
                FROM WeightRecords
                WHERE CowTag = @cowTag
                ORDER BY TimeRecorded DESC`;
        }

        const result = await request.query(query);
        
        if (result.recordset.length > 0) {
            return {
                value: result.recordset[0][fieldName === 'TimeRecorded' ? 'FormattedDate' : fieldName] || '',
                recordId: result.recordset[0].ID
            };
        }
        
        return { value: '', recordId: null };
    } catch (error) {
        console.error(`Error fetching WeightRecords value for ${fieldName}:`, error);
        return { value: '', recordId: null };
    }
}






async getBreedingRecordsValueWithSource(cowTag, fieldName, breedingYear = null) {
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
            case 'PrimaryBulls': {
                const query = `
                    SELECT TOP 1 PrimaryBulls, br.ID
                    FROM BreedingRecords br
                    ${yearFilter}
                    ORDER BY ExposureStartDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.PrimaryBulls || '',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            case 'CleanupBulls': {
                const query = `
                    SELECT TOP 1 CleanupBulls, br.ID
                    FROM BreedingRecords br
                    ${yearFilter}
                    ORDER BY ExposureStartDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.CleanupBulls || '',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            case 'CurrentBull': {
                const query = `
                    SELECT TOP 1 PrimaryBulls, br.ID
                    FROM BreedingRecords br
                    ${yearFilter} AND GETDATE() BETWEEN ExposureStartDate AND ExposureEndDate
                    ORDER BY ExposureStartDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.PrimaryBulls || 'None',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            case 'ExposureStartDate':
            case 'ExposureEndDate': {
                const query = `
                    SELECT TOP 1 FORMAT(${fieldName}, 'MM/dd/yyyy') AS FormattedDate, br.ID
                    FROM BreedingRecords br
                    ${yearFilter}
                    ORDER BY ExposureStartDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.FormattedDate || '',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            default:
                return { value: '', recordId: null };
        }
    } catch (error) {
        console.error(`Error fetching BreedingRecords value for ${fieldName}:`, error);
        return { value: '', recordId: null };
    }
}







async getPregancyCheckValueWithSource(cowTag, fieldName, breedingYear = null) {
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
            case 'IsPregnant': {
                const query = `
                    SELECT TOP 1 IsPregnant, pc.ID
                    FROM PregancyCheck pc
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                const result = await request.query(query);
                const isPregnant = result.recordset[0]?.IsPregnant;
                return {
                    value: isPregnant === 1 ? 'Pregnant' : (isPregnant === 0 ? 'Open' : ''),
                    recordId: result.recordset[0]?.ID || null
                };
            }

            case 'PregCheckDate': {
                const query = `
                    SELECT TOP 1 FORMAT(PregCheckDate, 'yyyy-MM-dd') AS FormattedPregCheckDate, pc.ID
                    FROM PregancyCheck pc
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.FormattedPregCheckDate || '',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            case 'FetusSex':
            case 'Notes':
            case 'MonthsPregnant': {
                const query = `
                    SELECT TOP 1 ${fieldName}, pc.ID
                    FROM PregancyCheck pc
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.[fieldName] || '',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            case 'WeightAtCheck': {
                const query = `
                    SELECT TOP 1 wr.Weight, pc.ID
                    FROM PregancyCheck pc
                    LEFT JOIN WeightRecords wr ON pc.WeightRecordID = wr.ID
                    ${yearFilter}
                    ORDER BY PregCheckDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.Weight || '',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            default:
                return { value: '', recordId: null };
        }
    } catch (error) {
        console.error(`Error fetching PregancyCheck value for ${fieldName}:`, error);
        return { value: '', recordId: null };
    }
}






async getCalvingRecordsValueWithSource(cowTag, fieldName, breedingYear = null) {
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
            case 'CalfSex':
            case 'CalvingNotes': {
                const query = `
                    SELECT TOP 1 ${fieldName}, cr.ID
                    FROM CalvingRecords cr
                    ${yearFilter}
                    ORDER BY BirthDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.[fieldName] || '',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            case 'BirthDate': {
                const query = `
                    SELECT TOP 1 FORMAT(BirthDate, 'MM/dd/yyyy') AS FormattedBirthDate, cr.ID
                    FROM CalvingRecords cr
                    ${yearFilter}
                    ORDER BY BirthDate DESC`;
                const result = await request.query(query);
                return {
                    value: result.recordset[0]?.FormattedBirthDate || '',
                    recordId: result.recordset[0]?.ID || null
                };
            }

            default:
                return { value: '', recordId: null };
        }
    } catch (error) {
        console.error(`Error fetching CalvingRecords value for ${fieldName}:`, error);
        return { value: '', recordId: null };
    }
}




async getMedicalTableValueWithSource(cowTag, fieldName) {
    await this.ensureConnection();

    try {
        const request = this.pool.request();
        request.input('cowTag', sql.NVarChar, cowTag);

        // For fillable fields in Medical sheet, get most recent treatment
        if (fieldName === 'TreatmentMedicineID' || fieldName === 'TreatmentDate' || fieldName === 'TreatmentNotes') {
            const query = `
                SELECT TOP 1 TreatmentMedicine, TreatmentDate, Notes, ID
                FROM MedicalTable
                WHERE CowTag = @cowTag
                ORDER BY TreatmentDate DESC`;
            const result = await request.query(query);
            
            if (result.recordset.length > 0) {
                let value = '';
                if (fieldName === 'TreatmentMedicineID') {
                    value = result.recordset[0].TreatmentMedicine || '';
                } else if (fieldName === 'TreatmentDate') {
                    value = result.recordset[0].TreatmentDate 
                        ? result.recordset[0].TreatmentDate.toISOString().split('T')[0] 
                        : '';
                } else if (fieldName === 'TreatmentNotes') {
                    value = result.recordset[0].Notes || '';
                }
                
                return {
                    value,
                    recordId: result.recordset[0].ID
                };
            }
            
            return { value: '', recordId: null };
        }

        // For display-only aggregated fields (not used in instances)
        const value = await this.getMedicalTableValue(cowTag, fieldName);
        return { value, recordId: null };

    } catch (error) {
        console.error(`Error fetching MedicalTable value for ${fieldName}:`, error);
        return { value: '', recordId: null };
    }
}






async createOrUpdateWeightRecord(cowTag, fieldName, value, existingRecordId) {
    await this.ensureConnection();
    
    if (existingRecordId) {
        // Update existing record
        const request = this.pool.request();
        request.input('recordId', sql.Int, existingRecordId);
        request.input('value', fieldName === 'Weight' ? sql.Int : sql.DateTime, value);
        
        const query = `UPDATE WeightRecords SET ${fieldName} = @value WHERE ID = @recordId`;
        await request.query(query);
        return existingRecordId;
    } else {
        // Create new record
        const request = this.pool.request();
        request.input('cowTag', sql.NVarChar, cowTag);
        
        if (fieldName === 'Weight') {
            request.input('weight', sql.Int, value);
            request.input('timeRecorded', sql.DateTime, new Date());
        } else if (fieldName === 'TimeRecorded') {
            request.input('timeRecorded', sql.DateTime, value);
            request.input('weight', sql.Int, null);
        } else if (fieldName === 'Notes') {
            request.input('notes', sql.NVarChar(sql.MAX), value);
            request.input('timeRecorded', sql.DateTime, new Date());
        }
        
        const query = `
            INSERT INTO WeightRecords (CowTag, Weight, TimeRecorded, Notes)
            OUTPUT INSERTED.ID
            VALUES (@cowTag, @weight, @timeRecorded, @notes)`;
        
        const result = await request.query(query);
        return result.recordset[0].ID;
    }
}

async createOrUpdatePregancyCheckField(cowTag, fieldName, value, existingRecordId) {
    await this.ensureConnection();
    
    if (!existingRecordId) {
        throw new Error('Cannot create PregancyCheck record from individual field - record must exist first');
    }
    
    const request = this.pool.request();
    request.input('recordId', sql.Int, existingRecordId);
    
    let sqlType, sqlValue;
    switch (fieldName) {
        case 'PregCheckDate':
            sqlType = sql.Date;
            sqlValue = value;
            break;
        case 'IsPregnant':
            sqlType = sql.Bit;
            sqlValue = value === 'Pregnant' ? 1 : 0;
            break;
        case 'FetusSex':
            sqlType = sql.NVarChar;
            sqlValue = value;
            break;
        case 'WeightAtCheck':
            sqlType = sql.Int;
            sqlValue = value;
            break;
        case 'Notes':
            sqlType = sql.Text;
            sqlValue = value;
            break;
        default:
            throw new Error(`Unknown PregancyCheck field: ${fieldName}`);
    }
    
    request.input('value', sqlType, sqlValue);
    const query = `UPDATE PregancyCheck SET ${fieldName} = @value WHERE ID = @recordId`;
    await request.query(query);
    return existingRecordId;
}

async updateCowTableField(cowTag, fieldName, value) {
    await this.ensureConnection();
    
    const request = this.pool.request();
    request.input('cowTag', sql.NVarChar, cowTag);
    
    let sqlType;
    switch (fieldName) {
        case 'AnimalClass':
            sqlType = sql.NVarChar;
            break;
        case 'WeaningWeight':
            sqlType = sql.Int;
            break;
        case 'WeaningDate':
            sqlType = sql.Date;
            break;
        default:
            throw new Error(`Unknown CowTable field: ${fieldName}`);
    }
    
    request.input('value', sqlType, value);
    const query = `UPDATE CowTable SET ${fieldName} = @value WHERE CowTag = @cowTag`;
    await request.query(query);
    
    // Return cowTag as the "recordId" since CowTag is the primary key
    return cowTag;
}

async createOrUpdateWeaningRecord(cowTag, notes, existingRecordId) {
    await this.ensureConnection();
    
    if (existingRecordId) {
        // Update existing record
        const request = this.pool.request();
        request.input('recordId', sql.Int, existingRecordId);
        request.input('notes', sql.NVarChar(sql.MAX), notes);
        
        const query = `UPDATE WeaningRecords SET Notes = @notes WHERE ID = @recordId`;
        await request.query(query);
        return existingRecordId;
    } else {
        // Create new record
        const request = this.pool.request();
        request.input('cowTag', sql.NVarChar, cowTag);
        request.input('notes', sql.NVarChar(sql.MAX), notes);
        request.input('weaningDate', sql.DateTime, new Date());
        
        const query = `
            INSERT INTO WeaningRecords (CowTag, WeaningDate, Notes)
            OUTPUT INSERTED.ID
            VALUES (@cowTag, @weaningDate, @notes)`;
        
        const result = await request.query(query);
        return result.recordset[0].ID;
    }
}

async updateCalvingRecordField(cowTag, fieldName, value, existingRecordId) {
    await this.ensureConnection();
    
    if (!existingRecordId) {
        throw new Error('Cannot update CalvingRecord - record must exist first');
    }
    
    const request = this.pool.request();
    request.input('recordId', sql.Int, existingRecordId);
    
    let sqlType;
    switch (fieldName) {
        case 'CalvingNotes':
            sqlType = sql.NVarChar(sql.MAX);
            break;
        default:
            throw new Error(`Unknown or non-editable CalvingRecords field: ${fieldName}`);
    }
    
    request.input('value', sqlType, value);
    const query = `UPDATE CalvingRecords SET ${fieldName} = @value WHERE ID = @recordId`;
    await request.query(query);
    return existingRecordId;
}

async createOrUpdateMedicalRecord(cowTag, fieldName, value, existingRecordId) {
    await this.ensureConnection();
    
    if (existingRecordId) {
        // Update existing record
        const request = this.pool.request();
        request.input('recordId', sql.Int, existingRecordId);
        
        let actualFieldName = fieldName;
        let sqlType;
        
        switch (fieldName) {
            case 'TreatmentMedicineID':
                actualFieldName = 'TreatmentMedicine';
                sqlType = sql.NVarChar;
                break;
            case 'TreatmentDate':
                sqlType = sql.Date;
                break;
            case 'TreatmentNotes':
                actualFieldName = 'Notes';
                sqlType = sql.NVarChar(sql.MAX);
                break;
            default:
                throw new Error(`Unknown MedicalTable field: ${fieldName}`);
        }
        
        request.input('value', sqlType, value);
        const query = `UPDATE MedicalTable SET ${actualFieldName} = @value WHERE ID = @recordId`;
        await request.query(query);
        return existingRecordId;
    } else {
        // Create new record
        const request = this.pool.request();
        request.input('cowTag', sql.NVarChar, cowTag);
        request.input('eventId', sql.Int, null);
        
        let medicine = null, treatmentDate = new Date(), notes = null;
        
        switch (fieldName) {
            case 'TreatmentMedicineID':
                medicine = value;
                break;
            case 'TreatmentDate':
                treatmentDate = value;
                break;
            case 'TreatmentNotes':
                notes = value;
                break;
        }
        
        request.input('medicine', sql.NVarChar, medicine);
        request.input('treatmentDate', sql.Date, treatmentDate);
        request.input('notes', sql.NVarChar(sql.MAX), notes);
        
        const query = `
            INSERT INTO MedicalTable (EventID, CowTag, TreatmentMedicine, TreatmentDate, Notes)
            OUTPUT INSERTED.ID
            VALUES (@eventId, @cowTag, @medicine, @treatmentDate, @notes)`;
        
        const result = await request.query(query);
        return result.recordset[0].ID;
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

    async getWeightRecordsValue(cowTag, fieldName) {
        try {
            const weightData = await this.getCurrentWeight(cowTag);
            
            switch (fieldName) {
                case 'Weight':
                case 'Latest':
                    return weightData.weight || '';
                case 'TimeRecorded':
                case 'Date':
                    return weightData.formattedDate || '';
                default:
                    return '';
            }
        } catch (error) {
            console.error(`Error fetching WeightRecords value for ${fieldName}:`, error);
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
            SET FetusSex = @fetusSex
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
                await this.updateWeightRecord({
                    recordId: existingWeightRecordId,
                    weight: weightValue
                });
                weightRecordId = existingWeightRecordId;
            } else {
                const result = await this.createWeightRecord({
                    cowTag: cowTag,
                    weight: weightValue
                });
                weightRecordId = result.recordId;

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






    async getFillableValue(cowTag, fieldName) {
        // Fillable fields always return empty string for user input
        return '';
    }

    async getUpdateHandler(columnName)  {
        const handlerMap = {
            'PregancyCheck/IsPregnant': 'updatePregancyResult',
            'PregancyCheck/FetusSex': 'updateFetusSex', 
            'PregancyCheck/WeightAtCheck': 'updatePregCheckWeight',
            'PregancyCheck/Notes': 'updatePregCheckNotes',
            'PregancyCheck/MonthsPregnant': 'updateMonthsPregnant',
            'WeightRecords/Latest': 'recordNewWeight',
            'CalvingRecords/CalfSex': 'updateCalfSex',
            'CalvingRecords/CalvingNotes': 'addCalvingNote'
        };
        return handlerMap[columnName] || null;
    }

    async getFieldOptions(columnName)  {
        const optionsMap = {
            'PregancyCheck/IsPregnant': ['', 'Pregnant', 'Open'],
            'PregancyCheck/FetusSex': ['', 'Heifer', 'Bull'],
            'CalvingRecords/CalfSex': ['', 'Heifer', 'Bull'],
            'CowTable/Sex': ['', 'Cow', 'Bull', 'Steer', 'Heifer'],
            'CowTable/Status': ['', 'Current', 'Target Sale', 'Undefined', 'Cull'],
        };

        return optionsMap[columnName] || [];
    }

    async getFieldType(columnName) {
        const types = [
            { type: 'date', keywords: ['Date'] },
            { type: 'number', keywords: ['Weight', 'Months'] },
            { type: 'select', keywords: ['IsPregnant', 'Sex', 'Status', 'Breed', 'Temperament'] },
            { type: 'text', keywords: ['Notes', 'Description'] }
        ];

        const match = types.find(({ keywords }) =>
            keywords.some(keyword => columnName.includes(keyword))
        );

        return match?.type || 'text';
    }



    /**
     * AVAILABLE COLUMNS
     */
    async getAvailableColumns() {
        try {
            
            const isEditable = (dataPath) => {
                // All Fillable/ paths are editable
                if (dataPath.startsWith('Fillable/')) return true;
                
                // Editable fields from your existing sheets
                const editableFields = [
                    'PregancyCheck/IsPregnant',
                    'PregancyCheck/FetusSex', 
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
                { name: 'Breed', path: 'CowTable/Breed' },
                { name: 'Temperament', path: 'CowTable/Temperament' },
                { name: 'Status', path: 'CowTable/Status' },
                { name: 'RegCert', path: 'CowTable/RegCert' },

                // Weight Records
                { name: 'Latest Weight', path: 'WeightRecords/Weight' },
                { name: 'Latest Weight Date', path: 'WeightRecords/TimeRecorded' },


                // Medical records
                { name: 'Medicine & Vax', path: 'MedicalTable/TreatmentMedicineID' },

                
                // Breeding records
                { name: 'Primary Bull', path: 'BreedingRecords/PrimaryBulls' },
                { name: 'Cleanup Bull', path: 'BreedingRecords/CleanupBulls' },
                { name: 'Current Bull', path: 'BreedingRecords/CurrentBull' },
                { name: 'Exposure Start Date', path: 'BreedingRecords/ExposureStartDate' },
                { name: 'Exposure End Date', path: 'BreedingRecords/ExposureEndDate' },

                // Pregnancy checks
                { name: 'Is Pregnant', path: 'PregancyCheck/IsPregnant' },
                { name: 'Pregnancy Check Date', path: 'PregancyCheck/PregCheckDate' },
                { name: 'Fetus Sex', path: 'PregancyCheck/FetusSex' },
                { name: 'Months Pregnant', path: 'PregancyCheck/MonthsPregnant' },
                { name: 'Pregnancy Weight', path: 'PregancyCheck/WeightRecordID' },
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
                { name: 'New Weight', path: 'Fillable/Weight' },
                { name: 'Date', path: 'Fillable/Date' },
            ];

            const enhancedColumns = baseColumns.map(col => {
                const type = this.getFieldType(col.path);
                const editable = isEditable(col.path);
                const updateHandler = this.getUpdateHandler(col.path);
                const options = this.getFieldOptions(col.path);
                
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
    getCowTableData: (params) => dbOps.getCowTableData(params),
    updateCowTableData: (params) => dbOps.updateCowTableData(params),
    fetchCowEpds: (params) => dbOps.fetchCowEpds(params),
    getOffspring: (params) => dbOps.getOffspring(params),

    addNote: (params) => dbOps.addNote(params),
    getNotes: (params) => dbOps.getNotes(params),
    updateNote: (params) => dbOps.updateNote(params),
    deleteNote: (params) => dbOps.deleteNote(params),

    createWeightRecord: (params) => dbOps.createWeightRecord(params),
    getCurrentWeight: (params) => dbOps.getCurrentWeight(params),
    getWeightByRecordId: (params) => dbOps.getWeightByRecordId(params),
    updateWeightRecord: (params) => dbOps.updateWeightRecord(params),


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
    updateMedicine: (params) => dbOps.updateMedicine(params),

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
    getAllSheetTemplates: () => dbOps.getAllSheetTemplates(),
    getSheetTemplate: (sheetId) => dbOps.getSheetTemplate(sheetId),
    createSheetTemplate: (params) => dbOps.createSheetTemplate(params),
    updateSheetTemplate: (params) => dbOps.updateSheetTemplate(params),
    deleteSheetTemplate: (sheetId) => dbOps.deleteSheetTemplate(sheetId),


    // sheet instance management
    getAllSheetInstances: () => dbOps.getAllSheetInstances(),
    getSheetInstances: (sheetId) => dbOps.getSheetInstances(sheetId),
    loadSheetInstance: (params) => dbOps.loadSheetInstance(params),
    createSheetInstance: (params) => dbOps.createSheetInstance(params),
    tryLoadSheetInstance: (params) => dbOps.tryLoadSheetInstance(params),
    updateSheetInstanceCell: (params) => dbOps.updateSheetInstanceCell(params),
    batchUpdateSheetInstanceCells: (params) => dbOps.batchUpdateSheetInstanceCells(params),
    deleteSheetInstance: (instanceId) => dbOps.deleteSheetInstance(instanceId),

    
    // Users
    getUserPreferences: (params) => dbOps.getUserPreferences(params),
    updateUserPreferences: (params) => dbOps.updateUserPreferences(params),


    // Dynamic sheet data & updaters
    getSheetDataDynamic: (params) => dbOps.getSheetDataDynamic(params),
    getAvailableColumns: () => dbOps.getAvailableColumns(),
    updateSheetCell: (params) => dbOps.updateSheetCell(params),
    batchUpdateSheetCells: (params) => dbOps.batchUpdateSheetCells(params),

    getFormDropdownData: () => dbOps.getFormDropdownData(), 
    addFormDropdownData: (params) => dbOps.addFormDropdownData(params),

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
    calculateBreedFromParents: (damTag, sireTag) => dbOps.calculateBreedFromParents(damTag, sireTag),
    addCowWithCalfHandling: (params) => dbOps.addCowWithCalfHandling(params),

    // Weaning Tracker & updaters
    updateWeaningStatus: (params) => dbOps.updateWeaningStatus(params.cowTag, params.value, params.breedingYear),
    recordWeaning: (params) => dbOps.recordWeaning(params),
    getWeaningCandidates: (params) => dbOps.getWeaningCandidates(params),



    // Payment Methods
    addPaymentMethod: (params) => dbOps.addPaymentMethod(params),
    
    // Customers
    getCustomers: () => dbOps.getCustomers(),
    addCustomer: (params) => dbOps.addCustomer(params),
    updateCustomer: (params) => dbOps.updateCustomer(params),
    
    // Sales
    getAllSales: () => dbOps.getAllSales(),
    getSaleRecord: (params) => dbOps.getSaleRecord(params),
    createSaleRecord: (params) => dbOps.createSaleRecord(params),
    updateSaleRecord: (params) => dbOps.updateSaleRecord(params),
    
    // Purchases
    getAllPurchases: () => dbOps.getAllPurchases(),
    getPurchaseRecord: (params) => dbOps.getPurchaseRecord(params),
    createPurchaseRecord: (params) => dbOps.createPurchaseRecord(params),
    updatePurchaseRecord: (params) => dbOps.updatePurchaseRecord(params),
    
    // Cow Accounting
    getCowAccounting: (params) => dbOps.getCowAccounting(params)
};