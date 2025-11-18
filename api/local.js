const path = require('path');
const multer = require('multer');
require('dotenv').config();

/**
 * Local file operations for managing cattle images and maps
 * Input is validated by API wrapper
 */
class LocalFileOperations {
    constructor() {
        this.basePath = process.env.LOCAL_PATH || './files';
        this.imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        this.cowPhotosDir = path.join(this.basePath, 'Cow Photos');
        this.mapDataDir = path.join(this.basePath, 'MapData');
        this.minimapsDir = path.join(this.mapDataDir, 'minimaps');
        this.users = path.join(this.basePath, 'users.csv')
    }

    /**
     * Ensure directory exists, create if it doesn't
     */
    async ensureDirectoryExists(dirPath) {
        const fs = require('fs').promises;
        try {
            await fs.access(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dirPath, { recursive: true });
                console.log(`Created directory: ${dirPath}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Validate file type
     */
    validateFileType(filename, allowedTypes) {
        const ext = path.extname(filename).toLowerCase();
        return allowedTypes.includes(ext);
    }

    /**
     * Format date for filename (matches existing format: dayMonthYear)
     */
    formatDateForFilename(date = new Date()) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day.toString().padStart(2, '0')}${month}${year}`;
    }

    /**
     * Get MIME type for file
     */
    getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Save cow image, NEVER overwrites existing files
     * @param {Object} params - { cowTag, imageType, fileBuffer, originalFilename }
     */
    async saveCowImage(params) {
        const { cowTag, imageType, fileBuffer, originalFilename } = params;
        const fs = require('fs').promises;
    
        if (!this.validateFileType(originalFilename, this.imageFormats)) {
            throw new Error('Invalid image format. Allowed: ' + this.imageFormats.join(', '));
        }
    
        try {
            // Convert cow tag for filesystem safety
            const safeTagName = this.remCowtagSlash(cowTag);
            
            // Create cow-specific directory following existing structure
            const cowDir = path.join(this.cowPhotosDir, safeTagName);
            await this.ensureDirectoryExists(cowDir);
    
            // Convert imageType to match existing naming convention
            const bodyType = imageType === 'headshot' ? 'HEAD' : 'BODY';
            const dateStr = this.formatDateForFilename();
            const ext = path.extname(originalFilename);
    
            // Generate base filename following existing convention: {CowTag} {BODY/HEAD} {date}
            let baseFilename = `${safeTagName} ${bodyType} ${dateStr}`;
            let filename = `${baseFilename}${ext}`;
            let filePath = path.join(cowDir, filename);
    
            // NEVER overwrite, find next available filename with counter
            let counter = 1;
            while (true) {
                try {
                    await fs.access(filePath);
                    // File exists, try next number
                    filename = `${baseFilename} (${counter})${ext}`;
                    filePath = path.join(cowDir, filename);
                    counter++;
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        // File doesn't exist, we can use this filename
                        break;
                    } else {
                        throw error;
                    }
                }
            }
    
            // Save file with unique filename
            await fs.writeFile(filePath, fileBuffer);
    
            // Return relative path for database storage
            const relativePath = path.join('Cow Photos', safeTagName, filename);
            
            return {
                success: true,
                relativePath: relativePath.replace(/\\/g, '/'), // Normalize path separators
                absolutePath: filePath,
                filename: filename,
                message: `${imageType} image saved as ${filename}`
            };
        } catch (error) {
            console.error('Error saving cow image:', error);
            throw new Error(`Failed to save image: ${error.message}`);
        }
    }

    /**
     * Get cow image - returns most recent image of specified type
     * @param {Object} params - { cowTag, imageType }
     */
    async getCowImage(params) {
        const { cowTag } = params;
        
        try {
            // Get the most recent images (n=1) for both types
            const result = await this.getNthCowImage({
                cowTag: cowTag,
                type: 'both',
                n: 1
            });
            
            if (!result.success) {
                return result;
            }
            
            // Format response to match existing API
            const response = {
                success: true,
                totalImages: 0
            };
            
            if (result.headshot && result.headshot.success) {
                response.headshot = {
                    filename: result.headshot.filename,
                    path: `/api/cow/${cowTag}/image/headshot`
                };
                response.totalImages++;
            } else {
                response.headshot = null;
            }
            
            if (result.bodyshot && result.bodyshot.success) {
                response.bodyshot = {
                    filename: result.bodyshot.filename,
                    path: `/api/cow/${cowTag}/image/body`
                };
                response.totalImages++;
            } else {
                response.bodyshot = null;
            }
            
            return response;
        } catch (error) {
            console.error('Error getting cow images:', error);
            return { 
                success: false, 
                message: `Failed to get cow images: ${error.message}` 
            };
        }
    }

    /**
     * Get all images for a specific cow
     * @param {Object} params - { cowTag }
     */
    async getAllCowImages(params) {
        const { cowTag } = params;
        const fs = require('fs').promises;
        
        try {
            const safeTagName = this.remCowtagSlash(cowTag);
            const cowDir = path.join(this.cowPhotosDir, safeTagName);
            
            try {
                await fs.access(cowDir);
            } catch (error) {
                return {
                    success: true,
                    images: { headshots: [], bodyshots: [] },
                    message: `No photos found for cow ${cowTag}`
                };
            }
    
            const files = await fs.readdir(cowDir);
            const validImages = files.filter(file => {
                return this.validateFileType(file, this.imageFormats) &&
                       file.toUpperCase().startsWith(safeTagName.toUpperCase());
            });
    
            const headshots = validImages
                .filter(file => file.toUpperCase().includes(' HEAD '))
                .sort();
                
            const bodyshots = validImages
                .filter(file => file.toUpperCase().includes(' BODY '))
                .sort();
    
            return {
                success: true,
                images: {
                    headshots: headshots,
                    bodyshots: bodyshots
                },
                totalImages: validImages.length
            };
        } catch (error) {
            console.error('Error getting all cow images:', error);
            return {
                success: false,
                message: `Failed to get cow images: ${error.message}`
            };
        }
    }

    
/**
     * Save medical image for a specific record
     * @param {Object} params - { recordId, fileBuffer, originalFilename }
     */
    async saveMedicalImage(params) {
        const { recordId, fileBuffer, originalFilename } = params;
        const fs = require('fs').promises;
    
        if (!this.validateFileType(originalFilename, this.imageFormats)) {
            throw new Error('Invalid image format. Allowed: ' + this.imageFormats.join(', '));
        }
    
        try {
            // Create medical images directory structure: Cow Photos/Medical/RecordID_XXXX/
            const medicalDir = path.join(this.cowPhotosDir, 'Medical');
            await this.ensureDirectoryExists(medicalDir);
            
            const recordDir = path.join(medicalDir, `Record_${recordId}`);
            await this.ensureDirectoryExists(recordDir);
    
            const dateStr = this.formatDateForFilename();
            const ext = path.extname(originalFilename);
    
            // Generate filename: Record_XXXX_ISSUE_date
            let baseFilename = `Record_${recordId}_ISSUE_${dateStr}`;
            let filename = `${baseFilename}${ext}`;
            let filePath = path.join(recordDir, filename);
    
            // NEVER overwrite - find next available filename with counter
            let counter = 1;
            while (true) {
                try {
                    await fs.access(filePath);
                    // File exists, try next number
                    filename = `${baseFilename}_${counter}${ext}`;
                    filePath = path.join(recordDir, filename);
                    counter++;
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        // File doesn't exist, we can use this filename
                        break;
                    } else {
                        throw error;
                    }
                }
            }
    
            // Save file with unique filename
            await fs.writeFile(filePath, fileBuffer);
    
            // Return relative path for reference
            const relativePath = path.join('Cow Photos', 'Medical', `Record_${recordId}`, filename);
            
            return {
                success: true,
                relativePath: relativePath.replace(/\\/g, '/'),
                absolutePath: filePath,
                filename: filename,
                message: `Medical image saved as ${filename}`
            };
        } catch (error) {
            console.error('Error saving medical image:', error);
            throw new Error(`Failed to save medical image: ${error.message}`);
        }
    }

