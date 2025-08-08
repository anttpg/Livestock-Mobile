const { validationResult } = require('express-validator');
const { setupAccessControl } = require('../backend/accessControl');
const dbOperations = require('./dbOperations');
const localFileOps = require('./local');

/**
 * Streamlined API wrapper that enforces validation and access control
 * without the complexity of branded types
 */
class APIWrapper {
    constructor() {
        this.accessControl = setupAccessControl();
    }

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
            // Step 1: Access Control (always enforced)
            const accessResult = await this.checkAccess(req, res);
            if (!accessResult.success) {
                return res.status(403).json({ error: accessResult.error });
            }

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
            // Access control
            const accessResult = await this.checkAccess(req, res);
            if (!accessResult.success) {
                return res.status(403).json({ error: accessResult.error });
            }

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
     * Check access control
     */
    async checkAccess(req, res) {
        return new Promise((resolve) => {
            this.accessControl(req, res, (error) => {
                if (error) {
                    resolve({ success: false, error: 'Access denied' });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    /**
     * Cow data operations - simplified without branding
     */
    async getCowData(req, res) {
        try {
            // Access control
            const accessResult = await this.checkAccess(req, res);
            if (!accessResult.success) {
                return res.status(403).json({ error: accessResult.error });
            }
    
            // Validation check
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: validationErrors.array() 
                });
            }
    
            const cowTag = req.params.tag;
            
            // Get database data
            const dbResult = await dbOperations.fetchCowData({ cowTag });
            
            // Reuse the existing getCowImage logic
            const images = await localFileOps.getCowImage({ cowTag });
            
            // Get minimap if cow has a pasture
            let minimap = null;
            const cowData = dbResult.cowData?.[0];
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

            // Include in responseData:
            const responseData = {
                ...dbResult,
                images,
                minimap,
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

    async setHerd(req, res) {
        return this.executeDBOperation(req, res, 'setHerd', (req) => ({
            cowTag: req.body.cowTag,
            herdName: req.body.herdName
        }));
    }

    async addObservation(req, res) {
        return this.executeDBOperation(req, res, 'addObservation', (req) => ({
            cowTag: req.body.cowTag,
            note: req.body.note,
            dateOfEntry: req.body.dateOfEntry || new Date()
        }));
    }

    async addMedicalRecord(req, res) {
        return this.executeDBOperation(req, res, 'addMedicalRecord', (req) => ({
            cowTag: req.body.cowTag,
            medicineApplied: req.body.medicineApplied,
            treatmentDate: req.body.treatmentDate || new Date(),
            observation: req.body.observation,
            treatment: req.body.treatment,
            treatmentResponse: req.body.treatmentResponse
        }));
    }

    async updateCowWeight(req, res) {
        return this.executeDBOperation(req, res, 'updateCowWeight', (req) => ({
            cowTag: req.body.cowTag,
            weight: req.body.weight
        }));
    }

    async addCow(req, res) {
        return this.executeDBOperation(req, res, 'addCow', (req) => ({
            cowTag: req.body.cowTag,
            dateOfBirth: req.body.dateOfBirth,
            description: req.body.description,
            dam: req.body.dam,
            sire: req.body.sire
        }));
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
            // Access control
            const accessResult = await this.checkAccess(req, res);
            if (!accessResult.success) {
                return res.status(403).json({ error: accessResult.error });
            }
    
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
            // Access control
            const accessResult = await this.checkAccess(req, res);
            if (!accessResult.success) {
                return res.status(403).json({ error: accessResult.error });
            }
    
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
            // Access control
            const accessResult = await this.checkAccess(req, res);
            if (!accessResult.success) {
                return res.status(403).json({ error: accessResult.error });
            }
    
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
            // Access control
            const accessResult = await this.checkAccess(req, res);
            if (!accessResult.success) {
                return res.status(403).json({ error: accessResult.error });
            }

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
     * Record feed activity for a herd's pasture
     */
    async recordFeedActivity(req, res) {
        return this.executeDBOperation(req, res, 'recordFeedActivity', (req) => ({
            herdName: req.body.herdName,
            feedType: req.body.feedType,
            activityType: req.body.activityType,
            wasEmpty: req.body.wasEmpty,
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


    /**
     * SHEET MANAGEMENT API FUNCTIONS
     */

    async getAllSheets(req, res) {
        return this.executeDBOperation(req, res, 'getAllSheetsFromDB', (req) => ({}));
    }

    async getAvailableColumns(req, res) {
        return this.executeDBOperation(req, res, 'getAvailableColumns', (req) => ({}));
    }

    async loadSheet(req, res) {
        console.log('Attempting to load sheet ', req.body.sheetId, ' for herd ', req.body.herdName)

        return this.executeDBOperation(req, res, 'getSheetDataDynamic', (req) => ({
            sheetId: req.body.sheetId,
            herdName: req.body.herdName
        }));
    }

    async updateSheetCell(req, res) {
        // TODO: Implement when update handlers are ready
        return res.status(501).json({ 
            error: 'Cell updates not yet implemented',
            message: 'Update handlers are being developed'
        });
    }

    async getHerdsList(req, res) {
        return this.executeDBOperation(req, res, 'getAllHerds', (req) => ({}));
    }


    async getSheetStructure(req, res) {
        try {
            const sheetDef = await dbOperations.getSheetDefinition({ sheetId: req.params.sheetId });
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

    async createSheet(req, res) {
        return this.executeDBOperation(req, res, 'createSheetInDB', (req) => ({
            name: req.body.name,
            columns: { columns: [...req.body.dataColumns, ...req.body.fillableColumns] },
            createdBy: req.session?.user?.username || 'Unknown'
        }));
    }

    async updateSheet(req, res) {
        return this.executeDBOperation(req, res, 'updateSheetInDB', (req) => ({
            sheetId: req.params.sheetId,
            name: req.body.name,
            columns: { columns: [...req.body.dataColumns, ...req.body.fillableColumns] }
        }));
    }

    async deleteSheet(req, res) {
        return this.executeDBOperation(req, res, 'deleteSheetFromDB', (req) => req.params.sheetId);
    }
}

// Export singleton instance
module.exports = new APIWrapper();