const { validationResult } = require('express-validator');
const { getUserEmail } = require('../backend/accessControl');
const dbOperations = require('./dbOperations');
const localFileOps = require('./local');
const path = require('path');

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


    async executeBatchDBOperation(req, res, operation, itemExtractor) {
        try {
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            if (!dbOperations[operation]) {
                throw new Error(`Operation '${operation}' not found in dbOperations`);
            }

            const items = itemExtractor(req);

            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Request body must be a non-empty array'
                });
            }

            const result = await dbOperations[operation](items);

            return res.status(200).json(result);

        } catch (error) {
            console.error(`API Batch Error in ${operation}:`, error);
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
                const countResult = await localFileOps.getImageCount({
                    domain: 'minimap',
                    recordId: cowData.PastureName,
                });
                if (countResult.success && countResult.total > 0) {
                    minimap = {
                        pastureName: cowData.PastureName,
                        path: `/api/images/minimap/${encodeURIComponent(cowData.PastureName)}/photo/1`
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







    async getNotes(req, res) {
        return this.executeDBOperation(req, res, 'getNotes', (req) => ({
            entityType: req.params.entityType,
            entityId: req.params.entityId
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
            fields: req.body
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
     * Get breeding plans
     */
    async getBreedingPlans(req, res) {
        return this.executeDBOperation(req, res, 'getBreedingPlans', (req) => ({}));
    }

    /**
     * Get breeding plan overview
     */
    async getBreedingOverview(req, res) {
        return this.executeDBOperation(req, res, 'getBreedingOverview', (req) => {
            const planId = parseInt(req.params.planId, 10);
            if (isNaN(planId)) {
                throw new Error(`Invalid planId: '${req.params.planId}' could not be converted to integer`);
            }
            return { planId };
        });
    }


    async getBreedingPlan(req, res) {
        return this.executeDBOperation(req, res, 'getBreedingPlan', (req) => {
            const planId = parseInt(req.params.planId, 10);
            if (isNaN(planId)) {
                throw new Error(`Invalid planId: '${req.params.planId}' could not be converted to integer`);
            }
            return { planId };
        });
    }

    async createBreedingPlan(req, res) {
        return this.executeDBOperation(req, res, 'createBreedingPlan', (req) => ({
            planName:  req.body.planName         ?? null,
            planYear:  req.body.planYear         ?? null,
            notes:     req.body.notes            ?? null,
            isActive:  req.body.isActive         ?? true,
        }));
    }

    async updateBreedingPlan(req, res) {
        return this.executeDBOperation(req, res, 'updateBreedingPlan', (req) => {
            const planId = parseInt(req.params.planId, 10);
            if (isNaN(planId)) {
                throw new Error(`Invalid planId: '${req.params.planId}' could not be converted to integer`);
            }
            return {
                planId,
                fields: req.body
            };
        });
    }

    async deleteBreedingPlan(req, res) {
        return this.executeDBOperation(req, res, 'deleteBreedingPlan', (req) => {
            const planId = parseInt(req.params.planId, 10);
            if (isNaN(planId)) {
                throw new Error(`Invalid planId: '${req.params.planId}' could not be converted to integer`);
            }
            return { planId };
        });
    }



    /**
     * Get animals for breeding assignment
     */
    async getBulls(req, res) {
        return this.executeDBOperation(req, res, 'getBulls', (req) => ({}));
    }


    async getUnweanedCalves(req, res) {
        return this.executeDBOperation(req, res, 'getUnweanedCalves', (req) => {
            const planId = req.query.planId ? parseInt(req.query.planId) : null;
            return { planId };
        });
    }





    // Breeding Records
    async getBreedingRecord(req, res) {
        return this.executeDBOperation(req, res, 'getBreedingRecord', (req) => ({
            recordId: parseInt(req.params.recordId)
        }));
    }

    async getBreedingRecords(req, res) {
        return this.executeDBOperation(req, res, 'getBreedingRecords', (req) => {
            const planId          = req.query.planId          ? parseInt(req.query.planId)    : null;
            const cowTag          = req.query.cowTag          || null;
            const breedingStatus  = req.query.breedingStatus  || null;
            const newestOnly      = req.query.newestOnly === 'true';
    
            if (!planId && !cowTag && !breedingStatus) {
                throw new Error('At least one filter (planId, cowTag, or breedingStatus) is required');
            }
    
            return { planId, cowTag, breedingStatus, newestOnly };
        });
    }

    /**
     * Create one or more breeding records
     */
    async createBreedingRecord(req, res) {
        return this.executeDBOperation(req, res, 'createBreedingRecord', (req) => {
            if (Array.isArray(req.body)) return req.body;
            return {
                planID:            req.body.planID            ?? null,
                cowTag:            req.body.cowTag            ?? null,
                primaryBulls:      req.body.primaryBulls      ?? [],
                cleanupBulls:      req.body.cleanupBulls      ?? [],
                isAI:              req.body.isAI              ?? false,
                exposureStartDate: req.body.exposureStartDate ?? null,
                exposureEndDate:   req.body.exposureEndDate   ?? null,
                pasture:           req.body.pasture           ?? null,
                breedingStatus:    req.body.breedingStatus ?? null,
            };
        });
    }


    async updateBreedingRecord(req, res) {
        return this.executeDBOperation(req, res, 'updateBreedingRecord', (req) => ({
            recordId: parseInt(req.params.recordId),
            fields: req.body
        }));
    }

    async deleteBreedingRecord(req, res) {
        return this.executeDBOperation(req, res, 'deleteBreedingRecord', (req) => ({
            recordId: parseInt(req.params.recordId)
        }));
    }

    async refreshBreedingStatuses(req, res) {
        return this.executeDBOperation(req, res, 'refreshBreedingStatuses', (req) => ({
            planId: req.body.planId ? parseInt(req.body.planId) : null,
            dryRun: req.body.dryRun === true,
        }));
    }






    // Pregnancy Check

    /**
     * Submit pregnancy check results
     */
    async createPregancyCheck(req, res) {
        return this.executeDBOperation(req, res, 'createPregancyCheck', (req) => {
            if (Array.isArray(req.body)) return req.body;
            return {
                cowTag:           req.body.cowTag           ?? null,
                planID:           req.body.planID           ?? null,
                breedingRecordID: req.body.breedingRecordID ?? null,
                pregCheckDate:    req.body.pregCheckDate    ?? null,
                fetusSex:         req.body.fetusSex         ?? null,
                monthsPregnant:   req.body.monthsPregnant   ?? null,
                notes:            req.body.notes            ?? null,
                testResults:      req.body.testResults      ?? null,
                testType:         req.body.testType         ?? null,
            };
        });
    }

    async getPregancyChecks(req, res) {
        return this.executeDBOperation(req, res, 'getPregancyChecks', (req) => {
            const planId = req.query.planId ? parseInt(req.query.planId) : null;
            const cowTag = req.query.cowTag || null;
            const breedingRecordId = req.query.breedingRecordId ? parseInt(req.query.breedingRecordId) : null;
            const testResults = req.query.testResults || null;

            if (!planId && !cowTag && !breedingRecordId && !testResults) {
                throw new Error('At least one filter (planId, cowTag, breedingRecordId, or testResults) is required');
            }

            return { planId, cowTag, breedingRecordId, testResults};
        });
    }

    async getPregancyCheck(req, res) {
        return this.executeDBOperation(req, res, 'getPregancyCheck', (req) => ({
            recordId: parseInt(req.params.recordId)
        }));
    }

    async getUnlinkedPregancyChecks(req, res) {
        return this.executeDBOperation(req, res, 'getUnlinkedPregancyChecks', () => ({}));
    }



    async updatePregancyCheck(req, res) {
        return this.executeDBOperation(req, res, 'updatePregancyCheck', (req) => ({
            recordId: parseInt(req.params.recordId),
            fields: req.body
        }));
    }

    async deletePregancyCheck(req, res) {
        return this.executeDBOperation(req, res, 'deletePregancyCheck', (req) => ({
            recordId: parseInt(req.params.recordId)
        }));
    }






    

    /**
     * Get calving status for herd
     */
    // async getCalvingStatus(req, res) {
    //     return this.executeDBOperation(req, res, 'getCalvingStatus', (req) => ({
    //         herdName: req.params.herdName
    //     }));
    // }

    async getCalvingRecords(req, res) {
        return this.executeDBOperation(req, res, 'getCalvingRecords', (req) => {
            const planId           = req.query.planId           ? parseInt(req.query.planId)           : null;
            const damTag           = req.query.damTag           || null;
            const breedingRecordId = req.query.breedingRecordId ? parseInt(req.query.breedingRecordId) : null;

            if (!planId && !damTag && !breedingRecordId) {
                throw new Error('At least one filter (planId, damTag, or breedingRecordId) is required');
            }

            return { planId, damTag, breedingRecordId };
        });
    }

    /**
     * Create one or more calving records
     */
    async createCalvingRecord(req, res) {
        return this.executeDBOperation(req, res, 'createCalvingRecord', (req) => {
            if (Array.isArray(req.body)) return req.body;
            return {
                planID:           req.body.planID           ?? null,
                breedingRecordId: req.body.breedingRecordId ?? null,
                isTagged:         req.body.isTagged         ?? false,
                calfTag:          req.body.calfTag          ?? null,
                damTag:           req.body.damTag           ?? null,
                birthDate:        req.body.birthDate        ?? null,
                calfSex:          req.body.calfSex          ?? null,
                notes:            req.body.notes            ?? null,
                calfDiedAtBirth:  req.body.calfDiedAtBirth  ?? false,
                embryoAborted:    req.body.embryoAborted    ?? false,
                damDiedAtBirth:   req.body.damDiedAtBirth   ?? false,
            };
        });
    }

    /**
     * Get calving record by ID
     */
    async getCalvingRecord(req, res) {
        return this.executeDBOperation(req, res, 'getCalvingRecord', (req) => ({
            id: parseInt(req.params.id)
        }));
    }

    async getUnlinkedCalvingRecords(req, res) {
        return this.executeDBOperation(req, res, 'getUnlinkedCalvingRecords', () => ({}));
    }

    /**
     * Update calving record by ID
     */
    async updateCalvingRecord(req, res) {
        return this.executeDBOperation(req, res, 'updateCalvingRecord', (req) => ({
            id: parseInt(req.params.id),
            updates: req.body
        }));
    }

    /**
     * Delete calving record by ID
     */
    async deleteCalvingRecord(req, res) {
        return this.executeDBOperation(req, res, 'deleteCalvingRecord', (req) => ({
            id: parseInt(req.params.id)
        }));
    }








    // API Wrapper Functions
    async getWeaningRecords(req, res) {
        return this.executeDBOperation(req, res, 'getWeaningRecords', (req) => {
            const planId          = req.query.planId          ? parseInt(req.query.planId)          : null;
            const cowTag          = req.query.cowTag          || null;
            const calvingRecordId = req.query.calvingRecordId ? parseInt(req.query.calvingRecordId) : null;

            if (!planId && !cowTag && !calvingRecordId) {
                throw new Error('At least one filter (planId, cowTag, or calvingRecordId) is required');
            }

            return { planId, cowTag, calvingRecordId };
        });
    }

    async createWeaningRecord(req, res) {
        return this.executeDBOperation(req, res, 'createWeaningRecord', (req) => {
            if (Array.isArray(req.body)) return req.body;
            return {
                planId:          req.body.planId          ?? null,
                cowTag:          req.body.cowTag          ?? null,
                weaningDate:     req.body.weaningDate     ?? null,
                weaningWeight:   req.body.weaningWeight   ?? null,
                notes:           req.body.notes           ?? null,
                calvingRecordId: req.body.calvingRecordId ?? null,
            };
        });
    }

    async getWeaningRecord(req, res) {
        return this.executeDBOperation(req, res, 'getWeaningRecord', (req) => ({
            id: parseInt(req.params.id)
        }));
    }

    async updateWeaningRecord(req, res) {
        return this.executeDBOperation(req, res, 'updateWeaningRecord', (req) => ({
            id: parseInt(req.params.id),
            updates: req.body
        }));
    }

    async deleteWeaningRecord(req, res) {
        return this.executeDBOperation(req, res, 'deleteWeaningRecord', (req) => ({
            id: parseInt(req.params.id)
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


    async addCow(req, res) {
        try {
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({ error: 'Validation failed', details: validationErrors.array() });
            }

            const cowData = {
                cowTag:          req.body.cowTag,
                dateOfBirth:     req.body.dateOfBirth,
                description:     req.body.description,
                dam:             req.body.dam,
                sire:            req.body.sire,
                sex:             req.body.sex,
                castrated:       req.body.castrated,
                status:          req.body.status,
                currentHerd:     req.body.currentHerd,
                breed:           req.body.breed,
                temperament:     req.body.temperament,
                regCert:         req.body.regCert,
                regCertNumber:   req.body.regCertNumber,
                birthweight:     req.body.birthweight,
                targetPrice:     req.body.targetPrice,
            };

            // Calving record data extracted from payload
            const calvingRecordID   = req.body.calvingRecordID || null;
            const calfDiedAtBirth   = req.body.calfDiedAtBirth === true;
            const damDiedAtBirth    = req.body.damDiedAtBirth === true;
            const calvingNotes      = req.body.calvingNotes || null;
            const isTagged          = !!cowData.cowTag;

            // Add the cow
            const cowResult = await dbOperations.addCow(cowData);

            try {
                if (calvingRecordID) {
                    // Update existing calving record if it already exists
                    await dbOperations.updateCalvingRecord({
                        id: calvingRecordID,
                        updates: {
                            IsTagged:        isTagged,
                            CalfTag:         cowData.cowTag,
                            DamTag:          cowData.dam,
                            BirthDate:       cowData.dateOfBirth,
                            CalfSex:         cowData.sex,
                            CalfDiedAtBirth: calfDiedAtBirth,
                            DamDiedAtBirth:  damDiedAtBirth,
                            CalvingNotes:    calvingNotes,
                        }
                    });

                    return res.status(200).json({
                        ...cowResult,
                        calvingRecordCreated: false,
                        calvingRecordUpdated: true,
                        message: 'Cow added and calving record updated successfully'
                    });

                } else if (cowData.dam) {
                    // Otherwise create a new calving record, find the breeding record for the dam first
                    const breedingRecordId = await dbOperations.getClosestDamBreedingRecord(cowData.dam, cowData.dateOfBirth);

                    if (breedingRecordId) {
                        await dbOperations.createCalvingRecord({
                            breedingRecordId,
                            isTagged,
                            calfTag:         cowData.cowTag,
                            damTag:          cowData.dam,
                            birthDate:       cowData.dateOfBirth,
                            calfSex:         cowData.sex,
                            calfDiedAtBirth,
                            damDiedAtBirth,
                            notes:           calvingNotes,
                            twins:           req.body.twins || false,
                        });

                        return res.status(200).json({
                            ...cowResult,
                            calvingRecordCreated: true,
                            message: 'Cow and calving record created successfully'
                        });
                    } else {
                        return res.status(200).json({
                            ...cowResult,
                            calvingRecordCreated: false,
                            warning: `Cow created but no breeding record found for dam '${cowData.dam}'`
                        });
                    }
                }
            } catch (calvingError) {
                console.error('Error handling calving record:', calvingError);
                return res.status(200).json({
                    ...cowResult,
                    calvingRecordCreated: false,
                    warning: `Cow created but calving record failed: ${calvingError.message}`
                });
            }

            return res.status(200).json(cowResult);

        } catch (error) {
            console.error('API Error in addCow:', error);
            return res.status(500).json({ success: false, error: 'Internal server error', operation: 'addCow' });
        }
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

    
    async getHerdAnimals(req, res) {
        return this.executeDBOperation(req, res, 'getHerdAnimals', (req) => ({
            herdName: req.params.herdName,
            getInactive: req.query.getInactive === 'true',
            cattleOnly: req.query.cattleOnly === 'true'
        }));
    }

    /**
    * Only the herd names
    */
    async getHerds(req, res) {
        return this.executeDBOperation(req, res, 'getHerds', (req) => ({}));
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

    async createHerd(req, res) {
        return this.executeDBOperation(req, res, 'createHerd', (req) => ({
            herdName: req.body.herdName,
            cows: req.body.cows || [],
            currentPasture: req.body.currentPasture || null
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
            templateId:        parseInt(req.params.templateId),
            herdName:          req.body.herdName,
            primaryRecordDate: req.body.primaryRecordDate || null,
            createdBy:         req.session?.user?.username || 'Unknown',
            instanceName:      req.body.instanceName || '',
            defaults:          req.body.defaults || {},
            animals:           req.body.animals || null,
        }));
    }

    async tryLoadSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'tryLoadSheetInstance', (req) => ({
            instanceId:   req.body.instanceId || null,
            templateId:   req.body.templateId,
            herdName:     req.body.herdName,
            primaryRecordDate: req.body.primaryRecordDate || null,
            createdBy:    req.session?.user?.username || 'Unknown'
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
































    /**
     * Get map data 
     */
    async getMap(req, res) {
        return this.executeFileOperation(req, res, 'getMap', (req) => ({
            pastureName: req.query.pasture || null,
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













































    // Equipment /////////////////////
    async getEquipmentRecords(req, res) {
        return this.executeDBOperation(req, res, 'getEquipmentRecords', (req) => ({
            status: req.query.status || null,
        }));
    }

    async getEquipmentRecord(req, res) {
        return this.executeDBOperation(req, res, 'getEquipmentRecord', (req) => ({
            id: parseInt(req.params.id),
        }));
    }

    async createEquipment(req, res) {
        return this.executeDBOperation(req, res, 'createEquipment', (req) => ({
            name:               req.body.name               || null,
            description:        req.body.description        || null,
            pastureName:        req.body.pastureName        || null,
            locationID:         req.body.locationID         ? parseInt(req.body.locationID) : null,
            isVehicle:          req.body.isVehicle          ?? false,
            equipmentStatus:    req.body.equipmentStatus    || null,
            equipmentType:      req.body.equipmentType      || null,
            make:               req.body.make               || null,
            model:              req.body.model              || null,
            year:               req.body.year               ? parseInt(req.body.year) : null,
            serialNumber:       req.body.serialNumber       || null,
            registration:       req.body.registration       || null,
            registrationExpiry: req.body.registrationExpiry || null,
            grossWeightRating:  req.body.grossWeightRating  || null,
            warrantyExpiry:     req.body.warrantyExpiry     || null,
            warrantyNotes:      req.body.warrantyNotes      || null,
            notes:              req.body.notes              || null,
            purchaseRecordID:   req.body.purchaseRecordID   ? parseInt(req.body.purchaseRecordID) : null,
            saleRecordID:       req.body.saleRecordID       ? parseInt(req.body.saleRecordID)     : null,
        }));
    }

    async updateEquipment(req, res) {
        return this.executeDBOperation(req, res, 'updateEquipment', (req) => ({
            id:      parseInt(req.params.id),
            updates: req.body,
        }));
    }

    async deleteEquipment(req, res) {
        return this.executeDBOperation(req, res, 'deleteEquipment', (req) => ({
            id: parseInt(req.params.id),
        }));
    }

    async getEquipmentMaintenanceRecords(req, res) {
        return this.executeDBOperation(req, res, 'getEquipmentMaintenanceRecords', (req) => {
            if (!req.query.equipmentId) throw new Error('equipmentId query parameter is required');
            return { equipmentId: parseInt(req.query.equipmentId) };
        });
    }

    async getEquipmentMaintenanceRecord(req, res) {
        return this.executeDBOperation(req, res, 'getEquipmentMaintenanceRecord', (req) => ({
            id: parseInt(req.params.id),
        }));
    }

    async createEquipmentMaintenanceRecord(req, res) {
        return this.executeDBOperation(req, res, 'createEquipmentMaintenanceRecord', (req) => ({
            equipmentID:           req.body.equipmentID           ? parseInt(req.body.equipmentID) : null,
            dateRecorded:          req.body.dateRecorded          || null,
            recordedByUsername:    req.body.recordedByUsername    || null,
            datePerformed:         req.body.datePerformed         || null,
            performedByUsername:   req.body.performedByUsername   || null,
            title:                 req.body.title                 || null,
            description:           req.body.description           || null,
            serviceType:           req.body.serviceType           || null,
            meterReadingAtService: req.body.meterReadingAtService != null ? parseFloat(req.body.meterReadingAtService) : null,
            meterUnit:             req.body.meterUnit             || null,
            nextServiceDue:        req.body.nextServiceDue        != null ? parseFloat(req.body.nextServiceDue)        : null,
            nextServiceUnits:      req.body.nextServiceUnits      || null,
        }));
    }

    async updateEquipmentMaintenanceRecord(req, res) {
        return this.executeDBOperation(req, res, 'updateEquipmentMaintenanceRecord', (req) => ({
            id:      parseInt(req.params.id),
            updates: req.body,
        }));
    }

    async deleteEquipmentMaintenanceRecord(req, res) {
        return this.executeDBOperation(req, res, 'deleteEquipmentMaintenanceRecord', (req) => ({
            id: parseInt(req.params.id),
        }));
    }

    async getEquipmentParts(req, res) {
        return this.executeDBOperation(req, res, 'getEquipmentParts', (req) => {
            if (!req.query.equipmentId) throw new Error('equipmentId query parameter is required');
            return { equipmentId: parseInt(req.query.equipmentId) };
        });
    }

    async getEquipmentPart(req, res) {
        return this.executeDBOperation(req, res, 'getEquipmentPart', (req) => ({
            id: parseInt(req.params.id),
        }));
    }

    async createEquipmentPart(req, res) {
        return this.executeDBOperation(req, res, 'createEquipmentPart', (req) => ({
            equipmentID:  req.body.equipmentID ? parseInt(req.body.equipmentID) : null,
            partType:     req.body.partType     || null,
            partNumber:   req.body.partNumber   || null,
            manufacturer: req.body.manufacturer || null,
            notes:        req.body.notes        || null,
            visible:      req.body.visible      ?? true,
        }));
    }

    async updateEquipmentPart(req, res) {
        return this.executeDBOperation(req, res, 'updateEquipmentPart', (req) => ({
            id:      parseInt(req.params.id),
            updates: req.body,
        }));
    }

    async deleteEquipmentPart(req, res) {
        return this.executeDBOperation(req, res, 'deleteEquipmentPart', (req) => ({
            id: parseInt(req.params.id),
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



































    // Generic file upload/download operations

    async uploadFile(req, res) {
        if (!req.file) return res.status(400).json({ error: 'No file provided' });
        return this.executeFileOperation(req, res, 'saveFile', (req) => ({
            domain: req.params.domain,
            recordId: req.params.recordId,
            filename: req.file.originalname,
            fileBuffer: req.file.buffer,
        }));
    }

    // Binary — cannot use executeFileOperation
    async getFile(req, res) {
        try {
            const result = await localFileOps.getFile({
                domain: req.params.domain,
                recordId: req.params.recordId,
                filename: req.params.filename,
            });
            if (result.success) {
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.size,
                    'Last-Modified': result.modified.toUTCString(),
                    'Content-Disposition': `inline; filename="${result.filename}"`,
                });
                return res.send(result.fileBuffer);
            }
            return res.status(404).json({ error: result.message });
        } catch (err) {
            console.error('getFile error:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    async deleteDomainFile(req, res) {
        return this.executeFileOperation(req, res, 'deleteDomainFile', (req) => ({
            domain: req.params.domain,
            recordId: req.params.recordId,
            filename: req.params.filename,
        }));
    }

    async listDomainFiles(req, res) {
        return this.executeFileOperation(req, res, 'listDomainFiles', (req) => ({
            domain: req.params.domain,
            recordId: req.params.recordId,
        }));
    }















    // NEW IMAGE ROUTES
    async uploadImage(req, res) {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });

        return this.executeFileOperation(req, res, 'saveImage', (req) => ({
            domain: req.params.domain,
            recordId: req.params.recordId,
            filter: req.query.filter,
            fileBuffer: req.file.buffer,
            originalFilename: req.file.originalname,
            failIfExists: req.params.domain === 'map' || req.params.domain === 'minimap',
        }));
    }


    async getImageCount(req, res) {
        return this.executeFileOperation(req, res, 'getImageCount', (req) => ({
            domain: req.params.domain,
            recordId: req.params.recordId,
            filter: req.query.filter,
        }));
    }

    async deleteImage(req, res) {
        return this.executeFileOperation(req, res, 'deleteImage', (req) => ({
            domain: req.params.domain,
            recordId: req.params.recordId,
            filename: req.params.filename,
        }));
    }

    async listImages(req, res) {
        return this.executeFileOperation(req, res, 'listImages', (req) => ({
            domain: req.params.domain,
            recordId: req.params.recordId,
            filter: req.query.filter,
        }));
    }

    // Binary — cannot use executeFileOperation
    async getImage(req, res) {
        try {
            const result = await localFileOps.getImage({
                domain: req.params.domain,
                recordId: req.params.recordId,
                filter: req.query.filter,
                n: parseInt(req.params.n) || 1,
            });
            if (result.success) {
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.size,
                    'Last-Modified': result.modified.toUTCString(),
                    'Cache-Control': 'public, max-age=31536000',
                    'X-Filename': result.filename,
                });
                return res.send(result.fileBuffer);
            }
            return res.status(404).json({ error: result.message });
        } catch (err) {
            console.error('getImage error:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // Binary — cannot use executeFileOperation
    async getImageByName(req, res) {
        try {
            const result = await localFileOps.getImageByName({
                domain: req.params.domain,
                recordId: req.params.recordId,
                filename: req.params.filename,
            });
            if (result.success) {
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.size,
                    'Last-Modified': result.modified.toUTCString(),
                    'Cache-Control': 'public, max-age=31536000',
                    'X-Filename': result.filename,
                });
                return res.send(result.fileBuffer);
            }
            return res.status(404).json({ error: result.message });
        } catch (err) {
            console.error('getImageByName error:', err);
            return res.status(500).json({ error: err.message });
        }
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
            const result = await localFileOps.getSqlDatabase({ userPermissions });

            if (result.success) {
                // Streams the file directly w no buffering
                return res.download(result.filePath, result.fileName);
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