    /**
     * Get medical image for a specific record
     * @param {Object} params - { recordId, imageType, n }
     */
    async getMedicalImage(params) {
        const { recordId, imageType, n = 1 } = params;
        const fs = require('fs').promises;
        
        try {
            const recordDir = path.join(this.cowPhotosDir, 'Medical', `Record_${recordId}`);
            
            try {
                await fs.access(recordDir);
            } catch (error) {
                return {
                    success: false,
                    message: `No medical images found for record ${recordId}`
                };
            }

            const files = await fs.readdir(recordDir);
            const validImages = files.filter(file => {
                return this.validateFileType(file, this.imageFormats) &&
                       file.toUpperCase().includes('ISSUE');
            });

            if (validImages.length === 0) {
                return {
                    success: false,
                    message: `No issue images found for record ${recordId}`
                };
            }

            // Sort by filename (which includes date) and get nth image
            const sortedImages = validImages.sort().reverse(); // Most recent first

            if (sortedImages.length < n) {
                return {
                    success: false,
                    message: `Only ${sortedImages.length} images available for record ${recordId}`
                };
            }

            const targetFile = sortedImages[n - 1];
            const filePath = path.join(recordDir, targetFile);
            
            const fileBuffer = await fs.readFile(filePath);
            const stats = await fs.stat(filePath);
            
            return {
                success: true,
                fileBuffer,
                filename: targetFile,
                size: stats.size,
                modified: stats.mtime,
                mimeType: this.getMimeType(targetFile)
            };
        } catch (error) {
            console.error('Error getting medical image:', error);
            return { 
                success: false, 
                message: `Failed to get medical image: ${error.message}` 
            };
        }
    }

