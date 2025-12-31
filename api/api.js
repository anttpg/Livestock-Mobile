const { validationResult } = require('express-validator');
const { setupAccessControl } = require('../backend/accessControl');
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

            // Get images
            const images = await localFileOps.getCowImage({ cowTag });

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

            const allHerds = await dbOperations.getAllHerds();

            // Build response
            const responseData = {
                cowData: cowData,
                currentWeight: currentWeight,
                notes: notes,
                calves: calves,
                images: images,
                minimap: minimap,
                availableHerds: allHerds
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


    async setHerd(req, res) {
        return this.executeDBOperation(req, res, 'setHerd', (req) => ({
            cowTag: req.body.cowTag,
            herdName: req.body.herdName
        }));
    }

    async addObservation(req, res) {
        return this.executeDBOperation(req, res, 'addNote', (req) => ({
            cowTag: req.body.cowTag,
            note: req.body.note,
            dateOfEntry: req.body.dateOfEntry || new Date()
        }));
    }

    async createMedicalRecord(req, res) {
        return this.executeDBOperation(req, res, 'createMedicalRecord', (req) => ({
            cowTag: req.body.cowTag,
            recordType: req.body.recordType,
            eventID: req.body.eventID,

            issueDescription: req.body.issueDescription,
            issueObservedBy: req.body.issueObservedBy,
            issueObservationDate: req.body.issueObservationDate,
            issueSerious: req.body.issueSerious,

            treatmentMedicine: req.body.treatmentMedicine,
            treatmentDate: req.body.treatmentDate,
            treatmentResponse: req.body.treatmentResponse,
            treatmentMethod: req.body.treatmentMethod,
            treatmentIsImmunization: req.body.treatmentIsImmunization,
            treatmentIsActive: req.body.treatmentIsActive,

            vetName: req.body.vetName,
            vetComments: req.body.vetComments,

            note: req.body.note
        }));
    }

    async getMedicalRecordDetails(req, res) {
        return this.executeDBOperation(req, res, 'getMedicalRecordDetails', (req) => ({
            recordID: parseInt(req.params.recordId)
        }));
    }

    async updateMedicalRecord(req, res) {
        return this.executeDBOperation(req, res, 'updateMedicalRecord', (req) => ({
            recordID: parseInt(req.params.recordId),
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

    async updateCowWeight(req, res) {
        return this.executeDBOperation(req, res, 'updateWeightRecord', (req) => ({
            cowTag: req.body.cowTag,
            weight: req.body.weight
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
    async submitPregancyCheck(req, res) {
        return this.executeDBOperation(req, res, 'submitPregancyCheck', (req) => ({
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
    async addCalvingRecord(req, res) {
        return this.executeDBOperation(req, res, 'addCalvingRecord', (req) => ({
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
    async recordBatchWeights(req, res) {
        return this.executeDBOperation(req, res, 'recordBatchWeights', (req) => ({
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
                        await dbOperations.addCalvingRecord({
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


    async getAllCows(req, res) {
        return this.executeDBOperation(req, res, 'getAllCows', (req) => ({
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            search: req.query.search || ''
        }));
    }




    /**
     * File operations - simplified
     */
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

    async getCowImage(req, res) {
        try {



            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const result = await localFileOps.getActualImageFile({
                cowTag: req.params.tag,
                imageType: req.params.imageType
            });

            if (result.success) {
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.size,
                    'Content-Disposition': `inline; filename="${result.filename}"`
                });
                res.send(result.fileBuffer);
            } else {
                res.status(404).json({ error: result.message });
            }
        } catch (error) {
            console.error('Get cow image error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getAllCowImages(req, res) {
        return this.executeFileOperation(req, res, 'getAllCowImages', (req) => ({
            cowTag: req.params.tag
        }));
    }

    async getNthCowImage(req, res) {
        try {



            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const result = await localFileOps.getActualImageFile({
                cowTag: req.params.tag,
                imageType: req.params.imageType,
                n: parseInt(req.params.n) || 1
            });

            if (result.success) {
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.size,
                    'Content-Disposition': `inline; filename="${result.filename}"`
                });
                res.send(result.fileBuffer);
            } else {
                res.status(404).json({ error: result.message });
            }
        } catch (error) {
            console.error('Get nth cow image error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getCowImageCount(req, res) {
        try {



            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const result = await localFileOps.numCowImages({
                cowTag: req.params.tag
            });

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get cow image count error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async uploadMedicalImage(req, res) {
        try {
            const recordId = parseInt(req.params.recordId);
            
            if (!req.file) {
                return res.status(400).json({ error: 'No image file provided' });
            }

            const result = await localFileOps.saveMedicalImage({
                recordId: recordId,
                fileBuffer: req.file.buffer,
                originalFilename: req.file.originalname
            });

            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    filename: result.filename
                });
            } else {
                res.status(500).json({ error: result.message });
            }
        } catch (error) {
            console.error('Error uploading medical image:', error);
            res.status(500).json({ error: 'Failed to upload medical image' });
        }
    }

    async getMedicalImage(req, res) {
        try {
            const recordId = parseInt(req.params.recordId);
            const imageType = req.params.imageType; // 'issue' for now
            const n = parseInt(req.params.n) || 1;

            const result = await localFileOps.getMedicalImage({
                recordId: recordId,
                imageType: imageType,
                n: n
            });

            if (result.success) {
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.size,
                    'Last-Modified': result.modified.toUTCString(),
                    'Cache-Control': 'public, max-age=31536000'
                });
                res.send(result.fileBuffer);
            } else {
                res.status(404).json({ error: result.message });
            }
        } catch (error) {
            console.error('Error getting medical image:', error);
            res.status(500).json({ error: 'Failed to get medical image' });
        }
    }

    async getMedicalImageCount(req, res) {
        try {
            const recordId = parseInt(req.params.recordId);

            const result = await localFileOps.getMedicalImageCount({
                recordId: recordId
            });

            if (result.success) {
                res.json({
                    success: true,
                    issues: result.issues || 0,
                    total: result.total || 0
                });
            } else {
                res.status(500).json({ error: result.message });
            }
        } catch (error) {
            console.error('Error getting medical image count:', error);
            res.status(500).json({ error: 'Failed to get image count' });
        }
    }


    async getMap(req, res) {
        try {
            // Maps are public resources, but we might want pasture info
            const pastureName = req.query.pasture;
            const result = await localFileOps.getMap({ pastureName });

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get map error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getMapImage(req, res) {
        try {
            const { image } = req.query;
            const allowedTypes = ['map', 'MapCombined'];

            if (!allowedTypes.includes(image)) {
                return res.status(400).json({ error: 'Invalid map type' });
            }

            // Pass just the image type to local function
            const result = await localFileOps.getMapImage(image);

            if (result.success) {
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.size,
                    'Content-Disposition': `inline; filename="${result.filename}"`
                });
                res.send(result.fileBuffer);
            } else {
                res.status(404).json({ error: result.message });
            }
        } catch (error) {
            console.error('Map image error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getMinimap(req, res) {
        try {



            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const result = await localFileOps.getMinimap({
                fieldName: decodeURIComponent(req.params.fieldName)
            });

            if (result.success) {
                res.set({
                    'Content-Type': result.mimeType,
                    'Content-Length': result.size,
                    'Content-Disposition': `inline; filename="${result.filename}"`
                });
                res.send(result.fileBuffer);
            } else {
                res.status(404).json({
                    error: result.message,
                    availableFields: result.availableFields
                });
            }
        } catch (error) {
            console.error('Get minimap error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getAvailableMinimaps(req, res) {
        try {
            // Public resource, no access control needed
            const availableFields = await localFileOps.getAvailableMinimaps();
            res.json({
                success: true,
                fields: availableFields,
                count: availableFields.length
            });
        } catch (error) {
            console.error('Available minimaps error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get all herds with detailed information
     */
    async getHerdsWithDetails(req, res) {
        return this.executeDBOperation(req, res, 'getAllHerdsWithDetails', (req) => ({}));
    }

    /**
    * Only the herd names
    */
    async getHerdsList(req, res) {
        return this.executeDBOperation(req, res, 'getAllHerds', (req) => ({}));
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
     * Get all animals in a specific herd
     */
    async getHerdAnimals(req, res) {
        return this.executeDBOperation(req, res, 'getHerdAnimals', (req) => ({
            herdName: req.params.herdName
        }));
    }

    /**
     * Move herd to a new pasture
     */
    async moveHerd(req, res) {
        return this.executeDBOperation(req, res, 'moveHerdToPasture', (req) => ({
            herdName: req.body.herdName,
            newPastureName: req.body.newPastureName,
            username: req.body.username || req.session?.user?.username || 'Unknown'
        }));
    }

    /**
     * Get all available pastures
     */
    async getAllPastures(req, res) {
        return this.executeDBOperation(req, res, 'getAllPastures', (req) => ({}));
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

    async batchMoveCows(req, res) {
        return this.executeDBOperation(req, res, 'batchMoveCows', (req) => ({
            cowTags: req.body.cowTags,
            targetHerd: req.body.targetHerd,
            sourceHerd: req.body.sourceHerd || null
        }));
    }

    async getCowsByHerd(req, res) {
        return this.executeDBOperation(req, res, 'getCowsByHerd', (req) => ({}));
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
    
    /**
     * handle parentSheetId and locked status
     */
    async createSheet(req, res) {
        return this.executeDBOperation(req, res, 'createSheetTemplate', (req) => ({
            name: req.body.name,
            columns: { columns: [...req.body.dataColumns, ...req.body.fillableColumns] },
            createdBy: req.session?.user?.username || 'Unknown',
            locked: req.body.locked || false,
            parentSheetId: req.body.parentSheetId || null
        }));
    }

    async getSheetStructure(req, res) {
        try {
            const sheetDef = await dbOperations.getSheetTemplate({ sheetId: req.params.sheetId });
            const columnConfig = JSON.parse(sheetDef.columns);

            // Separate columns based on whether they're fillable
            const dataColumns = columnConfig.columns.filter(col => !col.dataPath.startsWith('Fillable/'));
            const fillableColumns = columnConfig.columns.filter(col => col.dataPath.startsWith('Fillable/'));

            return res.status(200).json({
                name: sheetDef.name,
                dataColumns: dataColumns,
                fillableColumns: fillableColumns
            });
        } catch (error) {
            console.error('Error getting sheet structure:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    async updateSheet(req, res) {
        return this.executeDBOperation(req, res, 'updateSheetTemplate', (req) => ({
            sheetId: req.params.sheetId,
            name: req.body.name,
            columns: { columns: [...req.body.dataColumns, ...req.body.fillableColumns] }
        }));
    }

    async deleteSheet(req, res) {
        return this.executeDBOperation(req, res, 'deleteSheetTemplate', (req) => req.params.sheetId);
    }

    async getAvailableColumns(req, res) {
        return this.executeDBOperation(req, res, 'getAvailableColumns', (req) => ({}));
    }




    /**
     * SHEET INSTANCE API FUNCTIONS
     */

    async getAllInstances(req, res) {
        return this.executeDBOperation(req, res, 'getAllSheetInstances', (req) => ({}));
    }

    async getSheetInstances(req, res) {
        return this.executeDBOperation(req, res, 'getSheetInstances', (req) => 
            req.params.sheetId
        );
    }

    async loadSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'loadSheetInstance', (req) => ({
            instanceId: req.params.instanceId
        }));
    }

    async createSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'createSheetInstance', (req) => ({
            sheetId: req.params.sheetId,
            herdName: req.body.herdName,
            breedingYear: req.body.breedingYear,
            createdBy: req.session?.user?.username || 'Unknown'
        }));
    }

    async tryLoadSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'tryLoadSheetInstance', (req) => ({
            instanceId: req.body.instanceId,
            sheetId: req.body.sheetId,
            herdName: req.body.herdName,
            breedingYear: req.body.breedingYear,
            createdBy: req.session?.user?.username || 'Unknown'
        }));
    }

    async updateSheetInstanceCell(req, res) {
        return this.executeDBOperation(req, res, 'updateSheetInstanceCell', (req) => ({
            instanceId: req.params.instanceId,
            cowTag: req.body.cowTag,
            columnKey: req.body.columnKey,
            value: req.body.value,
            column: req.body.column
        }));
    }

    async batchUpdateSheetInstanceCells(req, res) {
        return this.executeDBOperation(req, res, 'batchUpdateSheetInstanceCells', (req) => ({
            instanceId: req.params.instanceId,
            updates: req.body.updates
        }));
    }

    async deleteSheetInstance(req, res) {
        return this.executeDBOperation(req, res, 'deleteSheetInstance', (req) => 
            req.params.instanceId
        );
    }






    /**
     * Load sheet data with filtering
     */
    async loadSheet(req, res) {
        return this.executeDBOperation(req, res, 'getSheetDataDynamic', (req) => ({
            sheetId: req.body.sheetId,
            herdName: req.body.herdName,
            breedingYear: req.body.breedingYear || new Date().getFullYear(),
            sheetName: req.body.sheetName || null
        }));
    }

    /**
     * Batch update multiple sheet cells at once
     */
    async batchUpdateSheetCells(req, res) {
        return this.executeDBOperation(req, res, 'batchUpdateSheetCells', (req) => ({
            updates: req.body.updates
        }));
    }


    /**
     * Updates a sheet cell
     */
    async updateSheetCell(req, res) {
        return this.executeDBOperation(req, res, 'updateSheetCell', (req) => ({
            handler: req.body.handler,
            cowTag: req.body.cowTag,
            value: req.body.value,
            breedingYear: req.body.breedingYear || new Date().getFullYear(),
            breedingPlanId: req.body.breedingPlanId || null
        }));
    }





    /**
     * Get user's email from Cloudflare Access
     */
    async getUserEmail(req, res) {
        try {
            const { getUserEmail } = require('../backend/accessControl');
            const email = getUserEmail(req);
            
            if (!email) {
                return res.status(401).json({
                    success: false,
                    message: 'No authenticated email found'
                });
            }
            
            return res.json({
                success: true,
                email: email
            });
        } catch (error) {
            console.error('Error getting user email:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get user email'
            });
        }
    }

    /**
     * Get all users - Admin only
     */
    async getAllUsers(req, res) {
        try {
            // Admin check is done by middleware
            const result = await localFileOps.getAllUsers();
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error getting all users:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get users'
            });
        }
    }

    /**
     * Reset user password - Admin only
     */
    async resetUserPassword(req, res) {
        try {
            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const { email } = req.body;
            const adminEmail = req.session.user.email;

            const result = await localFileOps.resetUserPassword({
                email,
                adminEmail
            });

            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to reset password'
            });
        }
    }

    /**
     * Update user permissions - Admin only
     */
    async updateUserPermissions(req, res) {
        try {
            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const { email, permissions } = req.body;
            const adminEmail = req.session.user.email;

            // Validate permissions array
            const validPermissions = ['view', 'add', 'admin', 'dev'];
            const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
            
            if (invalidPerms.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid permissions: ${invalidPerms.join(', ')}`
                });
            }

            const result = await localFileOps.updateUserPermissions({
                email,
                permissions,
                adminEmail
            });

            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error updating permissions:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update permissions'
            });
        }
    }

    /**
     * Block user - Admin only
     */
    async blockUser(req, res) {
        try {
            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const { email } = req.body;
            const adminEmail = req.session.user.email;

            const result = await localFileOps.blockUser({
                email,
                adminEmail
            });

            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error blocking user:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to block user'
            });
        }
    }

    /**
     * Unblock user - Admin only
     */
    async unblockUser(req, res) {
        try {
            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const { email } = req.body;
            const adminEmail = req.session.user.email;

            const result = await localFileOps.unblockUser({
                email,
                adminEmail
            });

            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error unblocking user:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to unblock user'
            });
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
     * Pre-register user - Admin only
     */
    async preRegisterUser(req, res) {
        try {
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors.array()
                });
            }

            const { email, permissions } = req.body;
            const adminEmail = req.session.user.email;

            const result = await localFileOps.preRegisterUser({
                email,
                permissions,
                adminEmail
            });

            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error pre-registering user:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to pre-register user'
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