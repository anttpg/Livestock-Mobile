const { validationResult } = require('express-validator');
const { getUserEmail } = require('../backend/accessControl');
const dbOperations = require('./dbOperations');
const localFileOps = require('./local');

/**
 * Streamlined API wrapper that enforces validation and access control
 * without the complexity of branded types
 */
class APIWrapper {

    /**
     * Generic operation executor with validation and access control
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object  
     * @param {string} operation - Name of the operation in dbOperations
     * @param {Function} paramExtractor - Function to extract parameters from request
     * @returns {Promise} - Database operation result
     */
    async executeDBOperation(req, res, operation, paramExtractor) {
        try {
            // Access Control (always enforced)
            // const accessResult = await this.checkAccess(req, res);
            // if (!accessResult.success) {
            //     return res.status(403).json({ error: accessResult.error });
            // }

            // Step 2: Input Validation (already done by route middleware)
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            // Step 3: Extract parameters and execute operation
            if (!dbOperations[operation]) {
                throw new Error(`Operation '${operation}' not found in dbOperations`);
            }

            const params = paramExtractor(req);
            const result = await dbOperations[operation](params);

            // Return the data directly without wrapping
            return res.status(200).json(result);

        } catch (error) {
            console.error(`API Error in ${operation}:`, error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                operation: operation
            });
        }
    }

    /**
     * Execute file operation with validation and access control
     */
    async executeFileOperation(req, res, operation, paramExtractor) {
        try {
            // if (!accessResult.success) {
            //     return res.status(403).json({ error: accessResult.error });
            // }

            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                console.error(`API Error in operation '${operation}'`);

                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            // Execute file operation
            if (!localFileOps[operation]) {
                throw new Error(`File operation '${operation}' not found`);
            }

            const params = paramExtractor(req);
            const result = await localFileOps[operation](params);

            // Return the result directly
            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(404).json(result);
            }

        } catch (error) {
            console.error(`File API Error in ${operation}:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }













    /**
    * All animals and basic info
    */
    async getAllAnimals(req, res, options = {}) {
        return this.executeDBOperation(req, res, 'getAllAnimals', () => options);
    }


    /**
     * Returns primary cow data
     */
    async getCowData(req, res) {
        try {
            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const cowTag = req.params.tag;

            // Get database data using individual functions
            const [cowData, currentWeight, notes, calves] = await Promise.all([
                dbOperations.getCowTableData(cowTag),
                dbOperations.getCurrentWeight(cowTag),
                dbOperations.getNotes(cowTag),
                dbOperations.getOffspring(cowTag)
            ]);

            // Get minimap if cow has a pasture
            let minimap = null;
            if (cowData?.PastureName) {
                const minimapResult = await localFileOps.getMinimap({
                    fieldName: cowData.PastureName
                });
                if (minimapResult.success) {
                    minimap = {
                        pastureName: cowData.PastureName,
                        path: `/api/minimap/${encodeURIComponent(cowData.PastureName)}`
                    };
                }
            }

            const allHerds = await dbOperations.getHerds();

            // Build response
            const responseData = {
                cowData: cowData,
                currentWeight: currentWeight,
                notes: notes,
                calves: calves,
                minimap: minimap,
                availableHerds: allHerds.herds.map(h => h.herdName)
            };

            return res.status(200).json(responseData);
        } catch (error) {
            console.error('API Error in getCowData:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    async updateCow(req, res) {
        return this.executeDBOperation(req, res, 'updateCowTableData', (req) => ({
            cowTag: req.params.cowTag,
            updates: req.body
        }));
    }




    /**
     * TODO, NOT YET WORKING, NEEDS TO BE FINISHED.....  <-------------------------------------------------------
     */
    async renameCow(req, res) {
        // Parse initial tag, resultingTag
        var cowTag = req.params.cowTag;
        var newTag = req.params.newTag;

        // Check that the specified cowtag exists, and that the target cowtag does not already exist
        var initialExists = this.executeDBOperation(req, res, 'cowTagExists', (req) => ({ cowTag }));
        var newExists = this.executeDBOperation(req, res, 'cowTagExists', (req) => ({ newTag }));
        
        if (!initialExists) {
            // return 500 error, the starting cow does not exist / 
        }

        if (newExists) {
            // return 500 error, the ending tag must not exist in cowTable
        }

        // Rename all the database records...
        var res = this.executeDBOperation(req, res, 'renameCow', (req) => ({ 
            cowTag,
            newTag
        }));

        // ...as well as all photos
        this.executeFileOperation(req, res, 'renameCow', (req) => ({ 
            cowTag,
            newTag
        }));
    }

    /**
     * @returns JSON { invalidCharacters: a list invalid cowTag characters }
     */
    getInvalidCowTagCharacters(req, res) {
        return res.json({ 
            invalidCharacters: ['/', '\\', ':', '*', '?', '"', "'", '<', '>', '|', '#'] 
        });
    }





    
    /**
     * Returns all Epds for a cow
     */
    async getCowEpds(req, res) {
        try {


            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const cowTag = req.params.tag;

            // Get EPD data from database
            const epdResult = await dbOperations.fetchCowEpds({ cowTag });

            return res.status(200).json(epdResult);
        } catch (error) {
            console.error('API Error in getCowEpds:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }


    /**
     * Returns all medical records for a cow
     */
    async getCowMedicalRecords(req, res) {
        try {



            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const cowTag = req.params.tag;

            // Get Medical record data
            const responseData = await dbOperations.fetchCowMedicalRecords({ cowTag });
            return res.status(200).json(responseData);
        } catch (error) {
            console.error('API Error in getCowMedicalRecords:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }


    /**
     * Move one or more cows to a herd.
     * Body: { cowTags: string[] | string, herdName: string }
     */
    async setCowsHerd(req, res) {
        return this.executeDBOperation(req, res, 'setAnimalsHerd', (req) => {
            const { cowTags, herdName } = req.body;
            const tags = Array.isArray(cowTags) ? cowTags : [cowTags];
            return { cowTags: tags, herdName };
        });
    }

    /**
     * Move one or more goats to a herd.
     * Body: { goatTags: string[] | string, herdName: string }
     */
    async setGoatsHerd(req, res) {
        return this.executeDBOperation(req, res, 'setAnimalsHerd', (req) => {
            const { goatTags, herdName } = req.body;
            const tags = Array.isArray(goatTags) ? goatTags : [goatTags];
            return { goatTags: tags, herdName };
        });
    }




    async getNotes(req, res) {
        return this.executeDBOperation(req, res, 'getNotes', (req) => ({
            cowTag: req.params.cowTag
        }));
    }

    async addNote(req, res) {
        return this.executeDBOperation(req, res, 'addNote', (req) => ({
            ...req.body,
            dateOfEntry: req.body.dateOfEntry || new Date()
        }));
    }

    async updateNote(req, res) {
        return this.executeDBOperation(req, res, 'updateNote', (req) => req.body);
    }

    async deleteNote(req, res) {
        return this.executeDBOperation(req, res, 'deleteNote', (req) => req.body);
    }








    // CUSTOMERS
    async getCustomers(req, res) {
        return this.executeDBOperation(req, res, 'getCustomers', () => ({}));
    }

    async addCustomer(req, res) {
        return this.executeDBOperation(req, res, 'addCustomer', (req) => req.body);
    }

    async updateCustomer(req, res) {
        return this.executeDBOperation(req, res, 'updateCustomer', (req) => ({
            NameFirstLast: req.params.NameFirstLast,
            ...req.body
        }));
    }



    // SALES
    async getAllSales(req, res) {
        return this.executeDBOperation(req, res, 'getAllSales', () => ({}));
    }

    async getSaleRecord(req, res) {
        return this.executeDBOperation(req, res, 'getSaleRecord', (req) => ({
            ID: parseInt(req.params.ID)
        }));
    }

    async createSaleRecord(req, res) {
        return this.executeDBOperation(req, res, 'createSaleRecord', (req) => req.body);
    }

    async updateSaleRecord(req, res) {
        return this.executeDBOperation(req, res, 'updateSaleRecord', (req) => ({
            ID: parseInt(req.params.ID),
            ...req.body
        }));
    }



    // PURCHASES
    async getAllPurchases(req, res) {
        return this.executeDBOperation(req, res, 'getAllPurchases', () => ({}));
    }

    async getPurchaseRecord(req, res) {
        return this.executeDBOperation(req, res, 'getPurchaseRecord', (req) => ({
            ID: parseInt(req.params.ID)
        }));
    }

    async createPurchaseRecord(req, res) {
        return this.executeDBOperation(req, res, 'createPurchaseRecord', (req) => req.body);
    }

    async updatePurchaseRecord(req, res) {
        return this.executeDBOperation(req, res, 'updatePurchaseRecord', (req) => ({
            ID: parseInt(req.params.ID),
            ...req.body
        }));
    }





    // COW ACCOUNTING
    async getCowAccounting(req, res) {
        return this.executeDBOperation(req, res, 'getCowAccounting', (req) => ({
            cowTag: req.params.cowTag
        }));
    }



















    async createMedicalRecord(req, res) {
        return this.executeDBOperation(req, res, 'createMedicalRecord', (req) => ({
            cowTag:      req.body.cowTag,
            recordType:  req.body.recordType,
            EventID:     req.body.EventID,
            Note:        req.body.Note,

            IssueDescription:     req.body.IssueDescription,
            IssueObservedBy:      req.body.IssueObservedBy,
            IssueObservationDate: req.body.IssueObservationDate,
            IssueSerious:         req.body.IssueSerious,

            TreatmentMedicineID:  req.body.TreatmentMedicineID,
            TreatmentDate:        req.body.TreatmentDate,
            TreatmentResponse:    req.body.TreatmentResponse,
            TreatmentIsActive:    req.body.TreatmentIsActive,

            VetName:     req.body.VetName,
            VetComments: req.body.VetComments,
        }));
    }

    async getMedicalRecord(req, res) {
        return this.executeDBOperation(req, res, 'getMedicalRecord', (req) => ({
            recordId: parseInt(req.params.recordId)
        }));
    }

    async updateMedicalRecord(req, res) {
        return this.executeDBOperation(req, res, 'updateMedicalRecord', (req) => ({
            recordId: parseInt(req.params.recordId),
            ...req.body
        }));
    }

    async resolveIssue(req, res) {
        return this.executeDBOperation(req, res, 'resolveIssue', (req) => ({
            recordID: parseInt(req.params.recordId),
            resolutionNote: req.body.resolutionNote,
            resolutionDate: req.body.resolutionDate
        }));
    }

    async getMedicines(req, res) {
        return this.executeDBOperation(req, res, 'getMedicines', () => ({}));
    }

    async addMedicine(req, res) {
        return this.executeDBOperation(req, res, 'addMedicine', (req) => ({
            medicineClass: req.body.medicineClass,
            dewormerClass: req.body.dewormerClass,
            shorthand: req.body.shorthand,
            genericName: req.body.genericName,
            brandName: req.body.brandName,
            manufacturer: req.body.manufacturer,
            applicationMethod: req.body.applicationMethod,
            mixRecipe: req.body.mixRecipe
        }));
    }

    async updateMedicine(req, res) {
        return this.executeDBOperation(req, res, 'updateMedicine', (req) => ({
            medicineID: parseInt(req.params.ID),
            medicineClass: req.body.medicineClass,
            dewormerClass: req.body.dewormerClass,
            shorthand: req.body.shorthand,
            genericName: req.body.genericName,
            brandName: req.body.brandName,
            manufacturer: req.body.manufacturer,
            applicationMethod: req.body.applicationMethod,
            mixRecipe: req.body.mixRecipe
        }));
    }


    async createWeightRecord(req, res) {
        return this.executeDBOperation(req, res, 'createWeightRecord', (req) => ({
            cowTag:       req.body.cowTag,
            Weight:       req.body.Weight,
            TimeRecorded: req.body.TimeRecorded,
            EventID:      req.body.EventID,
            Notes:        req.body.Notes
        }));
    }

    async updateWeightRecord(req, res) {
        return this.executeDBOperation(req, res, 'updateWeightRecord', (req) => ({
            cowTag:       req.body.cowTag,
            Weight:       req.body.Weight,
            TimeRecorded: req.body.TimeRecorded
        }));
    }

    /**
     * Get breeding candidates for pregnancy check
     */
    async getHerdBreedingCandidates(req, res) {
        return this.executeDBOperation(req, res, 'getHerdBreedingCandidates', (req) => ({
            herdName: req.params.herdName
        }));
    }

    /**
     * Submit pregnancy check results
     */
    async createPregancyCheck(req, res) {
        return this.executeDBOperation(req, res, 'createPregancyCheck', (req) => ({
            herdName: req.body.herdName,
            date: req.body.date,
            records: req.body.records
        }));
    }

    /**
     * Get calving status for herd
     */
    async getCalvingStatus(req, res) {
        return this.executeDBOperation(req, res, 'getCalvingStatus', (req) => ({
            herdName: req.params.herdName
        }));
    }

    /**
     * Add calving record
     */
    async createCalvingRecord(req, res) {
        return this.executeDBOperation(req, res, 'createCalvingRecord', (req) => ({
            breedingRecordId: req.body.breedingRecordId,
            calfTag: req.body.calfTag,
            damTag: req.body.damTag,
            birthDate: req.body.birthDate,
            calfSex: req.body.calfSex,
            notes: req.body.notes,
            twins: req.body.twins || false
        }));
    }

    /**
     * Get weaning candidates
     */
    async getWeaningCandidates(req, res) {
        return this.executeDBOperation(req, res, 'getWeaningCandidates', (req) => ({
            herdName: req.params.herdName
        }));
    }

    /**
     * Record weaning
     */
    async recordWeaning(req, res) {
        return this.executeDBOperation(req, res, 'recordWeaning', (req) => ({
            date: req.body.date,
            records: req.body.records
        }));
    }

    /**
     * Generate tag suggestions
     */
    async generateTagSuggestions(req, res) {
        return this.executeDBOperation(req, res, 'generateTagSuggestions', (req) => ({
            baseTag: req.params.tag,
            allowReusable: req.query.reusable === 'true'
        }));
    }

    /**
     * Record batch weights
     */
    async createWeightRecordBatch(req, res) {
        return this.executeDBOperation(req, res, 'createWeightRecordBatch', (req) => ({
            date: req.body.date,
            records: req.body.records
        }));
    }


    /**
     * Get breeding plans
     */
    async getBreedingPlans(req, res) {
        return this.executeDBOperation(req, res, 'getBreedingPlans', (req) => ({}));
    }

    /**
     * Get breeding plan overview
     */
    async getBreedingPlanOverview(req, res) {
        return this.executeDBOperation(req, res, 'getBreedingPlanOverview', (req) => {
            const planId = parseInt(req.params.planId, 10);
            if (isNaN(planId)) {
                throw new Error(`Invalid planId: '${req.params.planId}' could not be converted to integer`);
            }
            
            return { planId };
        });
    }

    /**
     * Get form dropdown data
     */
    async getFormDropdownData(req, res) {
        return this.executeDBOperation(req, res, 'getFormDropdownData', (req) => ({}));
    }

    async addFormDropdownData(req, res) {
        return this.executeDBOperation(req, res, 'addFormDropdownData', (req) => ({
            table: req.body.table,
            value: req.body.value
        }));
    }


    /**
     * Add a new cow to the database with optional calving record creation
     */
    async addCow(req, res) {
        try {
            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            // Extract parameters
            const cowData = {
                cowTag: req.body.cowTag,
                dateOfBirth: req.body.dateOfBirth,
                description: req.body.description,
                dam: req.body.dam,
                sire: req.body.sire,
                sex: req.body.sex,
                status: req.body.status,
                currentHerd: req.body.currentHerd,
                breed: req.body.breed,
                temperament: req.body.temperament,
                regCert: req.body.regCert,
                regCertNumber: req.body.regCertNumber,
                birthweight: req.body.birthweight,
                birthweightClass: req.body.birthweightClass,
                targetPrice: req.body.targetPrice,
                origin: req.body.origin
            };

            const createCalvingRecord = req.body.createCalvingRecord === true;
            const breedingYear = req.body.breedingYear || new Date().getFullYear();

            // Step 1: Add the cow
            const cowResult = await dbOperations.addCow(cowData);
            console.log("=== cowData extracted ===");
            console.log(JSON.stringify(cowData, null, 2));
            console.log("Normalized createCalvingRecord:", createCalvingRecord);
            console.log("Breeding year:", breedingYear);

            // Step 2: Optionally create calving record if this is a calf
            if (createCalvingRecord && cowData.dam && cowData.dateOfBirth) {
                try {
                    // Find breeding record for the dam
                    const breedingRecordId = await dbOperations.findBreedingRecordForDam(cowData.dam, breedingYear);
                    
                    if (breedingRecordId) {
                        // Create calving record
                        await dbOperations.createCalvingRecord({
                            breedingRecordId: breedingRecordId,
                            calfTag: cowData.cowTag,
                            damTag: cowData.dam,
                            birthDate: cowData.dateOfBirth,
                            calfSex: cowData.sex,
                            notes: req.body.calvingNotes || null,
                            twins: req.body.twins || false
                        });

                        return res.status(200).json({
                            ...cowResult,
                            calvingRecordCreated: true,
                            message: 'Cow and calving record created successfully'
                        });
                    } else {
                        // Cow created but no breeding record found for dam
                        return res.status(200).json({
                            ...cowResult,
                            calvingRecordCreated: false,
                            warning: `Cow created but no breeding record found for dam '${cowData.dam}' in year ${breedingYear}`
                        });
                    }
                } catch (calvingError) {
                    console.error('Error creating calving record:', calvingError);
                    // Cow was created successfully, but calving record failed
                    return res.status(200).json({
                        ...cowResult,
                        calvingRecordCreated: false,
                        warning: `Cow created but failed to create calving record: ${calvingError.message}`
                    });
                }
            }

            // Standard cow creation without calving record
            return res.status(200).json(cowResult);

        } catch (error) {
            console.error('API Error in addCow:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                operation: 'addCow'
            });
        }
    }


    /**
    * Only the herd names
    */
    async getHerds(req, res) {
        return this.executeDBOperation(req, res, 'getHerds', (req) => ({}));
    }




    /**
     * Get feed status for a specific herd
     */
    async getHerdFeedStatus(req, res) {
        return this.executeDBOperation(req, res, 'getHerdFeedStatus', (req) => ({
            herdName: req.params.herdName || req.query.herdName,
            feeds: req.query.feeds ? req.query.feeds.split(',').map(f => f.trim()) : null
        }));
    }

    /**
     * Get all available feed types
     */
    async getAllFeedTypes(req, res) {
        return this.executeDBOperation(req, res, 'getAllFeedTypes', (req) => ({}));
    }

    /**
     * Add a new feed type
     */
    async addFeedType(req, res) {
        return this.executeDBOperation(req, res, 'addFeedType', (req) => ({
            feedType: req.body.feedType
        }));
    }

    /**
     * Record feed activity for a herd's pasture
     */
    async recordFeedActivity(req, res) {
        return this.executeDBOperation(req, res, 'recordFeedActivity', (req) => ({
            herdName: req.body.herdName,
            feedType: req.body.feedType,
            activityType: req.body.activityType,
            wasEmpty: req.body.wasEmpty,
            levelAtRefill: req.body.levelAtRefill,
            username: req.body.username || req.session?.user?.username || 'Unknown'
        }));
    }


    /**
     * Move herd to a new pasture
     */
    async moveHerd(req, res) {
        return this.executeDBOperation(req, res, 'moveHerd', (req) => ({
            herdName: req.body.herdName,
            newPastureName: req.body.newPastureName
        }));
    }


    async getHerdEvents(req, res) {
        return this.executeDBOperation(req, res, 'getHerdEvents', (req) => ({
            herdName: req.params.herdName
        }));
    }

    async addHerdEvent(req, res) {
        return this.executeDBOperation(req, res, 'addHerdEvent', (req) => ({
            herdName: req.params.herdName,
            eventType: req.body.eventType,
            description: req.body.description,
            notes: req.body.notes,
            username: req.body.username || req.session?.user?.username || 'Unknown'
        }));
    }

    async getHerdNote(req, res) {
        return this.executeDBOperation(req, res, 'getHerdNote', (req) => ({
            noteID: parseInt(req.params.noteId)
        }));
    }

    async addHerdNote(req, res) {
        return this.executeDBOperation(req, res, 'addHerdNote', (req) => ({
            herdID: req.body.herdID,
            username: req.body.username || req.session?.user?.username || 'Unknown',
            note: req.body.note
        }));
    }

    async updateHerdNote(req, res) {
        return this.executeDBOperation(req, res, 'updateHerdNote', (req) => ({
            noteID: parseInt(req.params.noteId),
            note: req.body.note,
            archive: req.body.archive
        }));
    }

    async deleteHerdNote(req, res) {
        return this.executeDBOperation(req, res, 'deleteHerdNote', (req) => ({
            noteID: parseInt(req.params.noteId)
        }));
    }






































    

    /**
     * Get all available pastures
     */
    async getAllPastures(req, res) {
        return this.executeDBOperation(req, res, 'getAllPastures', (req) => ({}));
    }

    async getPastureMaintenanceEvents(req, res) {
        return this.executeDBOperation(req, res, 'getPastureMaintenanceEvents', (req) => ({
            pastureName: req.params.pastureName
        }));
    }

    async addPastureMaintenanceEvent(req, res) {
        return this.executeDBOperation(req, res, 'addPastureMaintenanceEvent', (req) => ({
            pastureName: req.body.pastureName,
            targetOfMaintenance: req.body.targetOfMaintenance,
            actionPerformed: req.body.actionPerformed,
            needsFollowUp: req.body.needsFollowUp || false,
            username: req.body.username || req.session?.user?.username || 'Unknown'
        }));
    }

    async createHerd(req, res) {
        return this.executeDBOperation(req, res, 'createHerd', (req) => ({
            herdName: req.body.herdName,
            cows: req.body.cows || [],
            currentPasture: req.body.currentPasture || null
        }));
    }




    async getUserPreferences(req, res) {
        return this.executeDBOperation(req, res, 'getUserPreferences', (req) => ({
            username: req.params.username
        }));
    }

    async updateUserPreferences(req, res) {
        return this.executeDBOperation(req, res, 'updateUserPreferences', (req) => ({
            username: req.params.username,
            preferences: req.body.preferences
        }));
    }


    /**
     * Get animals for breeding assignment
     */
    async getBreedingAnimalStatus(req, res) {
        return this.executeDBOperation(req, res, 'getBreedingAnimalStatus', (req) => ({}));
    }

    /**
     * Assign breeding records for a plan
     */
    async assignBreedingRecords(req, res) {
        return this.executeDBOperation(req, res, 'assignBreedingRecords', (req) => ({
            planId: parseInt(req.body.planId),
            primaryBull: req.body.primaryBull,
            cowTags: req.body.cowTags,
            exposureStartDate: req.body.exposureStartDate,
            exposureEndDate: req.body.exposureEndDate,
            cleanupBull: req.body.cleanupBull || null,
            pasture: req.body.pasture || null
        }));
    }



    /**
     * SHEET MANAGEMENT API FUNCTIONS
     */

    async getAllSheets(req, res) {
        return this.executeDBOperation(req, res, 'getAllSheetTemplates', (req) => ({}));
    }

    async getSheet(req, res) {
        return this.executeDBOperation(req, res, 'getSheetTemplate', (req) => ({
            sheetId: parseInt(req.params.sheetId)
        }));
    }

    async createSheet(req, res) {
        return this.executeDBOperation(req, res, 'createSheetTemplate', (req) => ({
            name:          req.body.name,
            columns:       req.body.columns,
            createdBy:     req.session?.user?.username || 'Unknown',
            locked:        req.body.locked || false,
            parentSheetId: req.body.parentSheetId || null
        }));
    }

    async updateSheet(req, res) {
        return this.executeDBOperation(req, res, 'updateSheetTemplate', (req) => ({
            sheetId: parseInt(req.params.sheetId),
            name:    req.body.name,
            columns: req.body.columns
        }));
    }

    async deleteSheetTemplate(req, res) {
        return this.executeDBOperation(req, res, 'deleteSheetTemplate', (req) => 
            parseInt(req.params.sheetId)
        );
    }

    async getAvailableColumns(req, res) {
        return this.executeDBOperation(req, res, 'getAvailableColumns', () => ({}));
    }

    async getTemplatePreviewColumns(req, res) {
        return this.executeDBOperation(req, res, 'getTemplatePreviewColumns', (req) => ({
            templateId: parseInt(req.params.templateId)
        }));
    }

    async previewSheetColumns(req, res) {
        return this.executeDBOperation(req, res, 'previewSheetColumns', (req) => ({
            templateId: parseInt(req.params.templateId),
        }));
    }

    // NOT YET IMPLEMENTED - getSheetStructure used old dataPath filtering, no longer valid
    async getSheetStructure(req, res) {
        return res.status(501).json({ error: 'getSheetStructure not yet implemented' });
    }


    /**
     * SHEET INSTANCE API FUNCTIONS
     */

    async getAllSheetInstances(req, res) {
        return this.executeDBOperation(req, res, 'getAllSheetInstances', (req) => ({}));
    }

    async getTemplateInstances(req, res) {
        return this.executeDBOperation(req, res, 'getAllSheetInstances', (req) => ({
            templateId: parseInt(req.params.templateId)
        }));
    }

    async getSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'getSheetInstance', (req) => ({
            instanceId: parseInt(req.params.instanceId)
        }));
    }

    async loadSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'loadSheetInstance', (req) => ({
            instanceId: parseInt(req.params.instanceId)
        }));
    }

    async createSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'createSheetInstance', (req) => ({
            templateId:   parseInt(req.params.templateId),
            herdName:     req.body.herdName,
            breedingYear: req.body.breedingYear || null,
            createdBy:    req.session?.user?.username || 'Unknown',
            instanceName: req.body.instanceName || '',
            defaults:     req.body.defaults || {},
        }));
    }

    async updateSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'updateSheetInstance', (req) => ({
            instanceId:   parseInt(req.params.instanceId),
            columnData:   req.body.columnData,
            rowData:      req.body.rowData,
            animalTags:   req.body.animalTags,
            lastEditedBy: req.session?.user?.username || 'Unknown'
        }));
    }

    async deleteSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'deleteSheetInstance', (req) => ({
            instanceId: parseInt(req.params.instanceId)
        }));
    }

    async tryLoadSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'tryLoadSheetInstance', (req) => ({
            instanceId:   req.body.instanceId || null,
            templateId:   req.body.templateId,
            herdName:     req.body.herdName,
            breedingYear: req.body.breedingYear || null,
            createdBy:    req.session?.user?.username || 'Unknown'
        }));
    }

    async updateSheetCell(req, res) {
        return this.executeDBOperation(req, res, 'updateSheetCell', (req) => ({
            instanceId:  parseInt(req.params.instanceId),
            cowTag:      req.body.cowTag,
            recordSlot:  req.body.recordSlot,
            source:      req.body.source,
            fieldKey:    req.body.fieldKey,
            fieldValue:  req.body.fieldValue,
            medicine:    req.body.medicine ?? null,
            createdBy:   req.session?.user?.username || 'Unknown'
        }));
    }

    async bulkUpdateSheetRows(req, res) {
        return this.executeDBOperation(req, res, 'bulkUpdateSheetRows', (req) => ({
            instanceId: parseInt(req.params.instanceId),
            rows:       req.body.rows,
            createdBy:  req.session?.user?.username || 'Unknown'
        }));
    }






























    // Local functions 


    // Binary response — cannot use executeFileOperation
    async getCowImage(req, res) {
        const result = await localFileOps.getCowImage({
            cowTag: req.params.tag,
            imageType: req.params.imageType,
            n: 1
        });

        if (result.success) {
            res.set({
                'Content-Type': result.mimeType,
                'Content-Length': result.size,
                'Content-Disposition': `inline; filename="${result.filename}"`,
                'X-Filename': result.filename,
                'Cache-Control': 'public, max-age=31536000'
            });
            return res.send(result.fileBuffer);
        }
        return res.status(404).json({ error: result.message });
    }

    // Binary response — cannot use executeFileOperation
    async getNthCowImage(req, res) {
        const result = await localFileOps.getCowImage({
            cowTag: req.params.tag,
            imageType: req.params.imageType,
            n: parseInt(req.params.n) || 1
        });

        if (result.success) {
            res.set({
                'Content-Type': result.mimeType,
                'Content-Length': result.size,
                'Content-Disposition': `inline; filename="${result.filename}"`,
                'X-Filename': result.filename,
               'Cache-Control': 'public, max-age=31536000'

            });
            return res.send(result.fileBuffer);
        }
        return res.status(404).json({ error: result.message });
    }

    async saveCowImage(req, res) {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        return this.executeFileOperation(req, res, 'saveCowImage', (req) => ({
            cowTag: req.params.tag,
            imageType: req.body.imageType,
            fileBuffer: req.file.buffer,
            originalFilename: req.file.originalname
        }));
    }

    async getAllCowImages(req, res) {
        return this.executeFileOperation(req, res, 'getAllCowImages', (req) => ({
            cowTag: req.params.tag
        }));
    }

    async getCowImageCount(req, res) {
        return this.executeFileOperation(req, res, 'numCowImages', (req) => ({
            cowTag: req.params.tag
        }));
    }

    async deleteCowImage(req, res) {
        return this.executeFileOperation(req, res, 'deleteCowImage', (req) => ({
            cowTag: req.params.tag,
            filename: req.params.filename
        }));
    }





    // Binary response — cannot use executeFileOperation
    async getMedicalImage(req, res) {
        const result = await localFileOps.getMedicalImage({
            recordId: parseInt(req.params.recordId),
            n: parseInt(req.params.n) || 1,
        });

        if (result.success) {
            res.set({
                'Content-Type': result.mimeType,
                'Content-Length': result.size,
                'Last-Modified': result.modified.toUTCString(),
                'Cache-Control': 'public, max-age=31536000',
                'X-Filename': result.filename
            });
            return res.send(result.fileBuffer);
        }
        return res.status(404).json({ error: result.message });
    }

    async uploadMedicalImage(req, res) {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        return this.executeFileOperation(req, res, 'saveMedicalImage', (req) => ({
            recordId: parseInt(req.params.recordId),
            fileBuffer: req.file.buffer,
            originalFilename: req.file.originalname
        }));
    }

    async getMedicalImageCount(req, res) {
        return this.executeFileOperation(req, res, 'getMedicalImageCount', (req) => ({
            recordId: parseInt(req.params.recordId)
        }));
    }

    async deleteMedicalImage(req, res) {
        return this.executeFileOperation(req, res, 'deleteMedicalImage', (req) => ({
            recordId: parseInt(req.params.recordId),
            filename: req.params.filename
        }));
    }






    async saveMedicalUpload(req, res) {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        return this.executeFileOperation(req, res, 'saveMedicalUpload', (req) => ({
            recordId: parseInt(req.params.recordId),
            fileBuffer: req.file.buffer,
            filename: req.file.originalname
        }));
    }

    // Binary response — cannot use executeFileOperation
    async getMedicalUpload(req, res) {
        const result = await localFileOps.getMedicalUpload({
            recordId: parseInt(req.params.recordId),
            filename: req.params.filename
        });

        if (result.success) {
            res.set({
                'Content-Type': result.mimeType,
                'Content-Length': result.size,
                'Last-Modified': result.modified.toUTCString(),
                'Content-Disposition': `inline; filename="${result.filename}"`
            });
            return res.send(result.fileBuffer);
        }
        return res.status(404).json({ error: result.message });
    }

    async deleteMedicalUpload(req, res) {
        return this.executeFileOperation(req, res, 'deleteMedicalUpload', (req) => ({
            recordId: parseInt(req.params.recordId),
            filename: req.params.filename
        }));
    }

    async listMedicalUploads(req, res) {
        return this.executeFileOperation(req, res, 'listMedicalUploads', (req) => ({
            recordId: parseInt(req.params.recordId)
        }));
    }


    async getMap(req, res) {
        return this.executeFileOperation(req, res, 'getMap', (req) => ({
            pastureName: req.query.pasture
        }));
    }

    // Binary response — cannot use executeFileOperation
    async getMapImage(req, res) {
        const { image } = req.query;
        const allowedTypes = ['map', 'MapCombined'];

        if (!allowedTypes.includes(image)) {
            return res.status(400).json({ error: 'Invalid map type' });
        }

        const result = await localFileOps.getMapImage(image);

        if (result.success) {
            res.set({
                'Content-Type': result.mimeType,
                'Content-Length': result.size,
                'Content-Disposition': `inline; filename="${result.filename}"`
            });
            return res.send(result.fileBuffer);
        }
        return res.status(404).json({ error: result.message });
    }

    async uploadMap(req, res) {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        return this.executeFileOperation(req, res, 'uploadMap', (req) => ({
            mapType: req.body.mapType,
            fileBuffer: req.file.buffer,
            filename: req.file.originalname
        }));
    }

    // Binary response — cannot use executeFileOperation
    async getMinimap(req, res) {
        const result = await localFileOps.getMinimap({
            fieldName: decodeURIComponent(req.params.fieldName)
        });

        if (result.success) {
            res.set({
                'Content-Type': result.mimeType,
                'Content-Length': result.size,
                'Content-Disposition': `inline; filename="${result.filename}"`
            });
            return res.send(result.fileBuffer);
        }
        return res.status(404).json({
            error: result.message,
            availableFields: result.availableFields
        });
    }

    async uploadMinimap(req, res) {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        return this.executeFileOperation(req, res, 'uploadMinimap', (req) => ({
            fieldName: req.params.fieldName,
            fileBuffer: req.file.buffer,
            filename: req.file.originalname
        }));
    }


    async getAvailableMinimaps(req, res) {
        try {
            const availableFields = await localFileOps.getAvailableMinimaps();
            return res.status(200).json({
                success: true,
                fields: availableFields,
                count: availableFields.length
            });
        } catch (error) {
            console.error('Available minimaps error:', error);
            return res.status(500).json({ error: error.message });
        }
    }































    async getUserEmail(req, res) {
        try {
            const email = getUserEmail(req);

            if (!email) {
                return res.status(401).json({
                    success: false,
                    message: 'No authenticated email found'
                });
            }

            return res.json({ success: true, email });
        } catch (error) {
            console.error('Error getting user email:', error);
            return res.status(500).json({ success: false, error: 'Failed to get user email' });
        }
    }
    
    async getAllUsers(req, res) {
        return this.executeDBOperation(req, res, 'getAllUsers', () => ({}));
    }

    async resetUserPassword(req, res) {
        return this.executeDBOperation(req, res, 'resetUserPassword', (req) => ({
            email: req.body.email
        }));
    }

    async updateUserPermissions(req, res) {
        const { permissions } = req.body;
        const validPermissions = ['view', 'add', 'admin', 'dev'];
        const invalidPerms = permissions.filter(p => !validPermissions.includes(p));

        if (invalidPerms.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid permissions: ${invalidPerms.join(', ')}`
            });
        }

        return this.executeDBOperation(req, res, 'updateUserPermissions', (req) => ({
            email: req.body.email,
            permissions: req.body.permissions
        }));
    }

    async preRegisterUser(req, res) {
        const { permissions } = req.body;
        const validPermissions = ['view', 'add', 'admin', 'dev'];
        const invalidPerms = permissions.filter(p => !validPermissions.includes(p));

        if (invalidPerms.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid permissions: ${invalidPerms.join(', ')}`
            });
        }

        return this.executeDBOperation(req, res, 'preRegisterUser', (req) => ({
            email: req.body.email,
            permissions: req.body.permissions
        }));
    }

    async blockUser(req, res) {
        return this.executeDBOperation(req, res, 'blockUser', (req) => ({
            email: req.body.email
        }));
    }

    async unblockUser(req, res) {
        return this.executeDBOperation(req, res, 'unblockUser', (req) => ({
            email: req.body.email
        }));
    }

    async deleteUser(req, res) {
        return this.executeDBOperation(req, res, 'deleteUser', (req) => ({
            email: req.body.email
        }));
    }






























    /**
     * Get backend log - Dev only
     */
    async getBackendLog(req, res) {
        try {
            // Dev check is done by middleware
            const result = await localFileOps.getBackendLog();
            
            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error getting backend log:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get backend log'
            });
        }
    }

    /**
     * Get frontend log - Dev only
     */
    async getFrontendLog(req, res) {
        try {
            // Dev check is done by middleware
            const result = await localFileOps.getFrontendLog();
            
            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error getting frontend log:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get frontend log'
            });
        }
    }

    /**
     * Clear backend log - Dev only
     */
    async clearBackendLog(req, res) {
        try {
            // Dev check is done by middleware
            const result = await localFileOps.clearBackendLog();
            
            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error clearing backend log:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to clear backend log'
            });
        }
    }

    /**
     * Clear frontend log - Dev only
     */
    async clearFrontendLog(req, res) {
        try {
            // Dev check is done by middleware
            const result = await localFileOps.clearFrontendLog();
            
            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error clearing frontend log:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to clear frontend log'
            });
        }
    }

    /**
     * Execute console command - Validation in local.js
     */
    async executeConsoleCommand(req, res) {
        try {
            const userPermissions = req.session.user?.permissions || [];
            const { command } = req.body;
            
            const result = await localFileOps.executeConsoleCommand({
                command,
                userPermissions
            });
            
            if (result.success) {
                return res.status(200).json(result);
            }
            
            // Map error codes to HTTP status codes
            const statusCode = result.code === 'FORBIDDEN' ? 403 :
                            result.code === 'BAD_REQUEST' ? 400 : 500;
            
            return res.status(statusCode).json(result);
            
        } catch (error) {
            console.error('Error executing console command:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to execute command'
            });
        }
    }

    /**
     * Connect to SQL Server - Validation in local.js
     */
    async connectSqlServer(req, res) {
        try {
            const userPermissions = req.session.user?.permissions || [];
            const { username, password } = req.body;
            
            const result = await localFileOps.connectSqlServer({
                username,
                password,
                userPermissions
            });
            
            if (result.success) {
                return res.status(200).json(result);
            }
            
            const statusCode = result.code === 'FORBIDDEN' ? 403 :
                            result.code === 'BAD_REQUEST' ? 400 : 500;
            
            return res.status(statusCode).json(result);
            
        } catch (error) {
            console.error('Error connecting to SQL:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to connect to SQL server'
            });
        }
    }

    /**
     * Execute SQL query - Validation in local.js
     */
    async executeSqlQuery(req, res) {
        try {
            const userPermissions = req.session.user?.permissions || [];
            const { username, password, query } = req.body;
            
            const result = await localFileOps.executeSqlQuery({
                username,
                password,
                query,
                userPermissions
            });
            
            if (result.success) {
                return res.status(200).json(result);
            }
            
            const statusCode = result.code === 'FORBIDDEN' ? 403 :
                            result.code === 'BAD_REQUEST' ? 400 : 500;
            
            return res.status(statusCode).json(result);
            
        } catch (error) {
            console.error('Error executing SQL query:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to execute SQL query'
            });
        }
    }

    /**
     * Backup SQL database - Dev only, validation in local.js
     */
    async backupSqlDatabase(req, res) {
        try {
            const userPermissions = req.session.user?.permissions || [];
            
            const result = await localFileOps.backupSqlDatabase({
                userPermissions
            });
            
            if (result.success) {
                return res.status(200).json(result);
            }
            
            const statusCode = result.code === 'FORBIDDEN' ? 403 :
                            result.code === 'NO_CONNECTION' ? 503 :
                            result.code === 'BAD_REQUEST' ? 400 : 500;
            
            return res.status(statusCode).json(result);
            
        } catch (error) {
            console.error('Error backing up database:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to backup database'
            });
        }
    }

    /**
     * Backup and download SQL database - Dev only, validation in local.js
     */
    async getSqlDatabase(req, res) {
        try {
            const userPermissions = req.session.user?.permissions || [];
            
            const result = await localFileOps.getSqlDatabase({
                userPermissions
            });
            
            if (result.success) {
                // Send the file as a download
                const fileBuffer = Buffer.from(result.fileData, 'base64');
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
                res.setHeader('Content-Length', result.fileSize);
                return res.send(fileBuffer);
            }
            
            const statusCode = result.code === 'FORBIDDEN' ? 403 :
                            result.code === 'NO_CONNECTION' ? 503 :
                            result.code === 'BAD_REQUEST' ? 400 : 500;
            
            return res.status(statusCode).json(result);
            
        } catch (error) {
            console.error('Error getting database backup:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get database backup'
            });
        }
    }

    /**
     * Close dev SQL connection - Dev only, validation in local.js
     */
    async closeDevSqlConnection(req, res) {
        try {
            const userPermissions = req.session.user?.permissions || [];
            
            const result = await localFileOps.closeDevSqlConnection({
                userPermissions
            });
            
            if (result.success) {
                return res.status(200).json(result);
            }
            
            const statusCode = result.code === 'FORBIDDEN' ? 403 : 500;
            
            return res.status(statusCode).json(result);
            
        } catch (error) {
            console.error('Error closing dev connection:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to close dev connection'
            });
        }
    }
}

// Export singleton instance
module.exports = new APIWrapper();