    /**
     * Get count of medical images for a record
     * @param {Object} params - { recordId }
     */
    async getMedicalImageCount(params) {
        const { recordId } = params;
        const fs = require('fs').promises;
        
        try {
            const recordDir = path.join(this.cowPhotosDir, 'Medical', `Record_${recordId}`);
            
            try {
                await fs.access(recordDir);
            } catch (error) {
                return {
                    success: true,
                    issues: 0,
                    total: 0
                };
            }

            const files = await fs.readdir(recordDir);
            const validImages = files.filter(file => {
                return this.validateFileType(file, this.imageFormats) &&
                       file.toUpperCase().includes('ISSUE');
            });

            return {
                success: true,
                issues: validImages.length,
                total: validImages.length
            };
        } catch (error) {
            console.error('Error counting medical images:', error);
            return {
                success: false,
                message: `Failed to count medical images: ${error.message}`
            };
        }
    }

    async getActualImageFile(params) {
        const { cowTag, imageType, n = 1 } = params;
        
        try {
            const result = await this.getNthCowImage({
                cowTag: cowTag,
                type: imageType,
                n: n
            });
            
            if (!result.success) {
                return result;
            }
            
            return result;
        } catch (error) {
            console.error('Error getting actual image file:', error);
            return { 
                success: false, 
                message: `Failed to get ${imageType} image: ${error.message}` 
            };
        }
    }

