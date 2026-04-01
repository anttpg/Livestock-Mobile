/* eslint-disable no-case-declarations */
const { sql, pool } = require('./db');
const bcrypt = require('bcrypt');


// Shorthand to get active animals
const STATUS_ACTIVE = "(Status IS NULL OR Status IN ('Current', 'Target Sale', 'Undefined', 'CULL LIST, Current'))";



class DatabaseOperations {
    constructor() {
        this.pool = pool;
        this.sql = sql;
        this.STATUS_ACTIVE = STATUS_ACTIVE;

        this.SALT_ROUNDS = 10;
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

                herds: `SELECT HerdName FROM Herds WHERE Active = 1 ORDER BY HerdName`,
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
     * Get all animals & basic info
     * @param {Object} params - { activeOnly: false }
     * @returns {Object} - { cows: [...], goats: [...] }
     */
    async getAllAnimals({ activeOnly = false } = {}) {
        await this.ensureConnection();

        const statusFilter = activeOnly ? `AND ${STATUS_ACTIVE}` : '';

        try {
            const cowQuery = `
                SELECT c.CowTag, c.DateOfBirth, c.Sex, c.Status, c.Description,
                    CASE WHEN h.Active = 1 THEN h.HerdName ELSE NULL END AS HerdName
                FROM CowTable c
                LEFT JOIN Herds h ON h.HerdID = c.HerdID
                WHERE c.CowTag IS NOT NULL
                ${statusFilter}
                ORDER BY HerdName, c.CowTag
            `;

            const goatQuery = `
                SELECT g.GoatTag, g.DateOfBirth, g.GoatType, g.Status, g.[Color Markings],
                    CASE WHEN h.Active = 1 THEN h.HerdName ELSE NULL END AS HerdName
                FROM Goats g
                LEFT JOIN Herds h ON h.HerdID = g.HerdID
                WHERE g.GoatTag IS NOT NULL
                ${statusFilter}
                ORDER BY HerdName, g.GoatTag
            `;

            const [cowResult, goatResult] = await Promise.all([
                this.pool.request().query(cowQuery),
                this.pool.request().query(goatQuery)
            ]);

            return { cows: cowResult.recordset, goats: goatResult.recordset };
        } catch (error) {
            console.error('Error fetching animals:', error);
            throw new Error(`Failed to fetch animals: ${error.message}`);
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
                    CowTag, DateOfBirth, Description, Dam, Sire,
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
                        CowTag, DateOfBirth, Description, Dam, Sire,
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
     * Get cow table data for one or more cows
     * @param {string | string[]} cowTags - A single cow tag or array of cow tags
     * @returns {Promise<Object|null | Object.<string, Object>>} Single record if one tag passed, map of records if array passed
     */
    async getCowTableData(cowTags) {
        await this.ensureConnection();

        const isArray = Array.isArray(cowTags);
        const tagList = isArray ? cowTags : [cowTags];

        try {
            const request = this.pool.request();

            const paramNames = tagList.map((tag, i) => {
                request.input(`cowTag${i}`, sql.NVarChar, tag);
                return `@cowTag${i}`;
            }).join(', ');

            const query = `
                SELECT 
                    c.*,
                    h.HerdName,
                    h.CurrentPasture  AS PastureName,
                    CASE 
                        WHEN c.Status IS NULL OR c.Status IN ('Current', 'Target Sale', 'Undefined', 'CULL LIST, Current')
                        THEN CAST(1 AS BIT)
                        ELSE CAST(0 AS BIT)
                    END AS IsActive,

                    CASE
                        WHEN c.DateOfBirth IS NOT NULL
                        THEN CAST(CAST(DATEDIFF(DAY, c.DateOfBirth, GETUTCDATE()) AS FLOAT) / 365.25 AS DECIMAL(10, 2))
                        ELSE NULL
                    END AS Age,

                    -- Most recent weight record
                    lw.LastWeight,
                    lw.LastWeightDate

                FROM CowTable c
                LEFT JOIN Herds h ON h.HerdID = c.HerdID

                OUTER APPLY (
                    SELECT TOP 1
                        Weight     AS LastWeight,
                        TimeRecorded AS LastWeightDate
                    FROM WeightRecords
                    WHERE CowTag = c.CowTag
                    ORDER BY TimeRecorded DESC
                ) lw

                WHERE c.CowTag IN (${paramNames})`;

            const result = await request.query(query);

            if (!isArray) {
                return result.recordset[0] || null;
            }

            return Object.fromEntries(
                result.recordset.map(row => [row.CowTag, row])
            );

        } catch (error) {
            console.error('Error fetching cow table data:', error);
            throw new Error(`Failed to fetch cow table data: ${error.message}`);
        }
    }



    /**
     * Update cow table data for one or more cows
     * @param {Object | Object[]} params - Single { cowTag, updates } or array of { cowTag, updates }
     * @returns {Promise<{success: boolean, updated: number}>}
     */
    async updateCowTableData(params) {
        await this.ensureConnection();

        const isArray = Array.isArray(params);
        const updateList = isArray ? params : [params];

        if (updateList.length === 0) return { success: true, updated: 0 };

        const transaction = new sql.Transaction(this.pool);
        await transaction.begin();

        try {
            let totalRowsAffected = 0;

            for (const [index, { cowTag, updates }] of updateList.entries()) {
                if (!updates || Object.keys(updates).length === 0) continue;

                const request = new sql.Request(transaction);
                request.input(`cowTag${index}`, sql.NVarChar, cowTag);

                const setClauses = [];
                for (const [field, value] of Object.entries(updates)) {
                    const paramName = `${field}_${index}`;

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

                const query = `
                    UPDATE CowTable
                    SET ${setClauses.join(', ')}
                    WHERE CowTag = @cowTag${index}`;

                const result = await request.query(query);

                if (result.rowsAffected[0] === 0) {
                    throw new Error(`Cow not found: ${cowTag}`);
                }

                totalRowsAffected += result.rowsAffected[0];
            }

            await transaction.commit();
            return { success: true, updated: totalRowsAffected };

        } catch (error) {
            await transaction.rollback();
            console.error('Error updating cow table data:', error);
            throw new Error(`Failed to update cow table data: ${error.message}`);
        }
    }



    /**
     * Returns true if the given tag exists in CowTable
     *  @param {*} params 
     */
    async cowTagExists(params) {
        // TODO. NOT YET COMPLETED.
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
                SET ${updateFields.join(', ')}, DateOfLastUpdate = GETUTCDATE()
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
                    c.Sire AS SireTag,
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
                    c.Dam = @cowTag OR c.Sire = @cowTag
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
     * @param {{ cowTag: string, Weight?: number, TimeRecorded?: string|Date, EventID?: number, Notes?: string, fields?: { NewWeight: number, NewWeightDate?: string|Date } }}
     * @returns {Promise<{ success: boolean, recordId: number }>}
     */
    async createWeightRecord(params) {
        const { cowTag, fields, ...flatParams } = params;
        const {
            Weight = null,
            TimeRecorded = null,
            EventID = null,
            Notes = null,
        } = fields ?? flatParams;

        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('weight', sql.Int, parseInt(Weight));
            request.input('timeRecorded', sql.DateTime, TimeRecorded ? new Date(TimeRecorded) : new Date());
            request.input('eventID', sql.Int, EventID);
            request.input('notes', sql.Text, Notes);

            const result = await request.query(`
                INSERT INTO WeightRecords (CowTag, Weight, TimeRecorded, EventID, Notes)
                OUTPUT INSERTED.ID
                VALUES (@cowTag, @weight, @timeRecorded, @eventID, @notes)`);

            return { success: true, recordId: result.recordset[0].ID };
        } catch (error) {
            console.error('Error creating weight record:', error);
            throw new Error(`Failed to create weight record: ${error.message}`);
        }
    }




    /**
     * Record batch weights
     * @param {Object} params - { date, records: [{ cowTag, weight, notes }] }
     */
    async createWeightRecordBatch(params) {
        return;
    }
    //     const { date, records } = params;
    //     await this.ensureConnection();

    //     try {
    //         // Create event
    //         const eventRequest = this.pool.request();
    //         eventRequest.input('eventDate', sql.DateTime, new Date(date));
    //         eventRequest.input('description', sql.NVarChar, `Batch Weigh-in`);

    //         const eventQuery = `
    //         INSERT INTO Events (EventDate, Description)
    //         OUTPUT INSERTED.ID
    //         VALUES (@eventDate, @description)`;
    //         const eventResult = await eventRequest.query(eventQuery);
    //         const eventId = eventResult.recordset[0].ID;

    //         // Insert weight records
    //         for (const record of records) {
    //             const wrRequest = this.pool.request();
    //             wrRequest.input('eventId', sql.Int, eventId);
    //             wrRequest.input('weight', sql.Int, record.weight);
    //             wrRequest.input('timeRecorded', sql.DateTime, new Date(date));
    //             wrRequest.input('cowTag', sql.NVarChar, record.cowTag);
    //             wrRequest.input('notes', sql.Text, record.notes || null);

    //             const wrQuery = `
    //             INSERT INTO WeightRecords (EventID, Weight, TimeRecorded, CowTag, Notes)
    //             VALUES (@eventId, @weight, @timeRecorded, @cowTag, @notes)`;
    //             await wrRequest.query(wrQuery);
    //         }

    //         return { success: true, eventId, recordsProcessed: records.length };
    //     } catch (error) {
    //         console.error('Error recording batch weights:', error);
    //         throw new Error(`Failed to record batch weights: ${error.message}`);
    //     }
    // }



    /**
     * Update an existing weight record
     * @param {{ recordId: number, fields: { Weight: number, TimeRecorded?: string|Date } }}
     * @returns {Promise<{ success: boolean }>}
     */
    async updateWeightRecord({ recordId, fields = {} }) {
        const { Weight, TimeRecorded = null } = fields;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('recordId', sql.Int, recordId);
            request.input('weight', sql.Int, parseInt(Weight));
            request.input('timeRecorded', sql.DateTime, TimeRecorded ? new Date(TimeRecorded) : new Date());

            const result = await request.query(`
                UPDATE WeightRecords
                SET Weight = @weight, TimeRecorded = @timeRecorded
                WHERE ID = @recordId`);

            if (result.rowsAffected[0] === 0) throw new Error('Weight record not found');

            return { success: true };
        } catch (error) {
            console.error('Error updating weight record:', error);
            throw new Error(`Failed to update weight record: ${error.message}`);
        }
    }



    /**
     * Get a specific weight record by its ID
     * @param {{ recordId: number }}
     * @returns {Promise<Object|null>}
     */
    async getWeightRecord({ recordId }) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('recordId', sql.Int, recordId);

            const result = await request.query(`
                SELECT
                    Weight,
                    TimeRecorded,
                    CowTag
                FROM WeightRecords
                WHERE ID = @recordId`);

            if (result.recordset.length === 0) return null;

            return result.recordset[0];
        } catch (error) {
            console.error('Error fetching weight record:', error);
            throw new Error(`Failed to fetch weight record: ${error.message}`);
        }
    }



    /**
     * Delete a weight record by ID
     * @param {{ recordId: number }}
     * @returns {Promise<{ success: boolean, deleted: number }>}
     */
    async deleteWeightRecord({ recordId }) {
        await this.ensureConnection();
        if (!recordId) throw new Error('recordId is required for deleteWeightRecord');

        try {
            const request = this.pool.request();
            request.input('id', sql.Int, recordId);

            const result = await request.query(`DELETE FROM WeightRecords WHERE ID = @id`);

            if (result.rowsAffected[0] === 0) throw new Error(`No weight record found with ID ${recordId}`);

            return { success: true, deleted: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error deleting weight record:', error);
            throw error;
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




    async getMedicalRecord(params) {
        const { recordId } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('recordID', sql.Int, recordId);

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

            return result.recordset[0];
        } catch (error) {
            console.error('Error fetching medical record details:', error);
            throw new Error(`Failed to fetch medical record: ${error.message}`);
        }
    }



    /**
     * Create a medical record
     * @param {{
     *   cowTag: string,
     *   recordType: 'maintenance' | 'issue' | 'treatment' | 'vet',
     *   EventID?: number,
     *   Note?: string,
     *   IssueDescription?: string,
     *   IssueObservedBy?: string,
     *   IssueObservationDate?: string|Date,
     *   IssueSerious?: boolean,
     *   TreatmentMedicineID?: string,
     *   TreatmentDate?: string|Date,
     *   TreatmentResponse?: string,
     *   TreatmentIsActive?: boolean,
     *   VetName?: string,
     *   VetComments?: string,
     * }}
     * @returns {Promise<{ success: boolean, recordId: number, rowsAffected: number }>}
     */
    async createMedicalRecord(params) {
        const { cowTag, fields, ...flatParams } = params;

        const {
            recordType = 'treatment',
            EventID = null,
            Note = null,
            IssueDescription = null,
            IssueObservedBy = null,
            IssueObservationDate = null,
            IssueSerious = false,
            TreatmentMedicineID = null,
            TreatmentDate = null,
            TreatmentResponse = null,
            TreatmentIsActive = false,
            VetName = null,
            VetComments = null,
        } = fields ? { ...flatParams, ...fields } : flatParams;
        await this.ensureConnection();

        try {
            const validMedicineID = TreatmentMedicineID?.trim() || null;

            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('eventID', sql.Int, EventID);
            request.input('note', sql.NVarChar(sql.MAX), Note);
            request.input('maintenance', sql.Bit, recordType === 'maintenance');
            request.input('issue', sql.Bit, recordType === 'issue');
            request.input('treatment', sql.Bit, recordType === 'treatment');
            request.input('vet', sql.Bit, recordType === 'vet');
            request.input('issueDescription', sql.NVarChar(sql.MAX), IssueDescription);
            request.input('issueObservedBy', sql.NVarChar, IssueObservedBy);
            request.input('issueObservationDate', sql.DateTime, IssueObservationDate ? new Date(IssueObservationDate) : null);
            request.input('issueSerious', sql.Bit, IssueSerious);
            request.input('issueResolved', sql.Bit, false);
            request.input('treatmentMedicineID', sql.NVarChar, validMedicineID);
            request.input('treatmentDate', sql.DateTime, TreatmentDate ? new Date(TreatmentDate) : null);
            request.input('treatmentResponse', sql.NVarChar(sql.MAX), TreatmentResponse);
            request.input('treatmentIsActive', sql.Bit, TreatmentIsActive);
            request.input('vetName', sql.NVarChar, VetName);
            request.input('vetComments', sql.NVarChar(sql.MAX), VetComments);

            const result = await request.query(`
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
                )`);

            return {
                success: true,
                recordId: result.recordset[0].ID,
                rowsAffected: result.rowsAffected[0],
            };
        } catch (error) {
            console.error('Error creating medical record:', error);
            throw new Error(`Failed to create medical record: ${error.message}`);
        }
    }


    /**
     * Update a medical record
     * @param {{ recordId: number, fields: { Note?: string, IssueDescription?: string, IssueObservedBy?: string, IssueObservationDate?: string|Date, IssueSerious?: boolean, TreatmentMedicineID?: string, TreatmentDate?: string|Date, TreatmentResponse?: string, TreatmentIsActive?: boolean, VetName?: string, VetComments?: string } }}
     * @returns {Promise<{ success: boolean, rowsAffected: number }>}
     */
    async updateMedicalRecord({ recordId, fields = {} }) {
        await this.ensureConnection();

        if (!recordId) throw new Error('recordId is required for updateMedicalRecord');
        if (Object.keys(fields).length === 0) throw new Error('No fields provided for update');

        try {
            const processDate = (value) =>
                value instanceof Date || (typeof value === 'string' && value.trim())
                    ? new Date(value) : null;

            const fieldMap = {
                Note: { value: fields.Note, type: sql.NVarChar(sql.MAX) },
                IssueDescription: { value: fields.IssueDescription, type: sql.NVarChar(sql.MAX) },
                IssueObservedBy: { value: fields.IssueObservedBy, type: sql.NVarChar },
                IssueObservationDate: { value: processDate(fields.IssueObservationDate), type: sql.DateTime },
                IssueSerious: { value: fields.IssueSerious, type: sql.Bit },
                TreatmentMedicineID: { value: fields.TreatmentMedicineID, type: sql.NVarChar },
                TreatmentDate: { value: processDate(fields.TreatmentDate), type: sql.DateTime },
                TreatmentResponse: { value: fields.TreatmentResponse, type: sql.NVarChar(sql.MAX) },
                TreatmentIsActive: { value: fields.TreatmentIsActive, type: sql.Bit },
                VetName: { value: fields.VetName, type: sql.NVarChar },
                VetComments: { value: fields.VetComments, type: sql.NVarChar(sql.MAX) },
            };

            const request = this.pool.request();
            request.input('recordId', sql.Int, recordId);

            const setClauses = [];

            for (const [fieldName, { value, type }] of Object.entries(fieldMap)) {
                if (!(fieldName in fields)) continue;
                const paramName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
                request.input(paramName, type, value);
                setClauses.push(`[${fieldName}] = @${paramName}`);
            }

            if (setClauses.length === 0) throw new Error('No valid update clauses generated');

            const result = await request.query(`
                UPDATE MedicalTable
                SET ${setClauses.join(', ')}
                WHERE ID = @recordId`);

            if (result.rowsAffected[0] === 0) throw new Error('Medical record not found');

            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error updating medical record:', error);
            throw new Error(`Failed to update medical record: ${error.message}`);
        }
    }


    /**
     * Delete a medical record by ID
     * @param {{ recordId: number }}
     * @returns {Promise<{ success: boolean, deleted: number }>}
     */
    async deleteMedicalRecord({ recordId }) {
        await this.ensureConnection();
        if (!recordId) throw new Error('recordId is required for deleteMedicalRecord');

        try {
            const request = this.pool.request();
            request.input('id', sql.Int, recordId);

            const result = await request.query(`DELETE FROM MedicalTable WHERE ID = @id`);

            if (result.rowsAffected[0] === 0) throw new Error(`No medical record found with ID ${recordId}`);

            return { success: true, deleted: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error deleting medical record:', error);
            throw error;
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






































    //                  HERD MANAGMENT //////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Resolve an active herd name to its HerdID
     * @param {string} herdName
     * @returns {Promise<number>} HerdID
     */
    async _resolveHerdID(herdName) {
        const result = await this.pool.request()
            .input('herdName', sql.NVarChar, herdName)
            .query(`SELECT HerdID FROM Herds WHERE HerdName = @herdName AND Active = 1`);

        if (result.recordset.length === 0) {
            throw new Error(`No active herd found with name: ${herdName}`);
        }

        return result.recordset[0].HerdID;
    }

    /**
     * Resolve a HerdID to its active herd name
     * @param {number} herdID
     * @returns {Promise<string>} HerdName
     */
    async _resolveHerdName(herdID) {
        const result = await this.pool.request()
            .input('herdID', sql.Int, herdID)
            .query(`SELECT HerdName FROM Herds WHERE HerdID = @herdID AND Active = 1`);

        if (result.recordset.length === 0) {
            throw new Error(`No active herd found with ID: ${herdID}`);
        }

        return result.recordset[0].HerdName;
    }


    /**
     * Get all active herds. current pasture and days on pasture.
     * @returns {Object} - { herds: [...] }
     */
    async getHerds() {
        await this.ensureConnection();

        try {
            const [herdsResult, movementsResult] = await Promise.all([
                this.pool.request().query(`
                    SELECT HerdID, HerdName, CurrentPasture
                    FROM Herds
                    WHERE Active = 1
                    ORDER BY HerdName
                `),
                this.pool.request().query(`
                    SELECT m.HerdID, m.NewPasture, m.DateRecorded
                    FROM HerdMovementRecords m
                    INNER JOIN (
                        SELECT HerdID, MAX(DateRecorded) AS LatestDate
                        FROM HerdMovementRecords
                        GROUP BY HerdID
                    ) latest ON latest.HerdID = m.HerdID AND latest.LatestDate = m.DateRecorded
                `)
            ]);

            const movementByHerd = {};
            for (const m of movementsResult.recordset) {
                movementByHerd[m.HerdID] = m;
            }

            const now = new Date();

            const herds = herdsResult.recordset.map(herd => {
                const movement = movementByHerd[herd.HerdID];
                const daysOnPasture = movement
                    ? Math.floor((now - new Date(movement.DateRecorded)) / (1000 * 60 * 60 * 24))
                    : null;

                return {
                    herdID: herd.HerdID,
                    herdName: herd.HerdName,
                    currentPasture: herd.CurrentPasture,
                    daysOnPasture
                };
            });

            return { herds };
        } catch (error) {
            console.error('Error fetching herds:', error);
            throw new Error(`Failed to fetch herds: ${error.message}`);
        }
    }

    /**
     * Set herd membership for cows and/or goats. If this causes a herd to become empty, disable it.
     * Accepts cowTags and/or goatTags (arrays).
     */
    async setAnimalsHerd(params) {
        const { cowTags, goatTags, herdName } = params;
        await this.ensureConnection();

        const now = new Date();
        const transaction = this.pool.transaction();

        try {
            await transaction.begin();

            // Resolve herdName to active HerdID
            const herdResult = await transaction.request()
                .input('herdName', sql.NVarChar, herdName)
                .query(`SELECT HerdID FROM Herds WHERE HerdName = @herdName AND Active = 1`);

            if (herdResult.recordset.length === 0) {
                await transaction.rollback();
                throw new Error(`No active herd found with name: ${herdName}`);
            }

            const herdID = herdResult.recordset[0].HerdID;

            // Update cow herd membership
            if (cowTags?.length) {
                await transaction.request()
                    .input('herdID', sql.Int, herdID)
                    .input('cowTags', sql.NVarChar, cowTags.join(','))
                    .query(`
                        UPDATE CowTable
                        SET HerdID = @herdID
                        WHERE CowTag IN (SELECT value FROM STRING_SPLIT(@cowTags, ','))
                    `);

                // Insert cow history records
                await transaction.request()
                    .input('herdID', sql.Int, herdID)
                    .input('cowTags', sql.NVarChar, cowTags.join(','))
                    .input('dateJoined', sql.DateTime, now)
                    .query(`
                        INSERT INTO HerdMembershipHistory (HerdID, CowTag, DateJoined)
                        SELECT @herdID, value, @dateJoined
                        FROM STRING_SPLIT(@cowTags, ',')
                    `);
            }

            // Update goat herd membership
            if (goatTags?.length) {
                await transaction.request()
                    .input('herdID', sql.Int, herdID)
                    .input('goatTags', sql.NVarChar, goatTags.join(','))
                    .query(`
                        UPDATE Goats
                        SET HerdID = @herdID
                        WHERE GoatTag IN (SELECT value FROM STRING_SPLIT(@goatTags, ','))
                    `);

                // GoatMembershipHistory table does not exist yet -- insert history records here when created
            }

            // Deactivate any active herd that now has zero active animals
            await transaction.request()
                .query(`
                    UPDATE Herds
                    SET Active = 0
                    WHERE Active = 1
                    AND HerdID NOT IN (
                        SELECT DISTINCT HerdID FROM CowTable
                        WHERE HerdID IS NOT NULL
                        AND ${STATUS_ACTIVE}
                        UNION
                        SELECT DISTINCT HerdID FROM Goats
                        WHERE HerdID IS NOT NULL
                        AND ${STATUS_ACTIVE}
                    )
                `);

            await transaction.commit();

            return {
                success: true,
                movedCount: (cowTags?.length ?? 0) + (goatTags?.length ?? 0),
                herdName
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error in setAnimalsHerd:', error);
            throw new Error(`Failed to set animal herd: ${error.message}`);
        }
    }


    /**
     * Create a herd with the given name and cows
     */
    async createHerd(params) {
        const { herdName, cowTags, currentPasture } = params;
        await this.ensureConnection();

        try {
            // Reject if an active herd with this name already exists
            const conflictResult = await this.pool.request()
                .input('herdName', sql.NVarChar, herdName)
                .query(`SELECT 1 FROM Herds WHERE HerdName = @herdName AND Active = 1`);

            if (conflictResult.recordset.length > 0) {
                throw new Error(`An active herd named "${herdName}" already exists`);
            }

            // Create herd
            await this.pool.request()
                .input('herdName', sql.NVarChar, herdName)
                .input('currentPasture', sql.NVarChar, currentPasture)
                .query(`INSERT INTO Herds (HerdName, CurrentPasture, Active) VALUES (@herdName, @currentPasture, 1)`);

            // Batch move cows to new herd
            if (cowTags && cowTags.length > 0) {
                await this.setAnimalsHerd({ cowTags, herdName });
            }

            return { success: true, herdName };
        } catch (error) {
            console.error('Error creating herd:', error);
            throw error;
        }
    }




    /**
     * Get all animals in a specific herd. excludes inactive animals by default
     * @param {Object} params - { herdName, getInactive=false, cattleOnly=false }
     */
    async getHerdAnimals(params) {
        const { herdName, getInactive = false, cattleOnly = false } = params;
        await this.ensureConnection();

        try {
            const statusFilter = getInactive ? '' : `AND ${STATUS_ACTIVE}`;

            let herdID = null;
            if (herdName && herdName !== 'All active') {
                const herdResult = await this.pool.request()
                    .input('herdName', sql.NVarChar, herdName)
                    .query(`SELECT HerdID FROM Herds WHERE HerdName = @herdName AND Active = 1`);

                if (herdResult.recordset.length === 0) {
                    throw new Error(`No active herd found with name: ${herdName}`);
                }

                herdID = herdResult.recordset[0].HerdID;
            }

            // Build cows query
            const cowsRequest = this.pool.request();
            let cowsQuery;

            if (herdID) {
                cowsRequest.input('herdID', sql.Int, herdID);
                cowsQuery = `
                    SELECT CowTag, DateOfBirth AS DOB, Sex, Status, Description,
                        CONVERT(varchar, DateOfBirth, 120) AS FormattedDOB
                    FROM CowTable
                    WHERE HerdID = @herdID
                    AND CowTag IS NOT NULL
                    ${statusFilter}
                    ORDER BY CowTag`;
            } else {
                cowsQuery = `
                    SELECT c.CowTag, c.DateOfBirth AS DOB, c.Sex, c.Status, c.Description,
                        CONVERT(varchar, c.DateOfBirth, 120) AS FormattedDOB
                    FROM CowTable c
                    INNER JOIN Herds h ON h.HerdID = c.HerdID AND h.Active = 1
                    WHERE c.CowTag IS NOT NULL
                    ${statusFilter}
                    ORDER BY c.CowTag`;
            }

            const cowsResult = await cowsRequest.query(cowsQuery);

            if (cattleOnly) {
                return cowsResult.recordset.map(r => r.CowTag);
            }

            // Build goats query
            const goatsRequest = this.pool.request();
            let goatsQuery;

            if (herdID) {
                goatsRequest.input('herdID', sql.Int, herdID);
                goatsQuery = `
                    SELECT GoatTag AS CowTag, DateOfBirth AS DOB, Sex, Status, Description,
                        NULL AS FormattedDOB
                    FROM Goats
                    WHERE HerdID = @herdID
                    AND GoatTag IS NOT NULL
                    ${statusFilter}
                    ORDER BY GoatTag`;
            } else {
                goatsQuery = `
                    SELECT g.GoatTag AS CowTag, g.DateOfBirth AS DOB, g.GoatType, g.Status, g.[Color Markings],
                        NULL AS FormattedDOB
                    FROM Goats g
                    INNER JOIN Herds h ON h.HerdID = g.HerdID AND h.Active = 1
                    WHERE g.GoatTag IS NOT NULL
                    ${statusFilter}
                    ORDER BY g.GoatTag`;
            }

            const goatsResult = await goatsRequest.query(goatsQuery);

            return {
                animals: [
                    ...cowsResult.recordset,
                    ...goatsResult.recordset
                ]
            };
        } catch (error) {
            console.error('Error fetching herd animals:', error);
            throw new Error(`Failed to fetch herd animals: ${error.message}`);
        }
    }




    /**
     * Move herd to a pasture
     * @param {Object} params - { herdName, newPastureName }
     */
    async moveHerd(params) {
        const { herdName, newPastureName } = params;
        await this.ensureConnection();

        try {
            // Resolve herdName to active HerdID
            const herdResult = await this.pool.request()
                .input('herdName', sql.NVarChar, herdName)
                .query(`SELECT HerdID FROM Herds WHERE HerdName = @herdName AND Active = 1`);

            if (herdResult.recordset.length === 0) {
                throw new Error(`No active herd found with name: ${herdName}`);
            }

            const herdID = herdResult.recordset[0].HerdID;

            // Update herd's current pasture
            await this.pool.request()
                .input('herdID', sql.Int, herdID)
                .input('newPasture', sql.NVarChar, newPastureName)
                .query(`UPDATE Herds SET CurrentPasture = @newPasture WHERE HerdID = @herdID`);

            // Record the movement
            await this.pool.request()
                .input('herdID', sql.Int, herdID)
                .input('newPasture', sql.NVarChar, newPastureName)
                .input('dateRecorded', sql.DateTime, new Date())
                .query(`
                    INSERT INTO HerdMovementRecords (HerdID, NewPasture, DateRecorded)
                    VALUES (@herdID, @newPasture, @dateRecorded)
                `);

            return { success: true, message: 'Herd moved successfully' };
        } catch (error) {
            console.error('moveHerd error, new pasture name:', JSON.stringify(newPastureName), 'length:', newPastureName.length);
            throw new Error(`Failed to move herd: ${error.message}`);
        }
    }



    /**
     * Get all herd events and notes
     * @param {Object} params
     * @param {string} params.herdName
     * @returns {Promise<{events: Array<Object>, herdNotes: Array<Object>}>}
     */
    async getHerdEvents(params) {
        const { herdName } = params;
        await this.ensureConnection();

        try {
            const herdResult = await this.pool.request()
                .input('herdName', sql.NVarChar, herdName)
                .query(`SELECT HerdID FROM Herds WHERE HerdName = @herdName AND Active = 1`);

            if (herdResult.recordset.length === 0) {
                throw new Error(`No active herd found with name: ${herdName}`);
            }

            const herdID = herdResult.recordset[0].HerdID;

            const result = await this.pool.request()
                .input('herdID', sql.Int, herdID)
                .query(`
                SELECT 'movement' AS eventType, DateRecorded AS dateRecorded,
                    CONCAT('Herd moved to ', NewPasture) AS description, NULL AS notes, NULL AS username
                FROM HerdMovementRecords
                WHERE HerdID = @herdID
            `);

            const notesResult = await this.pool.request()
                .input('herdID', sql.Int, herdID)
                .query(`
                SELECT ID, HerdID, DateOfEntry, Username, Note, Archive
                FROM HerdNotes
                WHERE HerdID = @herdID
            `);

            return {
                movement: result.recordset,
                herdNotes: notesResult.recordset,
                events: {}
            };
        } catch (error) {
            console.error('Error fetching herd events:', error);
            throw error;
        }
    }





    /**
     * Get a single herd note by ID
     * @param {Object} params
     * @param {number} params.noteID
     * @returns {Promise<{note: Object}>}
     */
    async getHerdNote(params) {
        const { noteID } = params;
        await this.ensureConnection();

        try {
            const result = await this.pool.request()
                .input('noteID', sql.Int, noteID)
                .query(`
                SELECT ID, HerdID, DateOfEntry, Username, Note, Archive
                FROM HerdNotes
                WHERE ID = @noteID
            `);

            if (result.recordset.length === 0) {
                throw new Error(`No note found with ID: ${noteID}`);
            }

            return { note: result.recordset[0] };
        } catch (error) {
            console.error('Error fetching herd note:', error);
            throw error;
        }
    }





    /**
     * Add a new herd note
     * @param {Object} params
     * @param {number} params.herdID
     * @param {string} params.username
     * @param {string} params.note
     * @returns {Promise<{noteID: number}>}
     */
    async addHerdNote(params) {
        const { herdID, username, note } = params;
        await this.ensureConnection();

        try {
            const result = await this.pool.request()
                .input('herdID', sql.Int, herdID)
                .input('username', sql.VarChar, username)
                .input('note', sql.VarChar, note)
                .query(`
                INSERT INTO HerdNotes (HerdID, DateOfEntry, Username, Note, Archive)
                VALUES (@herdID, GETUTCDATE(), @username, @note, 0);
                SELECT SCOPE_IDENTITY() AS noteID;
            `);

            return { noteID: result.recordset[0].noteID };
        } catch (error) {
            console.error('Error adding herd note:', error);
            throw error;
        }
    }





    /**
     * Update an existing herd note's text and/or archive status
     * @param {Object} params
     * @param {number} params.noteID
     * @param {string} [params.note]
     * @param {boolean} [params.archive]
     * @returns {Promise<{success: boolean}>}
     */
    async updateHerdNote(params) {
        const { noteID, note, archive } = params;
        await this.ensureConnection();

        try {
            await this.pool.request()
                .input('noteID', sql.Int, noteID)
                .input('note', sql.VarChar, note ?? null)
                .input('archive', sql.Bit, archive ?? null)
                .query(`
                UPDATE HerdNotes
                SET
                    Note    = COALESCE(@note, Note),
                    Archive = COALESCE(@archive, Archive)
                WHERE ID = @noteID
            `);

            return { success: true };
        } catch (error) {
            console.error('Error updating herd note:', error);
            throw error;
        }
    }





    /**
     * Delete a herd note by ID
     * @param {Object} params
     * @param {number} params.noteID
     * @returns {Promise<{success: boolean}>}
     */
    async deleteHerdNote(params) {
        const { noteID } = params;
        await this.ensureConnection();

        try {
            await this.pool.request()
                .input('noteID', sql.Int, noteID)
                .query(`DELETE FROM HerdNotes WHERE ID = @noteID`);

            return { success: true };
        } catch (error) {
            console.error('Error deleting herd note:', error);
            throw error;
        }
    }




    /**
     * Add an event
     */
    async addHerdEvent(params) {
        throw new Error('Not yet implemented');
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
     * Get feed status for a specific herd, optionally filtered by feed types
     * @param {Object} params - { herdName, feeds? }
     */
    async getHerdFeedStatus(params) {
        const { herdName, feeds } = params;
        await this.ensureConnection();

        try {
            const herdID = await this._resolveHerdID(herdName);

            const herdResult = await this.pool.request()
                .input('herdID', sql.Int, herdID)
                .query(`SELECT CurrentPasture FROM Herds WHERE HerdID = @herdID`);

            const pastureName = herdResult.recordset[0].CurrentPasture;
            if (!pastureName) {
                throw new Error(`Herd '${herdName}' is not assigned to a pasture`);
            }

            // Get all feed types (or filtered list)
            let feedTypesResult;
            if (feeds && feeds.length > 0) {
                const feedTypesRequest = this.pool.request();
                const feedPlaceholders = feeds.map((_, index) => `@feed${index}`).join(',');
                feeds.forEach((feed, index) => {
                    feedTypesRequest.input(`feed${index}`, sql.NVarChar, feed);
                });
                feedTypesResult = await feedTypesRequest.query(
                    `SELECT Feed FROM PastureFeedOptions WHERE Feed IN (${feedPlaceholders}) ORDER BY Feed`
                );
            } else {
                feedTypesResult = await this.pool.request()
                    .query(`SELECT Feed FROM PastureFeedOptions ORDER BY Feed`);
            }

            const feedStatus = [];

            for (const feedType of feedTypesResult.recordset) {
                const feed = feedType.Feed;

                const activityResult = await this.pool.request()
                    .input('pasture', sql.NVarChar, pastureName)
                    .input('feedType', sql.NVarChar, feed)
                    .query(`
                        SELECT TOP 1 DateCompleted, WasRefilled, WasEmpty
                        FROM PastureFeedRecords
                        WHERE Pasture = @pasture AND FeedType = @feedType
                        ORDER BY DateCompleted DESC
                    `);

                let lastActivityDate = null;
                let daysAgo = null;
                let lastActivity = null;

                if (activityResult.recordset.length > 0) {
                    const record = activityResult.recordset[0];
                    lastActivityDate = record.DateCompleted;
                    daysAgo = Math.floor((new Date() - new Date(record.DateCompleted)) / (1000 * 60 * 60 * 24));

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
                    lastActivityDate,
                    daysAgo,
                    lastActivity,
                    displayText: daysAgo !== null ? `${daysAgo} days ago` : "never"
                });
            }

            return { pastureName, feedStatus };
        } catch (error) {
            console.error('Error fetching herd feed status:', error);
            throw new Error(`Failed to fetch feed status: ${error.message}`);
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
            const herdID = await this._resolveHerdID(herdName);

            const herdResult = await this.pool.request()
                .input('herdID', sql.Int, herdID)
                .query(`SELECT CurrentPasture FROM Herds WHERE HerdID = @herdID`);

            const pastureName = herdResult.recordset[0].CurrentPasture;
            if (!pastureName) {
                throw new Error(`Herd '${herdName}' is not assigned to a pasture`);
            }

            const now = new Date();

            const insertRecord = async (wasRefilled, isEmpty, level) => {
                await this.pool.request()
                    .input('pasture', sql.NVarChar, pastureName)
                    .input('dateCompleted', sql.DateTime, now)
                    .input('username', sql.NVarChar, username)
                    .input('feedType', sql.NVarChar, feedType)
                    .input('wasRefilled', sql.Bit, wasRefilled)
                    .input('wasEmpty', sql.Bit, isEmpty)
                    .input('levelAtRefill', sql.Int, level)
                    .query(`
                        INSERT INTO PastureFeedRecords (Pasture, DateCompleted, Username, FeedType, WasRefilled, WasEmpty, LevelAtRefill)
                        VALUES (@pasture, @dateCompleted, @username, @feedType, @wasRefilled, @wasEmpty, @levelAtRefill)
                    `);
            };

            if (activityType === "refilled") {
                await insertRecord(false, wasEmpty, wasEmpty ? 0 : 100);
                await insertRecord(true, false, 100);
            } else if (activityType === "level_check") {
                await insertRecord(false, levelAtRefill < 5, levelAtRefill);
            } else {
                const isEmpty = activityType === "checked_empty";
                await insertRecord(false, isEmpty, isEmpty ? 0 : 100);
            }

            return { success: true, message: 'Feed activity recorded successfully' };
        } catch (error) {
            console.error('Error recording feed activity:', error);
            throw error;
        }
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
            SELECT c.CowTag, h.HerdName
            FROM CowTable c
            LEFT JOIN Herds h ON h.HerdID = c.HerdID
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
                    h.HerdName,
                    c.Castrated,
                    c.Status,
                    DATEDIFF(month, c.DateOfBirth, GETUTCDATE()) AS AgeInMonths,
                    CASE WHEN wr.ID IS NOT NULL THEN 1 ELSE 0 END AS HasWeaningRecord,
                    CASE WHEN br.ID IS NOT NULL THEN 1 ELSE 0 END AS HasCurrentBreedingRecord,
                    CASE 
                        -- Bulls: Male and not castrated (Castrated = 0 or NULL)
                        WHEN (c.Sex = 'Bull' OR (c.Sex = 'Male' AND (c.Castrated IS NULL OR c.Castrated = 0))) THEN 'bull'
                        
                        -- Female categorization
                        WHEN c.Sex = 'Female' THEN
                            CASE 
                                -- Calves: Female, < 12 months, no weaning record
                                WHEN DATEDIFF(month, c.DateOfBirth, GETUTCDATE()) < 12 AND wr.ID IS NULL THEN 'calf'
                                
                                -- Yearlings: Female, < 24 months, AND (> 12 months OR has weaning record)
                                WHEN DATEDIFF(month, c.DateOfBirth, GETUTCDATE()) < 24 
                                    AND (DATEDIFF(month, c.DateOfBirth, GETUTCDATE()) >= 12 OR wr.ID IS NOT NULL) THEN 'yearling'
                                
                                -- Assigned cows: Female, >= 24 months, has breeding record for current plan
                                WHEN DATEDIFF(month, c.DateOfBirth, GETUTCDATE()) >= 24 AND br.ID IS NOT NULL THEN 'assigned-cow'
                                
                                -- Unassigned cows: Female, >= 24 months, no breeding record for current plan
                                WHEN DATEDIFF(month, c.DateOfBirth, GETUTCDATE()) >= 24 AND br.ID IS NULL THEN 'unassigned-cow'
                                
                                ELSE 'unknown-female'
                            END
                        ELSE 'other'
                    END AS Category
                FROM CowTable c
                LEFT JOIN WeaningRecords wr ON c.CowTag = wr.CowTag
                LEFT JOIN BreedingRecords br ON c.CowTag = br.CowTag AND br.PlanID = @currentPlanId
                LEFT JOIN Herds h ON h.HerdID = c.HerdID
                WHERE ${STATUS_ACTIVE}
                ORDER BY c.CowTag`

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
                    UPDATE SET IsPregnant = @isPregnant, PregCheckDate = GETUTCDATE()
                WHEN NOT MATCHED THEN
                    INSERT (CowTag, BreedingRecordID, IsPregnant, PregCheckDate, EventID)
                    VALUES (@cowTag, @breedingRecordId, @isPregnant, GETUTCDATE(), NULL);`;

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
            let herdID = null;
            if (herdName && herdName !== 'ALL ACTIVE') {
                herdID = await this._resolveHerdID(herdName);
            }

            const request = this.pool.request();
            if (herdID) {
                request.input('herdID', sql.Int, herdID);
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
                ${herdID ? 'INNER JOIN Herds h ON h.HerdID = c.HerdID AND h.Active = 1' : ''}
                WHERE ${herdID ? 'c.HerdID = @herdID AND' : ''}
                    ${STATUS_ACTIVE}
                ORDER BY c.CowTag`;

            const result = await request.query(query);
            return { candidates: result.recordset };
        } catch (error) {
            console.error('Error fetching breeding candidates:', error);
            throw new Error(`Failed to fetch breeding candidates: ${error.message}`);
        }
    }















    //              PREGNANCY CHECK  //////////////////////////////////////////////////////////////////////////////////////////


    /**
     * Get a pregnancy check record by ID
     * @param {{ recordId: number }} params
     * @returns {Promise<Object | null>}
     */
    async getPregancyCheck({ recordId }) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('id', sql.Int, recordId);

            const result = await request.query(`
                SELECT TOP 1
                    pc.ID,
                    pc.IsPregnant,
                    FORMAT(pc.PregCheckDate, 'yyyy-MM-dd') AS PregCheckDate,
                    pc.FetusSex,
                    pc.MonthsPregnant,
                    pc.Notes,
                    wr.Weight AS WeightAtCheck
                FROM PregancyCheck pc
                LEFT JOIN WeightRecords wr ON pc.WeightRecordID = wr.ID
                WHERE pc.ID = @id`);

            if (result.recordset.length === 0) return null;

            const row = result.recordset[0];
            return {
                ID: row.ID,
                IsPregnant: row.IsPregnant === 1 ? 'Pregnant' : (row.IsPregnant === 0 ? 'Open' : ''),
                PregCheckDate: row.PregCheckDate || '',
                FetusSex: row.FetusSex || '',
                MonthsPregnant: row.MonthsPregnant ?? '',
                Notes: row.Notes || '',
                WeightAtCheck: row.WeightAtCheck || ''
            };

        } catch (error) {
            console.error(`Error fetching pregnancy check ${recordId}:`, error);
            throw error;
        }
    }





    /**
     * Create one or more pregnancy check records.
     * Accepts a single { cowTag, fields } or an array of them.
     *
     * fields: {
     *   IsPregnant     - boolean | 'Pregnant' | 'Open'   (required)
     *   PregCheckDate  - date string                      (defaults to now)
     *   FetusSex       - string                           (optional)
     *   MonthsPregnant - number                           (optional)
     *   PregNotes      - string                           (optional)
     * }
     *
     * Single:  returns { success: boolean, recordId: number }
     * Batch:   returns { success: boolean, created: number, results: [{ cowTag, recordId }] }
     */
    async createPregancyCheck(params) {
        await this.ensureConnection();

        const isArray = Array.isArray(params);
        const records = isArray ? params : [params];

        if (records.length === 0) return { success: true, created: 0, results: [] };

        const results = [];

        for (const { cowTag, fields = {} } of records) {
            const {
                IsPregnant,
                PregCheckDate = null,
                FetusSex = null,
                MonthsPregnant = null,
                Notes = null,
            } = fields;

            // Resolve most recent breeding record for this cow
            const brRequest = this.pool.request();
            brRequest.input('cowTag', sql.NVarChar, cowTag);
            const brResult = await brRequest.query(`
                SELECT TOP 1 ID FROM BreedingRecords
                WHERE CowTag = @cowTag
                ORDER BY ExposureStartDate DESC`);

            let breedingRecordId = null;
            if (brResult.recordset.length === 0) {
                console.warn(`createPregancyCheck: Warning, no breeding record found for ${cowTag}`);
            }
            else {
                breedingRecordId = brResult.recordset[0].ID;
            }



            // Accept boolean or string ('Pregnant' / 'Open')
            const isPregnantBit = typeof IsPregnant === 'boolean'
                ? IsPregnant
                : IsPregnant === 'Pregnant';

            const request = this.pool.request();
            request.input('breedingRecordId', sql.Int, breedingRecordId);
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('isPregnant', sql.Bit, isPregnantBit);
            request.input('pregCheckDate', sql.DateTime, PregCheckDate ? new Date(PregCheckDate) : new Date());
            request.input('fetusSex', sql.NVarChar, FetusSex);
            request.input('monthsPregnant', sql.Decimal(4, 2), MonthsPregnant != null ? parseFloat(MonthsPregnant) : null);
            request.input('notes', sql.NVarChar(sql.MAX), Notes);

            const result = await request.query(`
                INSERT INTO PregancyCheck (BreedingRecordID, CowTag, IsPregnant, PregCheckDate, FetusSex, MonthsPregnant, Notes)
                OUTPUT INSERTED.ID
                VALUES (@breedingRecordId, @cowTag, @isPregnant, @pregCheckDate, @fetusSex, @monthsPregnant, @notes)`);

            results.push({ cowTag, recordId: result.recordset[0].ID });
        }

        if (!isArray) {
            return { success: true, recordId: results[0]?.recordId ?? null };
        }

        return { success: true, created: results.length, results };
    }



    /**
     * Update a pregnancy check record by ID.
     * Accepts the sheet-standard { recordId, cowTag, fields } shape.
     *
     * fields: {
     *   IsPregnant     - boolean | 'Pregnant' | 'Open'
     *   PregCheckDate  - date string
     *   FetusSex       - string
     *   MonthsPregnant - number
     *   PregNotes      - string
     * }
     *
     * @param {{ recordId: number, cowTag: string, fields: Object }} params
     * @returns {Promise<{ success: boolean, updated: number }>}
     */
    async updatePregancyCheck({ recordId, cowTag, fields = {} }) {
        await this.ensureConnection();

        if (!recordId) throw new Error('recordId is required for updatePregancyCheck');
        if (Object.keys(fields).length === 0) return { success: true, updated: 0 };

        try {
            // Remap catalogue keys to DB column names
            let updates = { ...fields };
            if ('PregNotes' in updates) {
                updates.Notes = updates.PregNotes;
                delete updates.PregNotes;
            }

            // Weight is not a direct column, route through WeightRecords
            if ('Weight' in updates) {
                const weightValue = parseInt(updates.Weight);

                if (!weightValue || weightValue <= 0) {
                    const clearRequest = this.pool.request();
                    clearRequest.input('id', sql.Int, recordId);
                    await clearRequest.query(`
                        UPDATE PregancyCheck 
                        SET WeightRecordID = NULL
                        WHERE ID = @id`);
                } else {
                    const pregRequest = this.pool.request();
                    pregRequest.input('id', sql.Int, recordId);
                    const pregResult = await pregRequest.query(`
                        SELECT WeightRecordID FROM PregancyCheck WHERE ID = @id`);

                    if (pregResult.recordset.length === 0) {
                        throw new Error(`No pregnancy check found with ID ${recordId}`);
                    }

                    const { WeightRecordID: existingWeightRecordId } = pregResult.recordset[0];

                    if (existingWeightRecordId) {
                        await this.updateWeightRecord({ recordId: existingWeightRecordId, Weight: weightValue });
                    } else {
                        const { recordId: weightRecordId } = await this.createWeightRecord({ cowTag, Weight: weightValue });
                        const linkRequest = this.pool.request();
                        linkRequest.input('id', sql.Int, recordId);
                        linkRequest.input('weightRecordId', sql.Int, weightRecordId);
                        await linkRequest.query(`
                            UPDATE PregancyCheck SET WeightRecordID = @weightRecordId WHERE ID = @id`);
                    }
                }

                delete updates.Weight;
            }

            if (Object.keys(updates).length === 0) return { success: true, updated: 0 };

            const request = this.pool.request();
            request.input('id', sql.Int, recordId);

            const setClauses = [];

            for (const [field, value] of Object.entries(updates)) {
                if (field === 'PregCheckDate') {
                    request.input(field, sql.Date, value);
                } else if (field === 'IsPregnant') {
                    request.input(field, sql.Bit, typeof value === 'boolean' ? value : value === 'Pregnant');
                } else if (field === 'MonthsPregnant') {
                    request.input(field, sql.Decimal(4, 2), parseFloat(value) || null);
                } else if (field === 'FetusSex') {
                    request.input(field, sql.NVarChar, value);
                } else if (field === 'Notes') {
                    request.input(field, sql.NVarChar(sql.MAX), value);
                } else {
                    throw new Error(`Unknown PregancyCheck field: ${field}`);
                }

                setClauses.push(`[${field}] = @${field}`);
            }

            const result = await request.query(`
                UPDATE PregancyCheck
                SET ${setClauses.join(', ')}
                WHERE ID = @id`);

            return { success: true, updated: result.rowsAffected[0] };

        } catch (error) {
            console.error('Error updating pregnancy check:', error);
            throw error;
        }
    }


    /**
     * Delete a pregnancy check record by ID
     * Weight records linked to this check are left intact
     * @param {Object} params
     * @param {number} params.recordId - ID of the PregancyCheck record to delete (required)
     * @returns {Promise<{ success: boolean, deleted: number }>}
     */
    async deletePregancyCheck({ recordId }) {
        await this.ensureConnection();

        if (!recordId) throw new Error('id is required for deletePregancyCheck');

        try {
            const request = this.pool.request();
            request.input('id', sql.Int, recordId);

            const result = await request.query(`
                DELETE FROM PregancyCheck
                WHERE ID = @id`);

            console.log('deletePregancyCheck result:', result.rowsAffected);

            if (result.rowsAffected[0] === 0) {
                throw new Error(`No pregnancy check found with ID ${id}`);
            }

            return { success: true, deleted: result.rowsAffected[0] };

        } catch (error) {
            console.error('Error deleting pregnancy check:', error);
            throw error;
        }
    }




















    //              CALVING RECORDS  //////////////////////////////////////////////////////////////////////////////////////////


    /**
     * Get calving status for herd
     * @param {Object} params - { herdName }
     */
    async getCalvingStatus(params) {
        const { herdName } = params;
        await this.ensureConnection();

        try {
            let herdID = null;
            if (herdName && herdName !== 'ALL ACTIVE') {
                herdID = await this._resolveHerdID(herdName);
            }

            const request = this.pool.request();
            if (herdID) {
                request.input('herdID', sql.Int, herdID);
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
                ${herdID ? 'INNER JOIN Herds h ON h.HerdID = c.HerdID AND h.Active = 1' : ''}
                WHERE ${herdID ? 'c.HerdID = @herdID AND' : ''}
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
     * Get a calving record by ID
     * @param {Object} params
     * @param {number} params.id - ID of the CalvingRecord to fetch (required)
     * @returns {Promise<{
     *   ID:               number,
     *   BreedingRecordID: number,
     *   IsTagged:         boolean,
     *   CalfTag:          string,
     *   DamTag:           string,
     *   BirthDate:        string,
     *   CalfSex:          string,
     *   CalfDiedAtBirth:  boolean,
     *   DamDiedAtBirth:   boolean,
     *   CalvingNotes:     string
     * } | null>}  null if no matching record found
     */
    async getCalvingRecord({ id }) {
        await this.ensureConnection();

        if (!id) throw new Error('id is required for getCalvingRecord');

        try {
            const request = this.pool.request();
            request.input('id', sql.Int, id);

            const result = await request.query(`
                SELECT
                    ID,
                    BreedingRecordID,
                    IsTagged,
                    CalfTag,
                    DamTag,
                    FORMAT(BirthDate, 'yyyy-MM-dd') AS BirthDate,
                    CalfSex,
                    CalfDiedAtBirth,
                    DamDiedAtBirth,
                    CalvingNotes
                FROM CalvingRecords
                WHERE ID = @id`);

            if (result.recordset.length === 0) return null;

            const row = result.recordset[0];

            return {
                ID: row.ID,
                BreedingRecordID: row.BreedingRecordID,
                IsTagged: !!row.IsTagged,
                CalfTag: row.CalfTag || '',
                DamTag: row.DamTag || '',
                BirthDate: row.BirthDate || '',
                CalfSex: row.CalfSex || '',
                CalfDiedAtBirth: !!row.CalfDiedAtBirth,
                DamDiedAtBirth: !!row.DamDiedAtBirth,
                CalvingNotes: row.CalvingNotes || ''
            };

        } catch (error) {
            console.error('Error fetching calving record:', error);
            throw error;
        }
    }




    /**
     * Add calving record
     * @param {Object} params - { breedingRecordId, calfTag, damTag, birthDate, calfSex, notes, twins }
     */
    async createCalvingRecord(params) {
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
     * Update a calving record by ID
     * @param {Object} params
     * @param {number}  params.id                       - ID of the CalvingRecord to update (required)
     * @param {Object}  params.updates                  - Fields to update
     * @param {number}  [params.updates.BreedingRecordID]
     * @param {boolean} [params.updates.IsTagged]
     * @param {string}  [params.updates.CalfTag]
     * @param {string}  [params.updates.DamTag]
     * @param {string}  [params.updates.BirthDate]       - Date string
     * @param {string}  [params.updates.CalfSex]
     * @param {boolean} [params.updates.CalfDiedAtBirth]
     * @param {boolean} [params.updates.DamDiedAtBirth]
     * @param {string}  [params.updates.CalvingNotes]
     * @returns {Promise<{ success: boolean, updated: number }>}
     */
    async updateCalvingRecord({ id, updates }) {
        await this.ensureConnection();

        if (!id) throw new Error('id is required for updateCalvingRecord');
        if (!updates || Object.keys(updates).length === 0) return { success: true, updated: 0 };

        try {
            const request = this.pool.request();
            request.input('id', sql.Int, id);

            const setClauses = [];

            for (const [field, value] of Object.entries(updates)) {
                if (['IsTagged', 'CalfDiedAtBirth', 'DamDiedAtBirth'].includes(field)) {
                    request.input(field, sql.Bit, value);
                } else if (field === 'BreedingRecordID') {
                    request.input(field, sql.Int, value);
                } else if (field === 'BirthDate') {
                    request.input(field, sql.DateTime2, value ? new Date(value) : null);
                } else if (field === 'CalvingNotes') {
                    request.input(field, sql.NVarChar(sql.MAX), value);
                } else if (['CalfTag', 'DamTag', 'CalfSex'].includes(field)) {
                    request.input(field, sql.NVarChar, value);
                } else {
                    throw new Error(`Unknown CalvingRecord field: ${field}`);
                }

                setClauses.push(`[${field}] = @${field}`);
            }

            const result = await request.query(`
                UPDATE CalvingRecords
                SET ${setClauses.join(', ')}
                WHERE ID = @id`);

            if (result.rowsAffected[0] === 0) {
                throw new Error(`No calving record found with ID ${id}`);
            }

            console.log('updateCalvingRecord result:', result.rowsAffected);
            return { success: true, updated: result.rowsAffected[0] };

        } catch (error) {
            console.error('Error updating calving record:', error);
            throw error;
        }
    }



    /**
     * Delete a calving record by ID
     * @param {Object} params
     * @param {number} params.id - ID of the CalvingRecord to delete (required)
     * @returns {Promise<{ success: boolean, deleted: number }>}
     */
    async deleteCalvingRecord({ id }) {
        await this.ensureConnection();

        if (!id) throw new Error('id is required for deleteCalvingRecord');

        try {
            const request = this.pool.request();
            request.input('id', sql.Int, id);

            const result = await request.query(`
                DELETE FROM CalvingRecords
                WHERE ID = @id`);

            if (result.rowsAffected[0] === 0) {
                throw new Error(`No calving record found with ID ${id}`);
            }

            console.log('deleteCalvingRecord result:', result.rowsAffected);
            return { success: true, deleted: result.rowsAffected[0] };

        } catch (error) {
            console.error('Error deleting calving record:', error);
            throw error;
        }
    }
























    //              WEANING RECORDS  //////////////////////////////////////////////////////////////////////////////////////////



    /**
     * Get weaning candidates
     * @param {Object} params - { herdName }
     */
    async getWeaningCandidates(params) {
        const { herdName } = params;
        await this.ensureConnection();

        try {
            let herdID = null;
            if (herdName && herdName !== 'ALL ACTIVE') {
                herdID = await this._resolveHerdID(herdName);
            }

            const request = this.pool.request();
            if (herdID) {
                request.input('herdID', sql.Int, herdID);
            }

            const query = `
                SELECT 
                    c.CowTag,
                    CASE WHEN wr.ID IS NULL THEN 0 ELSE 1 END AS IsWeaned
                FROM CowTable c
                LEFT JOIN WeaningRecords wr ON c.CowTag = wr.CowTag
                ${herdID ? 'INNER JOIN Herds h ON h.HerdID = c.HerdID AND h.Active = 1' : ''}
                WHERE ${herdID ? 'c.HerdID = @herdID AND' : ''}
                    ${STATUS_ACTIVE}
                    AND c.DateOfBirth >= DATEADD(month, -24, GETUTCDATE())
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


    /**
     * @typedef {Object} UserPublic
     * @property {number}   id
     * @property {string|null} username
     * @property {string}   email
     * @property {string[]} permissions
     * @property {boolean}  blocked
     * @property {boolean}  preRegistered
     * @property {boolean}  hasPassword
     */

    /**
     * @typedef {Object} UserSession
     * @property {number}   id
     * @property {string}   username
     * @property {string}   email
     * @property {string[]} permissions
     */

    /**
     * @typedef {Object} BaseResult
     * @property {boolean} success
     * @property {string}  [message]
     */

    /**
     * @typedef {Object} CheckUsersResult
     * @property {boolean} success
     * @property {boolean} hasAdmin
     * @property {number}  userCount
     */

    /**
     * @typedef {Object} ImportUserRow
     * @property {string|null} username
     * @property {string}      Email
     * @property {string}      PasswordHash
     * @property {string}      Permissions
     * @property {boolean}     Blocked
     */


    /**
     * Checks whether the Users table has at least one active admin.
     * @returns {Promise<CheckUsersResult>}
     */
    async checkUsers() {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            const result = await request.query(`SELECT COUNT(*) AS userCount FROM Users WHERE Email IS NOT NULL`);
            const userCount = result.recordset[0].userCount;

            const adminRequest = this.pool.request();
            const adminResult = await adminRequest.query(`
            SELECT COUNT(*) AS adminCount
            FROM Users
            WHERE Blocked = 0
              AND Permissions LIKE '%admin%'
        `);
            const hasAdmin = adminResult.recordset[0].adminCount > 0;

            if (!hasAdmin && userCount > 0) {
                console.warn('WARNING: No active admin users found in database');
            }

            return { success: true, hasAdmin, userCount };
        } catch (error) {
            console.error('Error checking users:', error);
            throw error;
        }
    }

    /**
     * Returns all users, excluding password hashes.
     * @returns {Promise<BaseResult & { users?: UserPublic[] }>}
     */
    async getAllUsers() {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            const result = await request.query(`
            SELECT Username, Email, PasswordHash, Permissions, Blocked, PreRegistered
            FROM Users
            WHERE Email IS NOT NULL
        `);

            const users = result.recordset.map(row => ({
                username: row.Username,
                email: row.Email,
                permissions: row.Permissions ? row.Permissions.split('|').filter(Boolean) : [],
                blocked: !!row.Blocked,
                preRegistered: !!row.PreRegistered,
                hasPassword: !!row.PasswordHash && row.PasswordHash !== ''
            }));

            return { success: true, users };
        } catch (error) {
            console.error('Error getting all users:', error);
            return { success: false, message: `Failed to get users: ${error.message}` };
        }
    }

    /**
     * Looks up a single user by email address.
     * @param {{ email: string }} params
     * @returns {Promise<BaseResult & { exists: boolean, user?: UserPublic & { isAdmin: boolean } }>}
     */
    async lookupUser(params) {
        const { email } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('email', sql.NVarChar, email);

            const result = await request.query(`
            SELECT Username, Email, PasswordHash, Permissions, Blocked, PreRegistered
            FROM Users
            WHERE LOWER(Email) = LOWER(@email)
        `);

            if (result.recordset.length === 0) {
                return { success: false, exists: false, message: 'User not found' };
            }

            const row = result.recordset[0];
            const permissions = row.Permissions ? row.Permissions.split('|').filter(Boolean) : [];

            return {
                success: true,
                exists: true,
                user: {
                    username: row.Username,
                    email: row.Email,
                    permissions,
                    blocked: !!row.Blocked,
                    preRegistered: !!row.PreRegistered,
                    hasPassword: !!row.PasswordHash && row.PasswordHash !== '',
                    isAdmin: permissions.includes('admin')
                }
            };
        } catch (error) {
            console.error('Error looking up user:', error);
            return { success: false, message: `Failed to lookup user: ${error.message}` };
        }
    }

    /**
     * Completes registration for a new or pre-registered user.
     * First user to register is granted all permissions.
     * @param {{ username: string, email: string, password: string }} params
     * @returns {Promise<BaseResult & { user?: UserSession, wasPreregistered?: boolean, isFirstUser?: boolean }>}
     */
    async setupUser(params) {
        const { username, email, password } = params;
        await this.ensureConnection();

        try {
            if (username.toUpperCase() === 'PREREGISTERED') {
                return { success: false, message: 'Username "PREREGISTERED" is reserved. Please choose a different username.' };
            }

            const lookupRequest = this.pool.request();
            lookupRequest.input('email', sql.NVarChar, email);
            const existing = await lookupRequest.query(`
            SELECT Username, Permissions, PreRegistered
            FROM Users
            WHERE LOWER(Email) = LOWER(@email)
        `);

            const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

            // Pre-registered user completing their registration
            if (existing.recordset.length > 0) {
                const row = existing.recordset[0];

                if (row.Username !== null && row.PreRegistered === false) {
                    return { success: false, message: 'User already has a username set' };
                }

                const updateRequest = this.pool.request();
                updateRequest.input('username', sql.NVarChar, username);
                updateRequest.input('passwordHash', sql.NVarChar, passwordHash);
                updateRequest.input('email', sql.NVarChar, email);

                await updateRequest.query(`
                UPDATE Users
                SET Username      = @username,
                    PasswordHash  = @passwordHash,
                    PreRegistered = 0
                WHERE LOWER(Email) = LOWER(@email)
            `);

                const permissions = row.Permissions ? row.Permissions.split('|').filter(Boolean) : [];
                return {
                    success: true,
                    wasPreregistered: true,
                    user: { username, email, permissions }
                };
            }

            // Brand new user — check if they are the first
            const countRequest = this.pool.request();
            const countResult = await countRequest.query(`SELECT COUNT(*) AS cnt FROM Users WHERE Email IS NOT NULL`);
            const isFirstUser = countResult.recordset[0].cnt === 0;

            const permissions = isFirstUser ? ['view', 'add', 'admin', 'dev'] : ['view'];
            if (isFirstUser) console.log('First user created - granted all permissions including admin');

            const insertRequest = this.pool.request();
            insertRequest.input('username', sql.NVarChar, username);
            insertRequest.input('email', sql.NVarChar, email);
            insertRequest.input('passwordHash', sql.NVarChar, passwordHash);
            insertRequest.input('permissions', sql.NVarChar, permissions.join('|'));

            await insertRequest.query(`
            IF EXISTS (SELECT 1 FROM Users WHERE Username = @username)
                UPDATE Users
                SET Email        = @email,
                    PasswordHash = @passwordHash,
                    Permissions  = @permissions,
                    Blocked      = 0,
                    PreRegistered = 0
                WHERE Username = @username
            ELSE
                INSERT INTO Users (Username, Email, PasswordHash, Permissions, Blocked, PreRegistered)
                VALUES (@username, @email, @passwordHash, @permissions, 0, 0)
        `);

            return {
                success: true,
                isFirstUser,
                user: { username, email, permissions }
            };
        } catch (error) {
            console.error('Error setting up user:', error);
            return { success: false, message: `Failed to setup user: ${error.message}` };
        }
    }

    /**
     * Validates a user's password against the stored hash.
     * @param {{ email: string, password: string }} params
     * @returns {Promise<BaseResult & { user?: UserSession, blocked?: boolean, needsPasswordSetup?: boolean }>}
     */
    async validatePassword(params) {
        const { email, password } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('email', sql.NVarChar, email);

            const result = await request.query(`
            SELECT Username, Email, PasswordHash, Permissions, Blocked
            FROM Users
            WHERE LOWER(Email) = LOWER(@email)
        `);

            if (result.recordset.length === 0) {
                return { success: false, message: 'User not found' };
            }

            const row = result.recordset[0];

            if (row.Blocked) {
                return { success: false, blocked: true, message: 'User account is blocked' };
            }

            if (!row.PasswordHash || row.PasswordHash === '') {
                return { success: false, needsPasswordSetup: true, message: 'Password needs to be set' };
            }

            const isValid = await bcrypt.compare(password, row.PasswordHash);
            if (!isValid) {
                return { success: false, message: 'Invalid password' };
            }

            const permissions = row.Permissions ? row.Permissions.split('|').filter(Boolean) : [];
            return {
                success: true,
                user: { username: row.Username, email: row.Email, permissions }
            };
        } catch (error) {
            console.error('Error validating password:', error);
            return { success: false, message: `Failed to validate password: ${error.message}` };
        }
    }

    /**
     * Sets a new password for a user (first-time setup or after reset).
     * @param {{ email: string, password: string }} params
     * @returns {Promise<BaseResult & { user?: UserSession }>}
     */
    async setUserPassword(params) {
        const { email, password } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('email', sql.NVarChar, email);

            const result = await request.query(`
            SELECT Username, Email, Permissions, Blocked
            FROM Users
            WHERE LOWER(Email) = LOWER(@email)
        `);

            if (result.recordset.length === 0) {
                return { success: false, message: 'User not found' };
            }

            const row = result.recordset[0];

            if (row.Blocked) {
                return { success: false, message: 'Cannot set password for blocked user' };
            }

            const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

            const updateRequest = this.pool.request();
            updateRequest.input('passwordHash', sql.NVarChar, passwordHash);
            updateRequest.input('email', sql.NVarChar, email);

            await updateRequest.query(`
            UPDATE Users SET PasswordHash = @passwordHash WHERE LOWER(Email) = LOWER(@email)
        `);

            const permissions = row.Permissions ? row.Permissions.split('|').filter(Boolean) : [];
            return {
                success: true,
                user: { username: row.Username, email: row.Email, permissions }
            };
        } catch (error) {
            console.error('Error setting password:', error);
            return { success: false, message: `Failed to set password: ${error.message}` };
        }
    }


    /**
     * Clears a user's password hash, forcing them to set a new one on next login.
     * Caller must have already been verified as admin at the route level.
     * @param {{ email: string }} params
     * @returns {Promise<BaseResult>}
     */
    async resetUserPassword(params) {
        const { email } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('email', sql.NVarChar, email);
            const userResult = await request.query(`SELECT Email FROM Users WHERE LOWER(Email) = LOWER(@email)`);

            if (userResult.recordset.length === 0) {
                return { success: false, message: 'User not found' };
            }

            const updateRequest = this.pool.request();
            updateRequest.input('email', sql.NVarChar, email);
            await updateRequest.query(`UPDATE Users SET PasswordHash = '' WHERE LOWER(Email) = LOWER(@email)`);

            return { success: true, message: `Password reset for ${email}. User will be prompted to set a new password on next login.` };
        } catch (error) {
            console.error('Error resetting password:', error);
            return { success: false, message: `Failed to reset password: ${error.message}` };
        }
    }

    /**
     * Updates the permission set for a given user.
     * Caller must have already been verified as admin at the route level.
     * Prevents removal of the last active admin.
     * @param {{ email: string, permissions: string[] }} params
     * @returns {Promise<BaseResult & { user?: UserSession }>}
     */
    async updateUserPermissions(params) {
        const { email, permissions } = params;
        await this.ensureConnection();

        try {
            const targetRequest = this.pool.request();
            targetRequest.input('email', sql.NVarChar, email);
            const targetResult = await targetRequest.query(`
            SELECT Username, Email, Permissions FROM Users WHERE LOWER(Email) = LOWER(@email)
        `);

            if (targetResult.recordset.length === 0) {
                return { success: false, message: 'User not found' };
            }

            const row = targetResult.recordset[0];
            const wasAdmin = row.Permissions?.includes('admin');
            const willBeAdmin = permissions.includes('admin');

            if (wasAdmin && !willBeAdmin) {
                const activeAdminsRequest = this.pool.request();
                activeAdminsRequest.input('email', sql.NVarChar, email);
                const activeAdmins = await activeAdminsRequest.query(`
                SELECT COUNT(*) AS cnt
                FROM Users
                WHERE Blocked = 0
                  AND Permissions LIKE '%admin%'
                  AND LOWER(Email) != LOWER(@email)
            `);

                if (activeAdmins.recordset[0].cnt === 0) {
                    return { success: false, message: 'Cannot remove admin permission - at least one admin must remain' };
                }
            }

            const updateRequest = this.pool.request();
            updateRequest.input('permissions', sql.NVarChar, permissions.join('|'));
            updateRequest.input('email', sql.NVarChar, email);
            await updateRequest.query(`UPDATE Users SET Permissions = @permissions WHERE LOWER(Email) = LOWER(@email)`);

            return {
                success: true,
                user: { username: row.Username, email: row.Email, permissions }
            };
        } catch (error) {
            console.error('Error updating permissions:', error);
            return { success: false, message: `Failed to update permissions: ${error.message}` };
        }
    }

    /**
     * Blocks a user account, preventing them from logging in.
     * Caller must have already been verified as admin at the route level.
     * Prevents blocking if it would leave zero active admins.
     * @param {{ email: string }} params
     * @returns {Promise<BaseResult>}
     */
    async blockUser(params) {
        const { email } = params;
        await this.ensureConnection();

        try {
            const targetRequest = this.pool.request();
            targetRequest.input('email', sql.NVarChar, email);
            const targetResult = await targetRequest.query(`
            SELECT Permissions FROM Users WHERE LOWER(Email) = LOWER(@email)
        `);

            if (targetResult.recordset.length === 0) {
                return { success: false, message: 'User not found' };
            }

            const row = targetResult.recordset[0];

            if (row.Permissions?.includes('admin')) {
                const activeAdminsRequest = this.pool.request();
                activeAdminsRequest.input('email', sql.NVarChar, email);
                const activeAdmins = await activeAdminsRequest.query(`
                SELECT COUNT(*) AS cnt
                FROM Users
                WHERE Blocked = 0
                  AND Permissions LIKE '%admin%'
                  AND LOWER(Email) != LOWER(@email)
            `);

                if (activeAdmins.recordset[0].cnt === 0) {
                    return { success: false, message: 'Cannot block user - at least one active admin must remain' };
                }
            }

            const updateRequest = this.pool.request();
            updateRequest.input('email', sql.NVarChar, email);
            await updateRequest.query(`UPDATE Users SET Blocked = 1 WHERE LOWER(Email) = LOWER(@email)`);

            return { success: true, message: `User ${email} has been blocked` };
        } catch (error) {
            console.error('Error blocking user:', error);
            return { success: false, message: `Failed to block user: ${error.message}` };
        }
    }

    /**
     * Unblocks a previously blocked user account.
     * Caller must have already been verified as admin at the route level.
     * @param {{ email: string }} params
     * @returns {Promise<BaseResult>}
     */
    async unblockUser(params) {
        const { email } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('email', sql.NVarChar, email);
            const result = await request.query(`SELECT Email FROM Users WHERE LOWER(Email) = LOWER(@email)`);

            if (result.recordset.length === 0) {
                return { success: false, message: 'User not found' };
            }

            const updateRequest = this.pool.request();
            updateRequest.input('email', sql.NVarChar, email);
            await updateRequest.query(`UPDATE Users SET Blocked = 0 WHERE LOWER(Email) = LOWER(@email)`);

            return { success: true, message: `User ${email} has been unblocked` };
        } catch (error) {
            console.error('Error unblocking user:', error);
            return { success: false, message: `Failed to unblock user: ${error.message}` };
        }
    }

    /**
     * Pre-registers a user by email and permissions. Username is left null until
     * the user completes registration on first login.
     * Caller must have already been verified as admin at the route level.
     * @param {{ email: string, permissions: string[] }} params
     * @returns {Promise<BaseResult & { user?: Pick<UserPublic, 'email' | 'permissions' | 'preRegistered'> }>}
     */
    async preRegisterUser(params) {
        const { email, permissions } = params;
        await this.ensureConnection();

        try {
            const existingRequest = this.pool.request();
            existingRequest.input('email', sql.NVarChar, email);
            const existing = await existingRequest.query(`SELECT Email FROM Users WHERE LOWER(Email) = LOWER(@email)`);

            console.log('preRegisterUser check - email:', email, 'rows found:', existing.recordset);

            if (existing.recordset.length > 0) {
                return { success: false, message: 'User already exists' };
            }

            const insertRequest = this.pool.request();
            insertRequest.input('email', sql.NVarChar, email);
            insertRequest.input('permissions', sql.NVarChar, permissions.join('|'));

            await insertRequest.query(`
            INSERT INTO Users (Username, Email, PasswordHash, Permissions, Blocked, PreRegistered)
            VALUES (NULL, @email, '', @permissions, 0, 1)
        `);

            return {
                success: true,
                user: { email, permissions, preRegistered: true }
            };
        } catch (error) {
            console.error('Error pre-registering user:', error);
            return { success: false, message: `Failed to pre-register user: ${error.message}` };
        }
    }

    /**
     * Deletes a user record entirely from the database.
     * Caller must have already been verified as admin at the route level.
     * Prevents deletion if it would leave zero active admins.
     * @param {{ email: string }} params
     * @returns {Promise<BaseResult>}
     */
    async deleteUser(params) {
        const { email } = params;
        await this.ensureConnection();

        try {
            const targetRequest = this.pool.request();
            targetRequest.input('email', sql.NVarChar, email);
            const targetResult = await targetRequest.query(`
            SELECT Permissions FROM Users WHERE LOWER(Email) = LOWER(@email)
        `);

            if (targetResult.recordset.length === 0) {
                return { success: false, message: 'User not found' };
            }

            const row = targetResult.recordset[0];

            if (row.Permissions?.includes('admin')) {
                const activeAdminsRequest = this.pool.request();
                activeAdminsRequest.input('email', sql.NVarChar, email);
                const activeAdmins = await activeAdminsRequest.query(`
                SELECT COUNT(*) AS cnt
                FROM Users
                WHERE Blocked = 0
                  AND Permissions LIKE '%admin%'
                  AND LOWER(Email) != LOWER(@email)
            `);

                if (activeAdmins.recordset[0].cnt === 0) {
                    return { success: false, message: 'Cannot delete user - at least one active admin must remain' };
                }
            }

            const deleteRequest = this.pool.request();
            deleteRequest.input('email', sql.NVarChar, email);
            await deleteRequest.query(`DELETE FROM Users WHERE LOWER(Email) = LOWER(@email)`);

            return { success: true, message: `User ${email} has been deleted` };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { success: false, message: `Failed to delete user: ${error.message}` };
        }
    }



    /**
     * Imports an array of users from the CSV export into the database.
     * If a row already exists with a matching Username (e.g. preferences were stored
     * prior to migration), that row is updated in place rather than creating a duplicate.
     * Rows with a null username are always inserted fresh.
     * @param {{ users: ImportUserRow[] }} params
     * @returns {Promise<BaseResult & { imported: number, updated: number, failed: number }>}
     */
    async importUsers(params) {
        const { users } = params;
        await this.ensureConnection();

        let imported = 0;
        let updated = 0;
        let failed = 0;

        for (const user of users) {
            try {
                if (user.username !== null) {
                    // Check existence first so we can track insert vs update
                    const existsRequest = this.pool.request();
                    existsRequest.input('username', sql.NVarChar, user.username);
                    const existsResult = await existsRequest.query(
                        `SELECT 1 AS found FROM Users WHERE Username = @username`
                    );
                    const alreadyExists = existsResult.recordset.length > 0;

                    const request = this.pool.request();
                    request.input('username', sql.NVarChar, user.username);
                    request.input('email', sql.NVarChar, user.Email);
                    request.input('passwordHash', sql.NVarChar, user.PasswordHash);
                    request.input('permissions', sql.NVarChar, user.Permissions);
                    request.input('blocked', sql.Bit, user.Blocked ? 1 : 0);

                    await request.query(`
                        IF EXISTS (SELECT 1 FROM Users WHERE Username = @username)
                            UPDATE Users
                            SET Email         = @email,
                                PasswordHash  = @passwordHash,
                                Permissions   = @permissions,
                                Blocked       = @blocked,
                                PreRegistered = 0
                            WHERE Username = @username
                        ELSE
                            INSERT INTO Users (Username, Email, PasswordHash, Permissions, Blocked, PreRegistered)
                            VALUES (@username, @email, @passwordHash, @permissions, @blocked, 0)
                    `);

                    alreadyExists ? updated++ : imported++;
                } else {
                    // Pre-registered user — upsert on email to prevent duplicates on re-import
                    const request = this.pool.request();
                    request.input('email', sql.NVarChar, user.Email);
                    request.input('passwordHash', sql.NVarChar, user.PasswordHash);
                    request.input('permissions', sql.NVarChar, user.Permissions);
                    request.input('blocked', sql.Bit, user.Blocked ? 1 : 0);

                    await request.query(`
                        IF EXISTS (SELECT 1 FROM Users WHERE LOWER(Email) = LOWER(@email))
                            UPDATE Users
                            SET PasswordHash  = @passwordHash,
                                Permissions   = @permissions,
                                Blocked       = @blocked,
                                PreRegistered = 1
                            WHERE LOWER(Email) = LOWER(@email)
                        ELSE
                            INSERT INTO Users (Username, Email, PasswordHash, Permissions, Blocked, PreRegistered)
                            VALUES (NULL, @email, @passwordHash, @permissions, @blocked, 1)
                    `);

                    imported++;
                }
            } catch (error) {
                console.error(`Error importing user ${user.Email}:`, error);
                failed++;
            }
        }

        return {
            success: failed < users.length,
            message: `Import complete: ${imported} inserted, ${updated} updated, ${failed} failed`,
            imported,
            updated,
            failed
        };
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




























































































































































































    // SHEET TEMPLATES /////////////////////////////////////////////////////////////////

    /** 
     * On sheet creation, the user will first specify the animal type.
     * This determines what records can be assigned
     * 
     * EX: 
     * Chooses Cattle; the primary table is CowTable with the key CowTag
     * 
     * Now the user can select what columns they want. These columns are LINKED to the initial key CowTag
     * 
     * If it is not editable, and not a recordID the data is stored once on load, and never re-read
     * 
     * First, the user selects a few non-editable, non recordID columns they want to display on their fieldsheet...
     * +Dam Tag (Source CowTag) not editable, no recordID
     * +Sire Tag (Source CowTag) not editable, not recordID
     * +Last Weight (Source CowTag) not editable, not recordID
     * +Age (Source CowTag) not editable, not recordID
     * 
     * Then, the user selects some recordID related columns
     * Preg Check 1
     * + Test Result (Source CowTag, PregID1) editable, recordID
     * Preg Check 2
     * + Test Result (Source CowTag, PregID2) editable, recordID
     * 
     * Weight Record 1
     * + Weight (Source CowTag, WeightID1) editable, recordID
     * + Date of Weight (Source CowTag, WeightID1) not editable, recordID <<=== This is related to a recordID, so it WILL requery / update
     * 
     * Medical Record 1 [User chooses the related medicine for this record, say X Wart Boost]
     * + Applied/ Not applied (Source Cowtag, MedRecID1) editable, recordID
     * 
     * The user selects another non-editible, no recordID
     * + Tempermant (Source CowTag) not editable, no recordID
     * 
     * Finally, the user selects an editable, no recordID column
     * + notes (Source CowTag, but only stored in the instance JSON), editable, no recordID
     */


    /**
     * Creates a sheet template with the given columns
     * @param {{ name: string, columns: Object, createdBy: string, locked?: boolean, parentSheetId?: number|null }} params
     * @returns {Promise<{ success: boolean, rowsAffected: number }>}
     */
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
            request.input('dateCreated', sql.DateTime, new Date());

            const query = `
                INSERT INTO SheetTemplates (SheetName, Columns, CreatedBy, Locked, ParentSheet, DateCreated)
                VALUES (@sheetName, @columns, @createdBy, @locked, @parentSheet, @dateCreated)`;

            const result = await request.query(query);
            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error creating sheet:', error);
            throw error;
        }
    }


    /**
     * Gets the sheet template with the given sheetID
     * @param {{ sheetId: number }} params
     * @returns {Promise<{ id: number, name: string, columns: string, createdBy: string, locked: boolean, parentSheet: number|null, dateCreated: Date }>}
     */
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

            const query = `
                SELECT ID, SheetName, Columns, CreatedBy, Locked, ParentSheet, DateCreated
                FROM SheetTemplates
                WHERE ID = @sheetId`;

            const result = await request.query(query);

            if (result.recordset.length === 0) {
                throw new Error(`Sheet with ID '${sheetId}' not found`);
            }

            const row = result.recordset[0];
            return {
                id: row.ID,
                name: row.SheetName,
                columns: row.Columns,
                createdBy: row.CreatedBy,
                locked: row.Locked,
                parentSheet: row.ParentSheet,
                dateCreated: row.DateCreated
            };
        } catch (error) {
            console.error('Error fetching sheet definition:', error);
            throw error;
        }
    }


    /**
     * Gets all sheet templates
     * @returns {Promise<{ sheets: Array<{ id: number, name: string, columns: string, createdBy: string, locked: boolean, parentSheet: number|null, dateCreated: Date }> }>}
     */
    async getAllSheetTemplates() {
        await this.ensureConnection();

        try {
            const query = `
                SELECT ID, SheetName, Columns, CreatedBy, Locked, ParentSheet, DateCreated
                FROM SheetTemplates
                ORDER BY Locked DESC, SheetName`;

            const result = await this.pool.request().query(query);
            return { sheets: result.recordset };
        } catch (error) {
            console.error('Error fetching sheets from DB:', error);
            throw error;
        }
    }


    /**
     * Updates the name and columns of the given sheet template
     * @param {{ sheetId: number, name: string, columns: Object }} params
     * @returns {Promise<{ success: boolean, rowsAffected: number }>}
     */
    async updateSheetTemplate(params) {
        const { sheetId, name, columns } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('sheetId', sql.Int, sheetId);
            request.input('sheetName', sql.NVarChar, name);
            request.input('columns', sql.NVarChar(sql.MAX), JSON.stringify(columns));

            const query = `
                UPDATE SheetTemplates
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
     * Deletes the given sheet template if it is not locked
     * @param {number} sheetId
     * @returns {Promise<{ success: boolean, rowsAffected: number }>}
     */
    async deleteSheetTemplate(sheetId) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('sheetId', sql.Int, sheetId);

            const query = `DELETE FROM SheetTemplates WHERE ID = @sheetId AND Locked = 0`;

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

































    //  STOPPED EDITING / FIXING HERDNAME CHANGES HERE, TODO FIX HERDNAME DIFFERENCE  ----------------------------
    // TODO---- REDESIGN FIELDSHEETS & FIX THE REST OF THE BUGS...



    // SHEET INSTANCE MANAGEMENT   /////////////////////////////////////////////////////////////////////////////////////////




    /**
     * Gets a single sheet instance by ID
     * @param {{ instanceId: number }} params
     * @returns {Promise<{ id: number, templateId: number, templateName: string, dateCreated: Date, breedingYear: number|null, createdBy: string, lastUpdated: Date, lastEditedBy: string, columnData: Object, rowData: Object[], animalTags: string[] }>}
     */
    async getSheetInstance(params) {
        const { instanceId } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('instanceId', sql.Int, instanceId);

            const query = `
                SELECT
                    si.ID               as id,
                    si.TemplateID       as templateId,
                    st.SheetName        as templateName,
                    si.DateCreated       as dateCreated,
                    si.PrimaryRecordDate as primaryRecordDate,
                    si.CreatedBy         as createdBy,
                    si.LastUpdated      as lastUpdated,
                    si.LastEditedBy     as lastEditedBy,
                    si.ColumnData       as columnData,
                    si.RowData          as rowData,
                    si.AnimalTags       as animalTags,
                    si.InstanceName     as instanceName
                FROM SheetInstances si
                INNER JOIN SheetTemplates st ON si.TemplateID = st.ID
                WHERE si.ID = @instanceId`;

            const result = await request.query(query);

            if (result.recordset.length === 0) {
                throw new Error(`Sheet instance ${instanceId} not found`);
            }

            const row = result.recordset[0];
            return {
                id: row.id,
                templateId: row.templateId,
                templateName: row.templateName,
                instanceName: row.instanceName,
                dateCreated: row.dateCreated,
                primaryRecordDate: row.primaryRecordDate,
                createdBy: row.createdBy,
                lastUpdated: row.lastUpdated,
                lastEditedBy: row.lastEditedBy,
                columnData: JSON.parse(row.columnData),
                rowData: JSON.parse(row.rowData),
                animalTags: JSON.parse(row.animalTags)
            };
        } catch (error) {
            console.error('Error fetching sheet instance:', error);
            throw error;
        }
    }



    /**
     * Gets all sheet instances, optionally filtered by template, without rowData
     * @param {{ templateId?: number }} params
     * @returns {Promise<{ instances: Array<{ id: number, templateId: number, templateName: string, dateCreated: Date, breedingYear: number|null, createdBy: string, lastUpdated: Date, lastEditedBy: string, columnData: Object }> }>}
     */
    async getAllSheetInstances(params = {}) {
        const { templateId } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();

            let query = `
                SELECT
                    si.ID               as id,
                    si.TemplateID       as templateId,
                    st.SheetName        as templateName,
                    si.DateCreated      as dateCreated,
                    si.PrimaryRecordDate  as primaryRecordDate,
                    si.CreatedBy        as createdBy,
                    si.LastUpdated      as lastUpdated,
                    si.LastEditedBy     as lastEditedBy,
                    si.ColumnData       as columnData,
                    si.InstanceName     as instanceName
                FROM SheetInstances si
                LEFT JOIN SheetTemplates st ON si.TemplateID = st.ID`;

            if (templateId) {
                request.input('templateId', sql.Int, templateId);
                query += ` WHERE si.TemplateID = @templateId`;
            }

            query += ` ORDER BY si.DateCreated DESC`;

            const result = await request.query(query);
            return {
                instances: result.recordset.map(row => ({
                    ...row,
                    columnData: JSON.parse(row.columnData)
                }))
            };
        } catch (error) {
            console.error('Error fetching sheet instances:', error);
            throw error;
        }
    }



    /**
     * Fully overwrites a sheet instance's column and row data
     * @param {{ instanceId: number, columnData: Object, rowData: Object[], animalTags: string[], lastEditedBy: string }} params
     * @returns {Promise<{ success: boolean, rowsAffected: number }>}
     */
    async updateSheetInstance(params) {
        const { instanceId, columnData, rowData, animalTags, lastEditedBy } = params;

        if (columnData != null) {
            throw new Error('columnData is immutable after creation and cannot be overwritten via updateSheetInstance');
        }

        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('instanceId', sql.Int, instanceId);
            request.input('rowData', sql.NVarChar(sql.MAX), JSON.stringify(rowData));
            request.input('animalTags', sql.NVarChar(sql.MAX), JSON.stringify(animalTags));
            request.input('lastEditedBy', sql.NVarChar, lastEditedBy);
            request.input('lastUpdated', sql.DateTime, new Date());

            const query = `
                UPDATE SheetInstances
                SET
                    RowData      = @rowData,
                    AnimalTags   = @animalTags,
                    LastEditedBy = @lastEditedBy,
                    LastUpdated  = @lastUpdated
                WHERE ID = @instanceId`;

            const result = await request.query(query);

            if (result.rowsAffected[0] === 0) {
                throw new Error(`Sheet instance ${instanceId} not found`);
            }

            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error updating sheet instance:', error);
            throw error;
        }
    }


    /**
     * Deletes a sheet instance
     * @param {{ instanceId: number }} params
     * @returns {Promise<{ success: boolean, rowsAffected: number }>}
     */
    async deleteSheetInstance(params) {
        const { instanceId } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('instanceId', sql.Int, instanceId);

            const query = `DELETE FROM SheetInstances WHERE ID = @instanceId`;

            const result = await request.query(query);

            if (result.rowsAffected[0] === 0) {
                throw new Error(`Sheet instance ${instanceId} not found`);
            }

            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error deleting sheet instance:', error);
            throw error;
        }
    }



















































    // SHEET COLUMNS //////////////////////////////////////////////////////////////////////////////////

    /*
    * COLUMN_CATALOGUE - single source of truth for every known column.
    * storageHint: 'snapshot' | 'record' | 'inline'
    *
    * SOURCE_HANDLERS - maps source names to DB method names used by resolveSheetColumn.
    */
    COLUMN_CATALOGUE = [

        {
            key: 'CowTag',
            name: 'Cow Tag',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'Dam',
            name: 'Dam',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'Sire',
            name: 'Sire',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'Age',
            name: 'Age',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'StatusNotes',
            name: 'Status Notes',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'Description',
            name: 'Description',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'RegCertNumber',
            name: 'Reg Cert Number',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'CauseOfDeath',
            name: 'Cause of Death',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'ReasonAnimalSold',
            name: 'Reason Animal Sold',
            source: 'CowTable',
            type: 'text',
            storageHint: 'snapshot',
        },
        {
            key: 'Sex',
            name: 'Sex',
            source: 'CowTable',
            type: 'select',
            storageHint: 'snapshot',
        },
        {
            key: 'CurrentHerd',
            name: 'Current Herd',
            source: 'CowTable',
            type: 'select',
            storageHint: 'snapshot',
        },
        {
            key: 'Breed',
            name: 'Breed',
            source: 'CowTable',
            type: 'select',
            storageHint: 'snapshot',
        },
        {
            key: 'Status',
            name: 'Status',
            source: 'CowTable',
            type: 'select',
            storageHint: 'snapshot',
        },
        {
            key: 'Temperament',
            name: 'Temperament',
            source: 'CowTable',
            type: 'select',
            storageHint: 'snapshot',
        },
        {
            key: 'RegCert',
            name: 'Reg Cert',
            source: 'CowTable',
            type: 'select',
            storageHint: 'snapshot',
        },
        {
            key: 'AnimalClass',
            name: 'Animal Class',
            source: 'CowTable',
            type: 'select',
            storageHint: 'snapshot',
        },
        {
            key: 'DateOfBirth',
            name: 'Date of Birth',
            source: 'CowTable',
            type: 'date',
            storageHint: 'snapshot',
        },
        {
            key: 'DateOfDeath',
            name: 'Date of Death',
            source: 'CowTable',
            type: 'date',
            storageHint: 'snapshot',
        },
        {
            key: 'LastWeight',
            name: 'Last Weight',
            source: 'CowTable',
            type: 'number',
            storageHint: 'snapshot',
        },
        {
            key: 'LastWeightDate',
            name: 'Last Weight Date',
            source: 'CowTable',
            type: 'date',
            storageHint: 'snapshot',
        },
        {
            key: 'Birthweight',
            name: 'Birthweight',
            source: 'CowTable',
            type: 'number',
            storageHint: 'snapshot',
        },
        {
            key: 'WeaningWeight',
            name: 'Weaning Weight',
            source: 'CowTable',
            type: 'number',
            storageHint: 'snapshot',
        },
        {
            key: 'WeaningDate',
            name: 'Weaning Date',
            source: 'CowTable',
            type: 'date',
            storageHint: 'snapshot',
        },
        {
            key: 'TargetPrice',
            name: 'Target Price',
            source: 'CowTable',
            type: 'number',
            storageHint: 'snapshot',
        },
        {
            key: 'SalePrice',
            name: 'Sale Price',
            source: 'CowTable',
            type: 'number',
            storageHint: 'snapshot',
        },
        {
            key: 'WeightAtSale',
            name: 'Weight at Sale',
            source: 'CowTable',
            type: 'number',
            storageHint: 'snapshot',
        },
        {
            key: 'PurchasePrice',
            name: 'Purchase Price',
            source: 'CowTable',
            type: 'number',
            storageHint: 'snapshot',
        },
        {
            key: 'SaleRecordID',
            name: 'Sale Record ID',
            source: 'CowTable',
            type: 'reference',
            storageHint: 'snapshot',
        },
        {
            key: 'PurchaseRecordID',
            name: 'Purchase Record ID',
            source: 'CowTable',
            type: 'reference',
            storageHint: 'snapshot',
        },
        {
            key: 'Castrated',
            name: 'Castrated',
            source: 'CowTable',
            type: 'boolean',
            storageHint: 'snapshot',
        },



        {
            key: 'AnimalTested',
            name: 'Test Performed?',
            source: 'PregancyCheck',
            type: 'boolean',
            storageHint: 'record',
        },
        {
            key: 'IsPregnant',
            name: 'Test Results',
            source: 'PregancyCheck',
            type: 'select',
            storageHint: 'record',
        },
        {
            key: 'PregCheckDate',
            name: 'Test Date',
            source: 'PregancyCheck',
            type: 'date',
            storageHint: 'record',
        },
        {
            key: 'FetusSex',
            name: 'Fetus Sex',
            source: 'PregancyCheck',
            type: 'select',
            storageHint: 'record',
        },
        {
            key: 'MonthsPregnant',
            name: 'Months Pregnant',
            source: 'PregancyCheck',
            type: 'number',
            storageHint: 'record',
        },
        {
            key: 'Notes',
            name: 'Test Notes',
            source: 'PregancyCheck',
            type: 'text',
            storageHint: 'record',
        },





        {
            key: 'Weight',
            name: 'New Weight',
            source: 'WeightRecords',
            type: 'number',
            storageHint: 'record',
        },
        {
            key: 'TimeRecorded',
            name: 'New Weight Date',
            source: 'WeightRecords',
            type: 'date',
            storageHint: 'record',
        },



        {
            key: 'MedicineApplied',
            name: 'Medicine Applied?',
            source: 'MedicalTable',
            type: 'boolean',
            storageHint: 'record',
        },
        {
            key: 'TreatmentMedicineID',
            name: 'Treatment Medicine',
            source: 'MedicalTable',
            type: 'select',
            storageHint: 'record',
            hidden: true,
        },
        {
            key: 'TreatmentDate',
            name: 'Treatment Date',
            source: 'MedicalTable',
            type: 'date',
            storageHint: 'record',
        },
        {
            key: 'Note',
            name: 'Treatment Notes',
            source: 'MedicalTable',
            type: 'text',
            storageHint: 'record',
        },



        {
            key: 'Notes',
            name: 'Notes',
            source: null,
            type: 'text',
            storageHint: 'inline',
        },
    ];


    SOURCE_HANDLERS = {

        CowTable: {
            get: 'getCowTableData',
            update: 'updateCowTableData',
            add: null, // CowTable rows are never added via a sheet
            delete: null,
        },

        PregancyCheck: {
            get: 'getPregancyCheck',
            update: 'updatePregancyCheck',
            add: 'createPregancyCheck',
            delete: 'deletePregancyCheck',
        },

        WeightRecords: {
            get: 'getWeightRecord',
            update: 'updateWeightRecord',
            add: 'createWeightRecord',
            delete: 'deleteWeightRecord',
        },

        MedicalTable: {
            get: 'getMedicalRecord',
            update: 'updateMedicalRecord',
            add: 'createMedicalRecord',
            delete: 'deleteMedicalRecord',
        },

    };

    // Maps each record source to the field that governs whether a backing record should exist.
    REQUIRED_FIELD_KEYS = {
        PregancyCheck: 'AnimalTested',
        MedicalTable: 'MedicineApplied',
        WeightRecords: 'Weight',
    };

    // Tells DB what cols to create, hide, and seed if not actually added by user.
    PRIMARY_DATE_KEYS = {
        MedicalTable: 'TreatmentDate',
        WeightRecords: 'TimeRecorded',
        PregancyCheck: 'PregCheckDate',
    };

    // Guard fields that have no real DB column & only control record creation/deletion.
    VIRTUAL_GUARD_FIELDS = new Set(['MedicineApplied', 'AnimalTested']);

    // Field values for selector boxes that are treated as equivalent to null
    NULL_ADJACENT_VALUES = {
        PregancyCheck: {
            IsPregnant: ['Unexposed', 'Untested']
        }
    };



    /**
     * Get the corresponding data to a column
     * @param {string} columnName
     * @returns {{ key: string, get: Function, update: Function, add: Function, type: string } | Error}
     */
    resolveSheetColumn(columnKey) {
        const def = this.COLUMN_CATALOGUE.find(c => c.key === columnKey);
        if (!def) return new Error(`Invalid Column Name: ${columnKey}`);

        const h = def.source ? this.SOURCE_HANDLERS[def.source] : {};

        return {
            key: def.key,
            type: def.type,
            get: h?.get ? this[h.get].bind(this) : null,
            update: h?.update ? this[h.update].bind(this) : null,
            add: h?.add ? this[h.add].bind(this) : null,
        };
    }

    getAvailableColumns() {
        return {
            columns: this.COLUMN_CATALOGUE.map(({ key, name, type, source, storageHint }) => ({
                key,
                name,
                type,
                source,
                storageHint,
            })),
            requiredFieldKeys: this.REQUIRED_FIELD_KEYS,
        };
    }


    /**
     * Maps a select column key to its dropdown options
     * @param {string} columnKey
     * @param {Object} dropdownData
     * @returns {string[]}
     */
    getSelectOptions(columnKey, dropdownData) {
        const map = {
            Sex: dropdownData.sexes,
            CurrentHerd: dropdownData.herds,
            Breed: dropdownData.breeds,
            Status: dropdownData.statuses,
            Temperament: dropdownData.temperaments,
            RegCert: dropdownData.regCerts,
            AnimalClass: dropdownData.animalClasses,
            TreatmentMedicineID: dropdownData.medicines,
            IsPregnant: dropdownData.pregTestResults,
            FetusSex: dropdownData.sexes,
        };
        return map[columnKey] ?? [];
    }


    /**
     * Resolves template column definitions to actual handler functions
     * @param {Object[]} templateColumns
     * @returns {Promise<Object[]>}
     */
    async resolveTemplateColumns(templateColumns) {
        const dropdownData = await this.getFormDropdownData();

        return templateColumns.map(templateCol => {

            //  Record slot column
            if (templateCol.storage === 'record') {
                const handler = this.SOURCE_HANDLERS[templateCol.source];
                if (handler instanceof Error) throw handler;

                const hiddenCatalogueCols = this.COLUMN_CATALOGUE.filter(
                    c => c.source === templateCol.source && c.hidden && !templateCol.fields.some(f => f.key === c.key)
                );

                return {
                    recordSlot: templateCol.recordSlot,
                    name: templateCol.name,
                    storage: 'record',
                    source: templateCol.source,
                    get: handler.get ? this[handler.get].bind(this) : null,
                    update: handler.update ? this[handler.update].bind(this) : null,
                    add: handler.add ? this[handler.add].bind(this) : null,
                    ...(templateCol.medicine && { medicine: templateCol.medicine }),
                    ...(templateCol.defaults && { defaults: templateCol.defaults }),
                    fields: [
                        ...templateCol.fields.map(field => {
                            const col = {
                                key: field.key,
                                name: field.name,
                                editable: field.editable ?? false,
                                type: field.type,
                                ...(field.hidden && { hidden: true }),
                            };
                            if (field.type === 'select') {
                                col.options = this.getSelectOptions(field.key, dropdownData);
                            }
                            return col;
                        }),
                        ...hiddenCatalogueCols.map(c => ({
                            key: c.key,
                            name: c.name,
                            editable: false,
                            type: c.type,
                            hidden: true,
                        })),
                    ]
                };
            }

            //  Snapshot or inline column 
            const resolved = this.resolveSheetColumn(templateCol.key);
            if (resolved instanceof Error) throw resolved;

            const col = {
                key: templateCol.key,
                name: templateCol.name,
                storage: templateCol.storage,
                editable: templateCol.editable ?? false,
                type: resolved.type,
                get: resolved.get,
                update: resolved.update,
                add: resolved.add,
            };

            if (templateCol.multi) col.multi = true;
            if (resolved.type === 'select') col.options = this.getSelectOptions(templateCol.key, dropdownData);

            return col;
        });
    }



    /**
     * Resolves record slot IDs in row data to full record objects
     * Snapshot and inline columns are already flat values — no fetching needed
     * @param {Object[]} resolvedColumns - output of resolveTemplateColumns
     * @param {Object[]} rows - raw row data from RowData JSON
     * @returns {Promise<Object[]>}
     */
    async resolveColumns(params) {
        const { resolvedColumns, rows } = params;

        // Collect all record slots and their sources
        const recordSlotCols = resolvedColumns.filter(c => c.storage === 'record');

        // Group unique IDs by source handler
        const idsByHandler = new Map();

        for (const col of recordSlotCols) {
            if (!idsByHandler.has(col.get)) {
                idsByHandler.set(col.get, new Set());
            }
            for (const row of rows) {
                const slotVal = row[col.recordSlot];
                const id = typeof slotVal === 'object' ? slotVal?.recordId : slotVal;
                if (id != null) idsByHandler.get(col.get).add(id);
            }
        }

        // Batch fetch all records per source in parallel
        const dataMapsByHandler = new Map();

        await Promise.all(
            [...idsByHandler.entries()].map(async ([handlerFn, idSet]) => {
                const ids = [...idSet];
                if (ids.length === 0) return;

                const results = await Promise.all(ids.map(id => handlerFn.call(this, { recordId: id })));
                dataMapsByHandler.set(
                    handlerFn,
                    Object.fromEntries(ids.map((id, i) => [id, results[i]]))
                );
            })
        );

        // Merge resolved record data back onto each row
        return rows.map(row => {
            const resolved = { ...row };

            for (const col of recordSlotCols) {
                const slotVal = row[col.recordSlot];
                const id = typeof slotVal === 'object' ? slotVal?.recordId : slotVal;
                const pending = (slotVal !== null && typeof slotVal === 'object') ? slotVal : {};
                const dataMap = dataMapsByHandler.get(col.get) ?? {};
                const record = id != null ? dataMap[id] : null;

                if (!record) {
                    // No backing record — preserve pending field values if any, otherwise null
                    resolved[col.recordSlot] = id == null && Object.keys(pending).length > 1
                        ? pending
                        : null;
                    continue;
                }

                // Expand record into { recordId, field1, field2, ... }
                // Virtual guard field have no DB column; if a backing record exists, they are implicitly true.
                resolved[col.recordSlot] = {
                    recordId: id,
                    ...Object.fromEntries(
                        col.fields.map(field => [
                            field.key,
                            this.VIRTUAL_GUARD_FIELDS.has(field.key)
                                ? true
                                : (record[field.key] ?? null)
                        ])
                    )
                };
            }

            return resolved;
        });
    }



    /**
     * Resolves a template's columns to their full display shape, with select options populated.
     * Strips bound handler functions so the result is safe to serialize
     * @param {{ templateId: number }} params
     * @returns {Promise<Array<{ key?: string, recordSlot?: string, name: string, storage: string, source: string, type?: string, fields?: Array<{ key: string, name: string, type: string, editable: boolean, options?: string[] }> }>>}
     */
    async getTemplatePreviewColumns(params) {
        const { templateId } = params;
        const template = await this.getSheetTemplate({ sheetId: templateId });
        const config = JSON.parse(template.columns);
        const resolved = await this.resolveTemplateColumns(config.columns);

        return resolved.map(({ get, update, add, ...rest }) => rest);
    }


    /**
     * Creates a new sheet instance & populates initial row data
     * @param {{ templateId: number, instanceName: string, herdName: string, breedingYear: number|null, createdBy: string }} params
     * @returns {Promise<{ success: boolean, instanceId: number }>}
     */
    async createSheetInstance(params) {
        const { templateId, instanceName, herdName, primaryRecordDate, createdBy, defaults = {} } = params;
        await this.ensureConnection();

        try {
            const sheetDef = await this.getSheetTemplate({ sheetId: templateId });
            const columnConfig = JSON.parse(sheetDef.columns);

            // Merge defaults into each record slot column
            columnConfig.columns = columnConfig.columns.map(col => {
                if (col.storage !== 'record') return col;

                const slotDefaults = defaults[col.recordSlot];
                if (slotDefaults) {
                    const { _medicine, ...fieldDefaults } = slotDefaults;
                    col = {
                        ...col,
                        ...(_medicine && { medicine: _medicine }),
                        defaults: {
                            ...fieldDefaults,
                            ...(_medicine && { TreatmentMedicineID: _medicine }),
                        },
                    };
                }

                // inject primary date field if not explicitly in the template
                const primaryDateKey = this.PRIMARY_DATE_KEYS[col.source];
                const dateAlreadyPresent = !primaryDateKey
                    || col.fields.some(f => f.key === primaryDateKey);

                if (!dateAlreadyPresent) {
                    const catalogueField = this.COLUMN_CATALOGUE.find(c => c.key === primaryDateKey);
                    col = {
                        ...col,
                        fields: [
                            ...col.fields,
                            {
                                key: primaryDateKey,
                                name: catalogueField?.name ?? primaryDateKey,
                                type: 'date',
                                editable: false,
                                hidden: true,
                            }
                        ]
                    };
                }

                return col;
            });



            const year = new Date(primaryRecordDate).getFullYear();
            const cowList = await this.getCowListForSheet(herdName, sheetDef.name, year);
            const cowDataMap = await this.getCowTableData(cowList);

            const rowData = cowList.map(cowTag => {
                const cow = cowDataMap[cowTag] ?? {};
                const row = { CowTag: cowTag };

                for (const col of columnConfig.columns) {
                    if (col.storage === 'snapshot') {
                        row[col.key] = cow[col.key] ?? null;
                    } else if (col.storage === 'record') {
                        row[col.recordSlot] = null;
                    } else if (col.storage === 'inline') {
                        row[col.key] = "";
                    }
                }

                return row;
            });

            const now = new Date();

            const request = this.pool.request();
            request.input('templateId', sql.Int, templateId);
            request.input('dateCreated', sql.DateTime, now);
            request.input('columnData', sql.NVarChar(sql.MAX), JSON.stringify(columnConfig));
            request.input('rowData', sql.NVarChar(sql.MAX), JSON.stringify(rowData));
            request.input('primaryRecordDate', sql.DateTime2, primaryRecordDate ? new Date(primaryRecordDate) : null);
            request.input('createdBy', sql.NVarChar, createdBy);
            request.input('lastUpdated', sql.DateTime, now);
            request.input('lastEditedBy', sql.NVarChar, createdBy);
            request.input('animalTags', sql.NVarChar(sql.MAX), JSON.stringify(cowList));
            request.input('instanceName', sql.NVarChar, instanceName);


            const query = `
                INSERT INTO SheetInstances 
                    (TemplateID, DateCreated, ColumnData, RowData, PrimaryRecordDate, CreatedBy, LastUpdated, LastEditedBy, AnimalTags, InstanceName)
                OUTPUT INSERTED.ID
                VALUES 
                    (@templateId, @dateCreated, @columnData, @rowData, @primaryRecordDate, @createdBy, @lastUpdated, @lastEditedBy, @animalTags, @instanceName)`;

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
     * Loads an existing sheet instance and resolves all record slot columns
     * @param {{ instanceId: number }} params
     * @returns {Promise<Object>}
     */
    async loadSheetInstance(params) {
        const { instanceId } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('instanceId', sql.Int, instanceId);

            const query = `
                SELECT
                    si.ID               as id,
                    si.TemplateID       as templateId,
                    st.SheetName        as templateName,
                    si.DateCreated      as dateCreated,
                    si.PrimaryRecordDate  as primaryRecordDate,
                    si.CreatedBy        as createdBy,
                    si.LastUpdated      as lastUpdated,
                    si.LastEditedBy     as lastEditedBy,
                    si.ColumnData       as columnData,
                    si.RowData          as rowData,
                    si.AnimalTags       as animalTags,
                    si.InstanceName     as instanceName
                FROM SheetInstances si
                LEFT JOIN SheetTemplates st ON si.TemplateID = st.ID
                WHERE si.ID = @instanceId`;

            const result = await request.query(query);

            if (result.recordset.length === 0) {
                throw new Error(`Sheet instance ${instanceId} not found`);
            }

            const instance = result.recordset[0];
            const columnData = JSON.parse(instance.columnData);
            const rowData = JSON.parse(instance.rowData);

            const resolvedColumns = await this.resolveTemplateColumns(columnData.columns);
            const resolvedRows = await this.resolveColumns({ resolvedColumns, rows: rowData });

            return {
                instanceId: instance.id,
                templateId: instance.templateId,
                templateName: instance.templateName,
                instanceName: instance.instanceName,
                dateCreated: instance.dateCreated,
                primaryRecordDate: instance.primaryRecordDate,
                createdBy: instance.createdBy,
                lastUpdated: instance.lastUpdated,
                lastEditedBy: instance.lastEditedBy,
                animalTags: JSON.parse(instance.animalTags),
                columns: resolvedColumns,
                data: resolvedRows
            };

        } catch (error) {
            console.error('Error loading sheet instance:', error);
            throw error;
        }
    }


    /**
     * Attempts to load an instance, creates a new one if not found
     */
    async tryLoadSheetInstance(params) {
        const { instanceId, templateId, herdName, primaryRecordDate, createdBy } = params;

        if (instanceId) {
            try {
                return await this.loadSheetInstance({ instanceId });
            } catch (error) {
                if (!error.message.includes('not found')) throw error;
            }
        }

        const createResult = await this.createSheetInstance({ templateId, herdName, primaryRecordDate, createdBy });
        return await this.loadSheetInstance({ instanceId: createResult.instanceId });
    }













    // INDIVIDUAL SHEET CELL UPDATING //

    /**
     * Updates a single field value within a record slot for one animal.
     * If the slot has no linked record yet and the value is not null-adjacent,
     * creates a new record and writes the new record ID back into RowData.
     * If null-adjacent or the required guard field is falsy, clears the slot.
     *
     * @param {{ instanceId: number, cowTag: string, recordSlot: string, source: string, fieldKey: string, fieldValue: *, medicine?: string, createdBy: string }} params
     * @returns {Promise<{ success: boolean, action: 'created'|'updated'|'cleared'|'skipped' }>}
     */
    async updateSheetCell({ instanceId, cowTag, recordSlot, source, fieldKey, fieldValue, medicine, createdBy }) {
        await this.ensureConnection();

        const fetchRequest = this.pool.request();
        fetchRequest.input('instanceId', sql.Int, instanceId);
        const fetchResult = await fetchRequest.query(`
            SELECT RowData, ColumnData, PrimaryRecordDate
            FROM SheetInstances
            WHERE ID = @instanceId`);

        if (fetchResult.recordset.length === 0) throw new Error(`Sheet instance ${instanceId} not found`);

        const { RowData: rawRowData, ColumnData: rawColumnData, PrimaryRecordDate: primaryRecordDate } = fetchResult.recordset[0];
        const rowData = JSON.parse(rawRowData);
        const columnData = JSON.parse(rawColumnData);

        const rowIndex = rowData.findIndex(r => r.CowTag === cowTag);
        if (rowIndex === -1) throw new Error(`CowTag ${cowTag} not found in instance ${instanceId}`);

        const row = rowData[rowIndex];
        const slotValue = row[recordSlot] ?? null;                      // null | { recordId: null, ...pending } | number (legacy)
        const existingId = slotValue && typeof slotValue === 'object' ? slotValue.recordId : slotValue;


        // Inline columns have no source, write directly to RowData and return
        if (!source) {
            rowData[rowIndex][fieldKey] = fieldValue;
            await this.updateSheetInstance({
                instanceId,
                rowData,
                animalTags:   rowData.map(r => r.CowTag),
                lastEditedBy: createdBy,
            });
            return { success: true, action: 'updated' };
        }

        const handlerConfig = this.SOURCE_HANDLERS[source];
        if (!handlerConfig) throw new Error(`Unknown source: ${source}`);

        const requiredKey = this.REQUIRED_FIELD_KEYS[source];
        const isGuardField = fieldKey === requiredKey;
        const nullAdjacent = this.NULL_ADJACENT_VALUES[source]?.[requiredKey]?.includes(fieldValue) ?? false;
        const shouldClear = isGuardField && (fieldValue === false || fieldValue == null || nullAdjacent);

        let action = 'skipped';

        if (existingId) {
            if (shouldClear) {
                // Fetch current field values before deleting so they remain visible
                const current = await this[handlerConfig.get]({ recordId: existingId });

                if (handlerConfig.delete) {
                    await this[handlerConfig.delete]({ recordId: existingId });
                }

                // Preserve field values as pending so clicking then unclicking is a no-op
                const colDef = columnData.columns.find(c => c.recordSlot === recordSlot);
                const preservedFields = {};
                for (const field of (colDef?.fields ?? [])) {
                    preservedFields[field.key] = current?.[field.key] ?? colDef?.defaults?.[field.key] ?? null;
                }

                // Guard field itself goes back to its cleared state
                preservedFields[fieldKey] = fieldValue;

                rowData[rowIndex][recordSlot] = { recordId: null, ...preservedFields };
                action = 'cleared';

            } else {
                // Record exists. Skip update if the field is virtual
                if (!this.VIRTUAL_GUARD_FIELDS.has(fieldKey)) {
                    await this[handlerConfig.update]({ recordId: existingId, fields: { [fieldKey]: fieldValue } });
                }
                action = 'updated';
            }
        } else if (isGuardField && !shouldClear) {
            // Guard field fired true — collect all pending + defaults and create the record

            // Column defaults from template
            const colDef = columnData.columns.find(c => c.recordSlot === recordSlot);
            const colDefaults = colDef?.defaults ?? {};

            // Pending field edits already stored in RowData (may be null or { recordId: null, ...fields })
            const pending = (slotValue && typeof slotValue === 'object') ? slotValue : {};

            // Merge defaults < pending < this edit < pinned medicine
            const allFields = {
                ...colDefaults,
                ...pending,
                [fieldKey]: fieldValue
            };
            delete allFields.recordId;

            // Seed any date fields not yet set with the instance's primary record date.
            // Only runs for record slots (snapshot/inline columns never reach this branch).
            for (const field of (colDef?.fields ?? [])) {
                if (field.type === 'date' && !(field.key in allFields)) {
                    allFields[field.key] = primaryRecordDate;
                }
            }

            const created = await this[handlerConfig.add]({
                cowTag,
                fields: allFields,
                primaryRecordDate,
            });

            rowData[rowIndex][recordSlot] = created.recordId;
            action = 'created';

        } else if (!isGuardField) {
            // No record yet, non-guard field — store as pending in RowData
            const existing = (slotValue && typeof slotValue === 'object') ? slotValue : { recordId: null };
            rowData[rowIndex][recordSlot] = { ...existing, [fieldKey]: fieldValue };
            action = 'pending';
        }

        if (action !== 'skipped') {
            await this.updateSheetInstance({
                instanceId,
                rowData,
                animalTags: rowData.map(r => r.CowTag),
                lastEditedBy: createdBy,
            });
        }

        return { success: true, action };
    }


    /**
     * Processes a full set of submitted row data from an imported/filled sheet.
     * For each row and each record slot, decides whether to create, update, or
     * clear the linked record, then persists all record IDs in a single write.
     *
     * @param {{ instanceId: number, rows: Array<{ cowTag: string, slots: { [recordSlot: string]: { [fieldKey: string]: * } } }>, createdBy: string }} params
     * @returns {Promise<{ success: boolean, created: number, updated: number, cleared: number }>>}
     */
    async bulkUpdateSheetRows({ instanceId, rows, createdBy }) {
        await this.ensureConnection();

        const fetchRequest = this.pool.request();
        fetchRequest.input('instanceId', sql.Int, instanceId);
        const fetchResult = await fetchRequest.query(`
            SELECT RowData, ColumnData, PrimaryRecordDate
            FROM SheetInstances
            WHERE ID = @instanceId`);

        if (fetchResult.recordset.length === 0) {
            throw new Error(`Sheet instance ${instanceId} not found`);
        }

        const {
            RowData: rawRowData,
            ColumnData: rawColumnData,
            PrimaryRecordDate: primaryRecordDate,
        } = fetchResult.recordset[0];

        const rowData = JSON.parse(rawRowData);
        const columnData = JSON.parse(rawColumnData);

        // Build per-slot lookup tables from the stored column config
        const sourceBySlot = {};
        const medicineBySlot = {};
        const colDefBySlot = {};
        for (const col of columnData.columns) {
            if (col.storage !== 'record') continue;
            sourceBySlot[col.recordSlot] = col.source;
            colDefBySlot[col.recordSlot] = col;
            if (col.medicine) medicineBySlot[col.recordSlot] = col.medicine;
        }

        // Collect operations — creates must be sequential (IDs written back),
        // updates can be parallelised
        const pendingUpdates = [];
        const pendingCreates = [];
        let cleared = 0;

        for (const { cowTag, slots, inlineFields = {} } of rows) {
            const rowIndex = rowData.findIndex(r => r.CowTag === cowTag);
            if (rowIndex === -1) continue;

            // Apply inline fields directly to rowData
            for (const [key, value] of Object.entries(inlineFields)) {
                rowData[rowIndex][key] = value;
            }

            const row = rowData[rowIndex];

            for (const [recordSlot, fields] of Object.entries(slots)) {
                const source = sourceBySlot[recordSlot];
                if (!source) continue;

                const handlerConfig = this.SOURCE_HANDLERS[source];
                if (!handlerConfig) continue;

                const slotVal = row[recordSlot] ?? null;
                const existingId = (slotVal !== null && typeof slotVal === 'object') ? slotVal.recordId : slotVal;
                const requiredKey = this.REQUIRED_FIELD_KEYS[source];

                // Evaluate guard field from the submitted fields object
                const requiredValue = requiredKey ? (fields[requiredKey] ?? null) : true;
                const nullAdjacent = requiredKey
                    ? (this.NULL_ADJACENT_VALUES[source]?.[requiredKey]?.includes(requiredValue) ?? false)
                    : false;
                const shouldClear = requiredKey != null &&
                    (requiredValue === false || requiredValue == null || nullAdjacent);

                if (shouldClear) {
                    if (existingId != null) {
                        if (handlerConfig.delete) {
                            await this[handlerConfig.delete]({ recordId: existingId });
                        }
                        rowData[rowIndex][recordSlot] = null;
                        cleared++;
                    }


                } else if (existingId != null) {
                    const updateFields = Object.fromEntries(
                        Object.entries(fields).filter(([k]) => !this.VIRTUAL_GUARD_FIELDS.has(k))
                    );

                    if (Object.keys(updateFields).length > 0) {
                        pendingUpdates.push({
                            source, recordSlot,
                            recordId: existingId,
                            cowTag,
                            fields: updateFields,
                        });
                    }

                } else {
                    const colDef = colDefBySlot[recordSlot];
                    const colDefaults = colDef?.defaults ?? {};
                    const colMedicine = medicineBySlot[recordSlot] ?? null;

                    const allFields = {
                        ...colDefaults,
                        ...fields,
                        ...(colMedicine && { TreatmentMedicineID: colMedicine }),
                    };

                    // Seed unset date fields with primaryRecordDate
                    for (const field of (colDef?.fields ?? [])) {
                        if (field.type === 'date' && !(field.key in allFields)) {
                            allFields[field.key] = primaryRecordDate;
                        }
                    }

                    pendingCreates.push({
                        source, rowIndex, recordSlot,
                        cowTag,
                        fields: allFields,
                    });
                }
            }
        }

        // Run all updates in parallel
        await Promise.all(
            pendingUpdates.map(({ source, recordId, cowTag, fields }) =>
                this[this.SOURCE_HANDLERS[source].update]({ recordId, cowTag, fields })
            )
        );

        // Run creates sequentially — each result writes an ID back into rowData
        for (const { source, rowIndex, recordSlot, cowTag, fields } of pendingCreates) {
            const handlerConfig = this.SOURCE_HANDLERS[source];
            if (!handlerConfig.add) continue;

            const created = await this[handlerConfig.add]({ cowTag, fields });
            rowData[rowIndex][recordSlot] = created.recordId;
        }

        // Single DB write for everything
        await this.updateSheetInstance({
            instanceId,
            rowData,
            animalTags: rowData.map(r => r.CowTag),
            lastEditedBy: createdBy,
        });

        return {
            success: true,
            created: pendingCreates.length,
            updated: pendingUpdates.length,
            cleared,
        };
    }













































































































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

    // async updateSheetCell(params) {
    //     const { handler, cowTag, value, breedingYear, breedingPlanId } = params;
    //     await this.ensureConnection();
    //     console.log('updateSheetCell called with:', params);

    //     try {
    //         // Get current breeding year if not provided
    //         let currentBreedingYear = breedingYear;
    //         if (!currentBreedingYear) {
    //             const breedingPlans = await this.getBreedingPlans();
    //             const activePlan = breedingPlans.plans.find(p => p.IsActive) || breedingPlans.plans[0];
    //             currentBreedingYear = activePlan ? activePlan.PlanYear : new Date().getFullYear();
    //             console.log('Using default breeding year:', currentBreedingYear);
    //         }

    //         switch (handler) {
    //             case 'updatePregancyResult':
    //                 //console.log('Calling updatePregancyResult');
    //                 return await this.updatePregancyResult(cowTag, value, currentBreedingYear);

    //             case 'updateFetusSex':
    //                 //console.log('Calling updateFetusSex');
    //                 return await this.updateFetusSex(cowTag, value);

    //             case 'updatePregCheckWeight':
    //                 //console.log('Calling updatePregCheckWeight');
    //                 return await this.updatePregCheckWeight(cowTag, value);

    //             case 'updatePregCheckNotes':
    //                 //console.log('Calling updatePregCheckNotes');
    //                 return await this.updatePregCheckNotes(cowTag, value);

    //             case 'updatePregCheckDate':
    //                 //console.log('Calling updatePregCheckDate');
    //                 return await this.updatePregCheckDate(cowTag, value, currentBreedingYear);

    //             case 'updateMonthsPregnant':
    //                 //console.log('Calling updateMonthsPregnant');
    //                 return await this.updateMonthsPregnant(cowTag, value);

    //             case 'updateBreedingStatus':
    //                 //console.log('Calling updateBreedingStatus');
    //                 return await this.updateBreedingStatus(cowTag, value, currentBreedingYear);

    //             case 'updateWeaningStatus':
    //                 //console.log('Calling updateWeaningStatus');
    //                 return await this.updateWeaningStatus(cowTag, value, currentBreedingYear);

    //             case 'recordNewWeight':
    //                 //console.log('Calling recordNewWeight');
    //                 return await this.recordNewWeight(cowTag, value);

    //             case 'addCalvingNote':
    //                 //console.log('Calling addCalvingNote');
    //                 return await this.addCalvingNote(cowTag, value, currentBreedingYear);

    //             default:
    //                 //console.error(`Unknown update handler: ${handler}`);
    //                 throw new Error(`Unknown update handler: ${handler}`);
    //         }
    //     } catch (error) {
    //         console.error(`Error in updateSheetCell for ${handler}:`, error);
    //         throw error;
    //     }
    // }

    // async batchUpdateSheetCells(params) {
    //     const { updates } = params; // Array of {cowTag, columnKey, value, handler}
    //     const results = [];

    //     for (const update of updates) {
    //         try {
    //             const result = await this.updateSheetCell({
    //                 handler: update.handler,
    //                 cowTag: update.cowTag,
    //                 value: update.value
    //             });
    //             results.push({ ...update, success: true, result });
    //         } catch (error) {
    //             results.push({ ...update, success: false, error: error.message });
    //         }
    //     }

    //     return { results, successCount: results.filter(r => r.success).length };
    // }

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
                'Dam': 'Dam',
                'Sire': 'Sire',
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
                return result.recordset[0] ? result.recordset[0]['Dam'] : '';
            } else if (fieldName === 'Sire') {
                return result.recordset[0] ? result.recordset[0]['Sire'] : '';
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
                        ${yearFilter} AND GETUTCDATE() BETWEEN ExposureStartDate AND ExposureEndDate
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









    async getCowTableValueWithSource(cowTag, fieldName) {
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);

            const columnMap = {
                'CowTag': 'CowTag',
                'Dam': 'Dam',
                'Sire': 'Sire',
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
                value = result.recordset[0] ? result.recordset[0]['Dam'] : '';
            } else if (fieldName === 'Sire') {
                value = result.recordset[0] ? result.recordset[0]['Sire'] : '';
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
                    ${yearFilter} AND GETUTCDATE() BETWEEN ExposureStartDate AND ExposureEndDate
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
            if (monthDiff < 0 || (monthDiff === 0 && today.gETUTCDATE() < birthDate.gETUTCDATE())) {
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

    async getUpdateHandler(columnName) {
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

    async getFieldOptions(columnName) {
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
    // async getAvailableColumns() {
    //     try {

    //         const isEditable = (dataPath) => {
    //             // All Fillable/ paths are editable
    //             if (dataPath.startsWith('Fillable/')) return true;

    //             // Editable fields from your existing sheets
    //             const editableFields = [
    //                 'PregancyCheck/IsPregnant',
    //                 'PregancyCheck/FetusSex', 
    //                 'PregancyCheck/WeightAtCheck',
    //                 'PregancyCheck/Notes',
    //                 'PregancyCheck/MonthsPregnant',
    //                 'CalvingRecords/CalfSex',
    //                 'CalvingRecords/CalvingNotes',
    //                 'WeightRecords/Latest'
    //             ];

    //             return editableFields.includes(dataPath);
    //         };

    //         const generateKey = (name, path) => {
    //             // Convert name to lowercase key with underscores
    //             return name.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
    //         };

    //         // Base column definitions
    //         const baseColumns = [
    //             // CowTable direct fields
    //             { name: 'CowTag', path: 'CowTable/CowTag' },
    //             { name: 'Dam Tag', path: 'CowTable/Dam' },
    //             { name: 'Sire Tag', path: 'CowTable/Sire' },
    //             { name: 'Sex', path: 'CowTable/Sex' },
    //             { name: 'Date of Birth', path: 'CowTable/DateOfBirth' },
    //             { name: 'Current Herd', path: 'CowTable/CurrentHerd' },
    //             { name: 'Description', path: 'CowTable/Description' },
    //             { name: 'Breed', path: 'CowTable/Breed' },
    //             { name: 'Temperament', path: 'CowTable/Temperament' },
    //             { name: 'Status', path: 'CowTable/Status' },
    //             { name: 'RegCert', path: 'CowTable/RegCert' },

    //             // Weight Records
    //             { name: 'Latest Weight', path: 'WeightRecords/Weight' },
    //             { name: 'Latest Weight Date', path: 'WeightRecords/TimeRecorded' },


    //             // Medical records
    //             { name: 'Medicine & Vax', path: 'MedicalTable/TreatmentMedicineID' },


    //             // Breeding records
    //             { name: 'Primary Bull', path: 'BreedingRecords/PrimaryBulls' },
    //             { name: 'Cleanup Bull', path: 'BreedingRecords/CleanupBulls' },
    //             { name: 'Current Bull', path: 'BreedingRecords/CurrentBull' },
    //             { name: 'Exposure Start Date', path: 'BreedingRecords/ExposureStartDate' },
    //             { name: 'Exposure End Date', path: 'BreedingRecords/ExposureEndDate' },

    //             // Pregnancy checks
    //             { name: 'Is Pregnant', path: 'PregancyCheck/IsPregnant' },
    //             { name: 'Pregnancy Check Date', path: 'PregancyCheck/PregCheckDate' },
    //             { name: 'Fetus Sex', path: 'PregancyCheck/FetusSex' },
    //             { name: 'Months Pregnant', path: 'PregancyCheck/MonthsPregnant' },
    //             { name: 'Pregnancy Weight', path: 'PregancyCheck/WeightRecordID' },
    //             { name: 'Pregnancy Notes', path: 'PregancyCheck/Notes' },

    //             // Calving records
    //             { name: 'Calf Sex', path: 'CalvingRecords/CalfSex' },
    //             { name: 'Calf Birth Date', path: 'CalvingRecords/BirthDate' },
    //             { name: 'Calving Notes', path: 'CalvingRecords/CalvingNotes' },

    //             // Herd information
    //             { name: 'Current Pasture', path: 'Herds/CurrentPasture' },

    //             // Calculated fields
    //             { name: 'Age', path: 'Calculated/Age' },
    //             { name: 'Age in Months', path: 'Calculated/AgeInMonths' },
    //             { name: 'Pregnancy Months', path: 'Calculated/PregnancyMonths' },
    //             { name: 'Open Status', path: 'Calculated/OpenStatus' },
    //             { name: 'Cull Status', path: 'Calculated/CullStatus' },
    //             { name: 'Breeding Status', path: 'Calculated/BreedingStatus' },
    //             { name: 'Weaning Status', path: 'Calculated/WeaningStatus' },

    //             // Fillable fields
    //             { name: 'Notes', path: 'Fillable/Notes' },
    //             { name: 'New Weight', path: 'Fillable/Weight' },
    //             { name: 'Date', path: 'Fillable/Date' },
    //         ];

    //         const enhancedColumns = baseColumns.map(col => {
    //             const type = this.getFieldType(col.path);
    //             const editable = isEditable(col.path);
    //             const updateHandler = this.getUpdateHandler(col.path);
    //             const options = this.getFieldOptions(col.path);

    //             return {
    //                 key: generateKey(col.name, col.path),
    //                 name: col.name,
    //                 dataPath: col.path,
    //                 editable: editable,
    //                 type: type,
    //                 ...(options.length > 0 && { options: options }),
    //                 ...(updateHandler && { updateHandler: updateHandler })
    //             };
    //         });

    //         return { columns: enhancedColumns };
    //     } catch (error) {
    //         console.error('Error getting available columns:', error);
    //         throw error;
    //     }
    // }
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
    getWeightRecord: (params) => dbOps.getWeightRecord(params),
    updateWeightRecord: (params) => dbOps.updateWeightRecord(params),
    deleteWeightRecord: (params) => dbOps.deleteWeightRecord(params),



    addCow: (params) => dbOps.addCow(params),
    getAllAnimals: (params) => dbOps.getAllAnimals(params),


    // Medical records
    fetchCowMedicalRecords: (params) => dbOps.fetchCowMedicalRecords(params),
    createMedicalRecord: (params) => dbOps.createMedicalRecord(params),
    getMedicalRecord: (params) => dbOps.getMedicalRecord(params),
    updateMedicalRecord: (params) => dbOps.updateMedicalRecord(params),
    deleteMedicalRecord: (params) => dbOps.deleteMedicalRecord(params),
    resolveIssue: (params) => dbOps.resolveIssue(params),

    getMedicines: (params) => dbOps.getMedicines(params),
    addMedicine: (params) => dbOps.addMedicine(params),
    updateMedicine: (params) => dbOps.updateMedicine(params),


    // Herd Managment
    getHerds: () => dbOps.getHerds(),
    setAnimalsHerd: (params) => dbOps.setAnimalsHerd(params),
    getHerdAnimals: (params) => dbOps.getHerdAnimals(params),
    moveHerd: (params) => dbOps.moveHerd(params),
    getHerdEvents: (params) => dbOps.getHerdEvents(params),
    addHerdEvent: (params) => dbOps.addHerdEvent(params),
    createHerd: (params) => dbOps.createHerd(params),

    getHerdNote: (params) => dbOps.getHerdNote(params),
    addHerdNote: (params) => dbOps.addHerdNote(params),
    updateHerdNote: (params) => dbOps.updateHerdNote(params),
    deleteHerdNote: (params) => dbOps.deleteHerdNote(params),



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
    getCowAccounting: (params) => dbOps.getCowAccounting(params),





    // Breeding Plan
    getBreedingPlans: () => dbOps.getBreedingPlans(),
    getBreedingPlanOverview: (params) => dbOps.getBreedingPlanOverview(params),
    getBreedingAnimalStatus: () => dbOps.getBreedingAnimalStatus(),
    getHerdBreedingCandidates: (params) => dbOps.getHerdBreedingCandidates(params),
    assignBreedingRecords: (params) => dbOps.assignBreedingRecords(params),
    updateBreedingStatus: (params) => dbOps.updateBreedingStatus(params.cowTag, params.value, params.breedingYear),
    findBreedingRecordForDam: (damTag, breedingYear) => dbOps.findBreedingRecordForDam(damTag, breedingYear),

    // Pregnancy Check
    getPregancyCheck: (params) => dbOps.getPregancyCheck(params),
    createPregancyCheck: (params) => dbOps.createPregancyCheck(params),
    updatePregancyCheck: (params) => dbOps.updatePregancyCheck(params),
    deletePregancyCheck: (params) => dbOps.deletePregancyCheck(params),


    // Calving Tracker
    getCalvingStatus: (params) => dbOps.getCalvingStatus(params),
    getCalvingRecord: (params) => dbOps.getCalvingRecord(params),
    createCalvingRecord: (params) => dbOps.createCalvingRecord(params),
    updateCalvingRecord: (params) => dbOps.updateCalvingRecord(params),
    deleteCalvingRecord: (params) => dbOps.deleteCalvingRecord(params),

    generateCalfTag: (params) => dbOps.generateCalfTag(params),
    calculateBreedFromParents: (damTag, sireTag) => dbOps.calculateBreedFromParents(damTag, sireTag),
    addCowWithCalfHandling: (params) => dbOps.addCowWithCalfHandling(params),


    // Weaning Tracker & updaters
    updateWeaningStatus: (params) => dbOps.updateWeaningStatus(params.cowTag, params.value, params.breedingYear),
    recordWeaning: (params) => dbOps.recordWeaning(params),
    getWeaningCandidates: (params) => dbOps.getWeaningCandidates(params),



    // Users
    checkUsers: () => dbOps.checkUsers(),
    getAllUsers: () => dbOps.getAllUsers(),
    lookupUser: (params) => dbOps.lookupUser(params),
    setupUser: (params) => dbOps.setupUser(params),
    validatePassword: (params) => dbOps.validatePassword(params),
    setUserPassword: (params) => dbOps.setUserPassword(params),
    resetUserPassword: (params) => dbOps.resetUserPassword(params),
    updateUserPermissions: (params) => dbOps.updateUserPermissions(params),
    blockUser: (params) => dbOps.blockUser(params),
    unblockUser: (params) => dbOps.unblockUser(params),
    preRegisterUser: (params) => dbOps.preRegisterUser(params),
    deleteUser: (params) => dbOps.deleteUser(params),
    importUsers: (params) => dbOps.importUsers(params),

    getUserPreferences: (params) => dbOps.getUserPreferences(params),
    updateUserPreferences: (params) => dbOps.updateUserPreferences(params),




    // Pasture & feed activity
    getAllPastures: () => dbOps.getAllPastures(),
    addFeedType: (params) => dbOps.addFeedType(params),
    getHerdFeedStatus: (params) => dbOps.getHerdFeedStatus(params),
    getAllFeedTypes: () => dbOps.getAllFeedTypes(),
    recordFeedActivity: (params) => dbOps.recordFeedActivity(params),
    getPastureMaintenanceEvents: (params) => dbOps.getPastureMaintenanceEvents(params),
    addPastureMaintenanceEvent: (params) => dbOps.addPastureMaintenanceEvent(params),




    // Sheet Templates
    getAllSheetTemplates: () => dbOps.getAllSheetTemplates(),
    getSheetTemplate: (sheetId) => dbOps.getSheetTemplate(sheetId),
    createSheetTemplate: (params) => dbOps.createSheetTemplate(params),
    updateSheetTemplate: (params) => dbOps.updateSheetTemplate(params),
    deleteSheetTemplate: (sheetId) => dbOps.deleteSheetTemplate(sheetId),
    getAvailableColumns: () => dbOps.getAvailableColumns(),
    getTemplatePreviewColumns: (params) => dbOps.getTemplatePreviewColumns(params),



    // Sheet Instance Management
    getAllSheetInstances: () => dbOps.getAllSheetInstances(),
    getSheetInstance: (params) => dbOps.getSheetInstance(params),
    updateSheetInstance: (params) => dbOps.updateSheetInstance(params),
    deleteSheetInstance: (params) => dbOps.deleteSheetInstance(params),

    loadSheetInstance: (params) => dbOps.loadSheetInstance(params),
    createSheetInstance: (params) => dbOps.createSheetInstance(params),
    tryLoadSheetInstance: (params) => dbOps.tryLoadSheetInstance(params),

    // Dynamic sheet data & updaters
    updateSheetCell: (params) => dbOps.updateSheetCell(params),
    bulkUpdateSheetRows: (params) => dbOps.bulkUpdateSheetRows(params),

    getFormDropdownData: () => dbOps.getFormDropdownData(),
    addFormDropdownData: (params) => dbOps.addFormDropdownData(params),



    // Uhh? ??? Dunno, TODO look into
    generateTagSuggestions: (params) => dbOps.generateTagSuggestions(params),
    createWeightRecordBatch: (params) => dbOps.createWeightRecordBatch(params),


};