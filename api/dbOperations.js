const { sql, pool } = require('./db');

/**
 * Database operations class with comprehensive cattle management functions
 * Input is already validated by API wrapper - no need for branded types
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
     * Fetch cow data including medical records, notes, and offspring
     * @param {Object} params - { cowTag }
     */
    async fetchCowData(params) {
        const { cowTag } = params;
        await this.ensureConnection();
    
        try {
            // Cow basic data with current location (using correct column names)
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
    
            // Most recent weight record from WeightRecords table
            const weightRequest = this.pool.request();
            weightRequest.input('cowTag', sql.NVarChar, cowTag);
            const weightQuery = `
                SELECT TOP 1 Weight, TimeRecorded AS WeightDate,
                    CONVERT(varchar, TimeRecorded, 120) AS FormattedDate
                FROM WeightRecords 
                WHERE CowTag = @cowTag
                ORDER BY TimeRecorded DESC`;
            const weightData = await weightRequest.query(weightQuery);
    
            // Medical records (using correct column names)
            const medicalRecordsRequest = this.pool.request();
            medicalRecordsRequest.input('cowTag', sql.NVarChar, cowTag);
            const medicalRecordsQuery = `
                SELECT 
                    TreatmentMedicine, TreatmentDate, IssueDescription, 
                    TreatmentResponse, TreatmentMethod,
                    CONVERT(varchar, TreatmentDate, 120) AS FormattedDate
                FROM 
                    MedicalTable 
                WHERE 
                    CowTag = @cowTag
                ORDER BY TreatmentDate DESC`;
            const medicalRecords = await medicalRecordsRequest.query(medicalRecordsQuery);
    
            // Notes/Observations (using correct column names)
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
    
            // Offspring (using correct column names)
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
                currentWeight: weightData.recordset[0] || null,
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
     * @param {Object} params - { cowTag, medicineApplied, treatmentDate, observation, treatment, treatmentResponse }
     */
    async addMedicalRecord(params) {
        const { cowTag, medicineApplied, treatmentDate, observation, treatment, treatmentResponse } = params;
        await this.ensureConnection();

        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            request.input('treatmentMedicine', sql.NVarChar, medicineApplied);
            request.input('treatmentDate', sql.DateTime, treatmentDate);
            request.input('issueDescription', sql.NVarChar, observation || null);
            request.input('treatment', sql.NVarChar, treatment || null);
            request.input('treatmentResponse', sql.NVarChar, treatmentResponse || null);

            const query = `
                INSERT INTO MedicalTable (CowTag, TreatmentMedicine, TreatmentDate, IssueDescription, Treatment, TreatmentResponse)
                VALUES (@cowTag, @treatmentMedicine, @treatmentDate, @issueDescription, @treatment, @treatmentResponse)`;
                
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
     * Add new cow to database
     * @param {Object} params - { cowTag, dateOfBirth, description, dam, sire }
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

    // UPDATED setHerd function to include HerdMembershipHistory
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

    /**
     * SHEET MANAGEMENT FUNCTIONS
     */

    async getAllSheetsFromDB() {
        await this.ensureConnection();
        try {
            const query = `SELECT ID, SheetName, CreatedBy FROM Sheets ORDER BY SheetName`;
            const result = await this.pool.request().query(query);
            return { sheets: result.recordset };
        } catch (error) {
            console.error('Error fetching sheets from DB:', error);
            throw error;
        }
    }

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

    async createSheetInDB(params) {
        const { name, columns, createdBy } = params;
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('sheetName', sql.NVarChar, name);
            request.input('columns', sql.NText, JSON.stringify(columns));
            request.input('createdBy', sql.NVarChar, createdBy);
            
            const query = `
                INSERT INTO Sheets (SheetName, Columns, CreatedBy)
                VALUES (@sheetName, @columns, @createdBy)`;
            
            const result = await request.query(query);
            return { success: true, rowsAffected: result.rowsAffected[0] };
        } catch (error) {
            console.error('Error creating sheet:', error);
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
            request.input('columns', sql.NText, JSON.stringify(columns));
            
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
                    ORDER BY CowTag`;
                const result = await request.query(query);
                return result.recordset.map(r => r.CowTag);
            } else {
                // All active cows: Current, Target Sale, Undefined, and NULL status
                const query = `
                    SELECT CowTag 
                    FROM CowTable 
                    WHERE CowTag IS NOT NULL 
                      AND (Status IS NULL 
                           OR Status IN ('Current', 'Target Sale', 'Undefined', 'CULL LIST, Current'))
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


    async getCalvingRecordsValue(cowTag, fieldName) {
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            
            switch (fieldName) {
                case 'CalfSex':
                    const sexQuery = `
                        SELECT TOP 1 CalfSex
                        FROM CalvingRecords 
                        WHERE DamTag = @cowTag
                        ORDER BY BirthDate DESC`;
                    const sexResult = await request.query(sexQuery);
                    return sexResult.recordset[0]?.CalfSex || '';
                    
                case 'BirthDate':
                    // Format birth date to mm/dd/yyyy
                    const birthQuery = `
                        SELECT TOP 1 FORMAT(BirthDate, 'MM/dd/yyyy') AS FormattedBirthDate
                        FROM CalvingRecords 
                        WHERE DamTag = @cowTag
                        ORDER BY BirthDate DESC`;
                    const birthResult = await request.query(birthQuery);
                    return birthResult.recordset[0]?.FormattedBirthDate || '';
                    
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

    async getPregancyCheckValue(cowTag, fieldName) {
        await this.ensureConnection();
        
        try {
            const request = this.pool.request();
            request.input('cowTag', sql.NVarChar, cowTag);
            
            switch (fieldName) {
                case 'IsPregnant':
                    const pregnantQuery = `
                        SELECT TOP 1 IsPregnant
                        FROM PregancyCheck 
                        WHERE CowTag = @cowTag
                        ORDER BY PregCheckDate DESC`;
                    const pregnantResult = await request.query(pregnantQuery);
                    return pregnantResult.recordset[0]?.IsPregnant ? 'Yes' : 'No';
                    
                case 'PregCheckDate':
                    // Format pregnancy check date to mm/dd/yyyy
                    const dateQuery = `
                        SELECT TOP 1 FORMAT(PregCheckDate, 'MM/dd/yyyy') AS FormattedPregCheckDate
                        FROM PregancyCheck 
                        WHERE CowTag = @cowTag
                        ORDER BY PregCheckDate DESC`;
                    const dateResult = await request.query(dateQuery);
                    return dateResult.recordset[0]?.FormattedPregCheckDate || '';
                    
                case 'Notes':
                    const notesQuery = `
                        SELECT TOP 1 Notes
                        FROM PregancyCheck 
                        WHERE CowTag = @cowTag
                        ORDER BY PregCheckDate DESC`;
                    const notesResult = await request.query(notesQuery);
                    return notesResult.recordset[0]?.Notes || '';
                    
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
                    // All immunizations
                    const vaccinationQuery = `
                        SELECT TreatmentMedicine, TreatmentDate
                        FROM MedicalTable 
                        WHERE CowTag = @cowTag AND TreatmentIsImmunization = 1
                        ORDER BY TreatmentDate DESC`;
                    const vaccinationResult = await request.query(vaccinationQuery);
                    return vaccinationResult.recordset
                        .map(v => `${v.TreatmentMedicine} (${v.TreatmentDate.toLocaleDateString()})`)
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
                        .map(t => `${t.TreatmentMedicine} (${t.TreatmentDate.toLocaleDateString()})`)
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
                        .map(t => `${t.TreatmentMedicine} (${t.LatestDate.toLocaleDateString()})`)
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
                        .map(i => `${i.IssueDescription} (${i.IssueObservationDate.toLocaleDateString()})`)
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

    async getFillableValue(cowTag, fieldName) {
        // Fillable fields always return empty string for user input
        return '';
    }

    /**
     * UPDATED AVAILABLE COLUMNS (Comprehensive)
     */

    async getAvailableColumns() {
        try {
            const columns = [
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
                { name: 'Pregnancy Notes', path: 'PregancyCheck/Notes' },
                
                // Calving records
                { name: 'Calf Sex', path: 'CalvingRecords/CalfSex' },
                { name: 'Calf Birth Date', path: 'CalvingRecords/BirthDate' },
                
                // Herd information
                { name: 'Current Pasture', path: 'Herds/CurrentPasture' },
                
                // Calculated fields
                { name: 'Age', path: 'Calculated/Age' },
                { name: 'Pregnancy Months', path: 'Calculated/PregnancyMonths' },
                { name: 'Open Status', path: 'Calculated/OpenStatus' },
                { name: 'Cull Status', path: 'Calculated/CullStatus' },
                
                // Fillable fields
                { name: 'Notes', path: 'Fillable/Notes' },
                { name: 'New Weight', path: 'Fillable/NewWeight' },
                { name: 'Date', path: 'Fillable/Date' },
                { name: 'Extra Notes', path: 'Fillable/ExtraNotes' },
                { name: 'Cull Prospect', path: 'Fillable/CullProspect' }
            ];

            return { columns };
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
    addObservation: (params) => dbOps.addObservation(params),
    addMedicalRecord: (params) => dbOps.addMedicalRecord(params),
    updateCowWeight: (params) => dbOps.updateCowWeight(params),
    addCow: (params) => dbOps.addCow(params),
    getAllCows: (params) => dbOps.getAllCows(params),
    setHerd: (params) => dbOps.setHerd(params),
    getAllHerds: () => dbOps.getAllHerds(),
    getAllHerdsWithDetails: () => dbOps.getAllHerdsWithDetails(),
    getHerdFeedStatus: (params) => dbOps.getHerdFeedStatus(params),
    getAllFeedTypes: () => dbOps.getAllFeedTypes(),
    recordFeedActivity: (params) => dbOps.recordFeedActivity(params),
    getHerdAnimals: (params) => dbOps.getHerdAnimals(params),
    moveHerdToPasture: (params) => dbOps.moveHerdToPasture(params),
    getAllPastures: () => dbOps.getAllPastures(),
    
    // sheet management functions
    getAllSheetsFromDB: () => dbOps.getAllSheetsFromDB(),
    getSheetDefinition: (sheetId) => dbOps.getSheetDefinition(sheetId),
    createSheetInDB: (params) => dbOps.createSheetInDB(params),
    updateSheetInDB: (params) => dbOps.updateSheetInDB(params),
    deleteSheetFromDB: (sheetId) => dbOps.deleteSheetFromDB(sheetId),
    
    // Dynamic sheet data functions
    getSheetDataDynamic: (params) => dbOps.getSheetDataDynamic(params),
    getAvailableColumns: () => dbOps.getAvailableColumns(),
    getCowListForHerd: (herdName) => dbOps.getCowListForHerd(herdName),
    getColumnValue: (cowTag, dataPath) => dbOps.getColumnValue(cowTag, dataPath)
};