    /**
     * Convert forward slashes in cow tags to filesystem-safe characters
     * @param {string} cowTag - Original cow tag that may contain forward slashes
     * @returns {string} Filesystem-safe cow tag with slashes converted to '_s_'
     */
    remCowtagSlash(cowTag) {
        if (!cowTag || typeof cowTag !== 'string') {
            return cowTag;
        }
        return cowTag.replace(/\//g, '_s_');
    }

    /**
     * Convert filesystem-safe cow tag back to original with forward slashes
     * @param {string} fileSystemCowTag - Filesystem-safe cow tag with '_s_' instead of '/'
     * @returns {string} Original cow tag with forward slashes restored
     */
    repCowtagSlash(fileSystemCowTag) {
        if (!fileSystemCowTag || typeof fileSystemCowTag !== 'string') {
            return fileSystemCowTag;
        }
        return fileSystemCowTag.replace(/_s_/g, '/');
    }

    /**
     * Get the nth most recent cow image of specified type
     * @param {Object} params - { cowTag, type, n }
     * type can be 'headshot', 'body', or 'both'
     * n is 1-indexed, where 1 is the most recent
     */
    async getNthCowImage(params) {
        const { cowTag, type, n } = params;
        const fs = require('fs').promises;
        
        try {
            const safeTagName = this.remCowtagSlash(cowTag);
            const cowDir = path.join(this.cowPhotosDir, safeTagName);
            
            try {
                await fs.access(cowDir);
            } catch (error) {
                return {
                    success: false,
                    message: `No photos found for cow ${cowTag}`
                };
            }

            const files = await fs.readdir(cowDir);
            const validImages = files.filter(file => {
                return this.validateFileType(file, this.imageFormats) &&
                    file.toUpperCase().startsWith(safeTagName.toUpperCase());
            });

            let targetFiles = [];
            
            if (type === 'both') {
                const headshots = validImages
                    .filter(file => file.toUpperCase().includes(' HEAD '))
                    .sort()
                    .reverse(); // Most recent first
                    
                const bodyshots = validImages
                    .filter(file => file.toUpperCase().includes(' BODY '))
                    .sort()
                    .reverse(); // Most recent first
                
                // For 'both', return both headshot and bodyshot at position n
                const result = {};
                
                if (headshots.length >= n) {
                    const headshotFile = headshots[n - 1];
                    const headshotPath = path.join(cowDir, headshotFile);
                    const headshotBuffer = await fs.readFile(headshotPath);
                    const headshotStats = await fs.stat(headshotPath);
                    
                    result.headshot = {
                        success: true,
                        fileBuffer: headshotBuffer,
                        filename: headshotFile,
                        size: headshotStats.size,
                        modified: headshotStats.mtime,
                        mimeType: this.getMimeType(headshotFile)
                    };
                } else {
                    result.headshot = {
                        success: false,
                        message: `Only ${headshots.length} headshot images available for cow ${cowTag}`
                    };
                }
                
                if (bodyshots.length >= n) {
                    const bodyshotFile = bodyshots[n - 1];
                    const bodyshotPath = path.join(cowDir, bodyshotFile);
                    const bodyshotBuffer = await fs.readFile(bodyshotPath);
                    const bodyshotStats = await fs.stat(bodyshotPath);
                    
                    result.bodyshot = {
                        success: true,
                        fileBuffer: bodyshotBuffer,
                        filename: bodyshotFile,
                        size: bodyshotStats.size,
                        modified: bodyshotStats.mtime,
                        mimeType: this.getMimeType(bodyshotFile)
                    };
                } else {
                    result.bodyshot = {
                        success: false,
                        message: `Only ${bodyshots.length} bodyshot images available for cow ${cowTag}`
                    };
                }
                
                return {
                    success: true,
                    ...result
                };
            } else {
                // Single type request
                const imageList = type === 'headshot' ? 
                    validImages.filter(file => file.toUpperCase().includes(' HEAD ')).sort().reverse() :
                    validImages.filter(file => file.toUpperCase().includes(' BODY ')).sort().reverse();
                
                if (imageList.length < n) {
                    return {
                        success: false,
                        message: `Only ${imageList.length} ${type} images available for cow ${cowTag}`
                    };
                }
                
                const targetFile = imageList[n - 1];
                const filePath = path.join(cowDir, targetFile);
                
                const fileBuffer = await fs.readFile(filePath);
                const stats = await fs.stat(filePath);
                
                return {
                    success: true,
                    fileBuffer,
                    filename: targetFile,
                    size: stats.size,
                    modified: stats.mtime,
                    mimeType: this.getMimeType(targetFile)
                };
            }
        } catch (error) {
            console.error('Error getting nth cow image:', error);
            return { 
                success: false, 
                message: `Failed to get ${type} image #${n}: ${error.message}` 
            };
        }
    }

    /**
     * Get count of images for each type
     * @param {Object} params - { cowTag }
     */
    async numCowImages(params) {
        const { cowTag } = params;
        const fs = require('fs').promises;
        
        try {
            const safeTagName = this.remCowtagSlash(cowTag);
            const cowDir = path.join(this.cowPhotosDir, safeTagName);
            
            try {
                await fs.access(cowDir);
            } catch (error) {
                return {
                    success: true,
                    headshots: 0,
                    bodyshots: 0,
                    total: 0
                };
            }

            const files = await fs.readdir(cowDir);
            const validImages = files.filter(file => {
                return this.validateFileType(file, this.imageFormats) &&
                    file.toUpperCase().startsWith(safeTagName.toUpperCase());
            });

            const headshots = validImages.filter(file => file.toUpperCase().includes(' HEAD '));
            const bodyshots = validImages.filter(file => file.toUpperCase().includes(' BODY '));

            return {
                success: true,
                headshots: headshots.length,
                bodyshots: bodyshots.length,
                total: validImages.length
            };
        } catch (error) {
            console.error('Error counting cow images:', error);
            return {
                success: false,
                message: `Failed to count images: ${error.message}`
            };
        }
    }


    /**
     * Get main map image (no validation needed - public resource)
        */
    async getMap(params = {}) {
        const fs = require('fs').promises;
        const { pastureName } = params;
        
        try {
            // Check if map files exist (but don't load them)
            const mapFiles = ['map.png', 'MapCombined.png'];
            const availableMaps = [];
            
            for (const mapFile of mapFiles) {
                const mapPath = path.join(this.mapDataDir, mapFile);
                try {
                    await fs.access(mapPath);
                    availableMaps.push({
                        name: mapFile.replace('.png', ''),
                        url: `/api/map-image/${mapFile.replace('.png', '')}`
                    });
                } catch (error) {
                    console.log(`Map file ${mapFile} not found`);
                }
            }

            // Load MapData.json (same as before)
            let fieldData = null;
            let normalizedCoordinates = null;
            
            try {
                const mapDataPath = path.join(this.mapDataDir, 'MapData.json');
                const mapDataContent = await fs.readFile(mapDataPath, 'utf8');
                fieldData = JSON.parse(mapDataContent);
                
                if (pastureName && fieldData.fields) {
                    const field = fieldData.fields.find(f => 
                        f.fieldname.toLowerCase() === pastureName.toLowerCase()
                    );
                    
                    if (field && field.pinpoint && fieldData.map_size) {
                        normalizedCoordinates = {
                            x: field.pinpoint[0] / fieldData.map_size.width,
                            y: field.pinpoint[1] / fieldData.map_size.height
                        };
                    }
                }
            } catch (error) {
                console.log('MapData.json not found or invalid');
            }

            return {
                success: true,
                availableMaps,  // URLs instead of file buffers
                fieldData,
                coordinates: normalizedCoordinates,
                pastureName
            };
        } catch (error) {
            console.error('Error getting map:', error);
            return {
                success: false,
                message: `Failed to get map: ${error.message}`
            };
        }
    }

    async getMapImage(mapType) {
        const fs = require('fs').promises;
        
        try {
            const filename = `${mapType}.png`;
            const mapPath = path.join(this.mapDataDir, filename);
            
            await fs.access(mapPath);
            const fileBuffer = await fs.readFile(mapPath);
            const stats = await fs.stat(mapPath);

            return {
                success: true,
                fileBuffer,
                filename,
                size: stats.size,
                modified: stats.mtime,
                mimeType: this.getMimeType(filename)
            };
        } catch (error) {
            return {
                success: false,
                message: `Map image ${mapType} not found`
            };
        }
    }

    /**
     * Get minimap for a specific field
     * @param {Object} params - { fieldName }
     */
    async getMinimap(params) {
        const { fieldName } = params;
        const fs = require('fs').promises;

        try {
            // Look for exact match first
            let minimapFilename = `${fieldName}_minimap.png`;
            let minimapPath = path.join(this.minimapsDir, minimapFilename);
            
            try {
                await fs.access(minimapPath);
            } catch (error) {
                // If exact match not found, try to find partial match
                const files = await fs.readdir(this.minimapsDir);
                const matchingFiles = files.filter(file => 
                    file.toLowerCase().includes(fieldName.toLowerCase()) && 
                    file.toLowerCase().includes('minimap') &&
                    this.validateFileType(file, this.imageFormats)
                );
                
                if (matchingFiles.length === 0) {
                    return {
                        success: false,
                        message: `No minimap found for field "${fieldName}"`,
                        availableFields: await this.getAvailableMinimaps()
                    };
                }
                
                // Use first matching file
                minimapFilename = matchingFiles[0];
                minimapPath = path.join(this.minimapsDir, minimapFilename);
            }

            const fileBuffer = await fs.readFile(minimapPath);
            const stats = await fs.stat(minimapPath);

            return {
                success: true,
                fileBuffer,
                filename: minimapFilename,
                fieldName: fieldName,
                size: stats.size,
                modified: stats.mtime,
                mimeType: this.getMimeType(minimapFilename)
            };
        } catch (error) {
            console.error('Error getting minimap:', error);
            return {
                success: false,
                message: `Failed to get minimap for ${fieldName}: ${error.message}`
            };
        }
    }

    /**
     * Get list of available minimap field names (no validation needed - public resource)
     */
    async getAvailableMinimaps() {
        const fs = require('fs').promises;
        
        try {
            const files = await fs.readdir(this.minimapsDir);
            const minimaps = files
                .filter(file => 
                    file.toLowerCase().includes('minimap') &&
                    this.validateFileType(file, this.imageFormats)
                )
                .map(file => {
                    // Extract field name from filename
                    return file.replace(/_minimap\.(png|jpg|jpeg|gif|webp)$/i, '');
                });
            
            return minimaps;
        } catch (error) {
            console.error('Error getting available minimaps:', error);
            return [];
        }
    }

    /**
     * Configure multer for file upload
     */
    configureMulter() {
        const storage = multer.memoryStorage(); // Store in memory for processing
        
        return multer({
            storage: storage,
            limits: {
                fileSize: 20 * 1024 * 1024, // 20MB limit
                files: 1 // Only one file at a time
            },
            fileFilter: (req, file, cb) => {
                const isValidImage = this.validateFileType(file.originalname, this.imageFormats);
                
                if (isValidImage) {
                    cb(null, true);
                } else {
                    cb(new Error('Invalid image file type. Allowed: ' + this.imageFormats.join(', ')), false);
                }
            }
        });
    }

    /**
     * Checks the users file is valid, creates it if file does not exist.
     */
    checkUsers() {
        
    }

    /**
     * Gets a list of all the users
     */
    async getAllUsers(params) {
        // input credentials

        // returns listof userinfo, 
    }

    /**
     * Given an email, return the user ID (if it exists), name, and if the user has set a password
     */
    async lookupUser(params) {
        // input user email

        // return id, name, email, permissions, isAdmin 
    }

    /**
     * Called to intialize user on first login
     */
    async setupUser(params) {
        // Assign user next free ID, save name, email, Hash and save password

        // Return session credentials, use these throughout the session to prove you are who you say youare
    }

    /**
     * Checks if the hashed input for given userID matches their expected hash
     */
    async validatePassword(params) {
        // Input userID, password

        // Hash the psswd, compare to expected

        // return true/false
    }

    /**
     * Reset the user password, letting user create it on next login
     * @param {*} params 
     */
    resetUserPassword(params) {
        // intput userID, credentials
    }


}

// Export singleton instance
const localOps = new LocalFileOperations();

module.exports = {
    saveCowImage: (params) => localOps.saveCowImage(params),
    getCowImage: (params) => localOps.getCowImage(params),
    getNthCowImage: (params) => localOps.getNthCowImage(params),
    numCowImages: (params) => localOps.numCowImages(params),
    getActualImageFile: (params) => localOps.getActualImageFile(params),
    getAllCowImages: (params) => localOps.getAllCowImages(params),
    getMap: (params) => localOps.getMap(params),
    getMapImage: (mapType) => localOps.getMapImage(mapType),
    getMinimap: (params) => localOps.getMinimap(params),
    getAvailableMinimaps: () => localOps.getAvailableMinimaps(),
    configureMulter: () => localOps.configureMulter(),
    remCowtagSlash: (cowTag) => localOps.remCowtagSlash(cowTag),
    repCowtagSlash: (fileSystemCowTag) => localOps.repCowtagSlash(fileSystemCowTag),
    saveMedicalImage: (params) => localOps.saveMedicalImage(params),
    getMedicalImage: (params) => localOps.getMedicalImage(params),
    getMedicalImageCount: (params) => localOps.getMedicalImageCount(params),
};