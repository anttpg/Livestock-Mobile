const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { param } = require('express-validator');
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
        this.usersFile = path.join(this.basePath, 'users.csv');
        // this.backups = path.join(this.basePath, 'backups');
        this.SALT_ROUNDS = 10;
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
                    path: `/api/cow/${encodeURIComponent(cowTag)}/image/headshot`
                };
                response.totalImages++;
            } else {
                response.headshot = null;
            }
            
            if (result.bodyshot && result.bodyshot.success) {
                response.bodyshot = {
                    filename: result.bodyshot.filename,
                    path: `/api/cow/${encodeURIComponent(cowTag)}/image/body`
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


    /**
     * Parse date from filename format: {CowTag} {BODY/HEAD} {DDMmmYYYY}
     * Example: "36 HEAD 06Feb2026.jpg" -> Date object
     */
    parseDateFromFilename(filename) {
        try {
            // Match pattern: DD + Month(3 letters) + YYYY
            const datePattern = /(\d{2})([A-Za-z]{3})(\d{4})/;
            const match = filename.match(datePattern);
            
            if (!match) return null;
            
            const [, day, monthStr, year] = match;
            
            const months = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };
            
            const month = months[monthStr.toLowerCase()];
            if (month === undefined) return null;
            
            return new Date(parseInt(year), month, parseInt(day));
        } catch (error) {
            console.error('Error parsing date from filename:', filename, error);
            return null;
        }
    }


    /**
     * Get date from image EXIF metadata or filename
     * @param {string} filePath - Full path to image file
     * @param {string} filename - Just the filename (for parsing date)
     * @returns {Date|null} Date object or null
     */
    async getImageDate(filePath, filename) {
        const fs = require('fs').promises;
        const ExifReader = require('exifreader');
        
        try {
            // Try to read EXIF data first
            const fileBuffer = await fs.readFile(filePath);
            const tags = ExifReader.load(fileBuffer, { expanded: true });
            
            // Try multiple EXIF date fields in order of preference
            const dateFields = [
                tags.exif?.DateTimeOriginal,  // When photo was taken
                tags.exif?.CreateDate,         // When photo was created
                tags.exif?.DateTime            // General date/time
            ];
            
            for (const dateField of dateFields) {
                if (dateField?.description) {
                    // EXIF dates are in format "YYYY:MM:DD HH:MM:SS"
                    const exifDate = dateField.description.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
                    const parsedDate = new Date(exifDate);
                    
                    if (!isNaN(parsedDate.getTime())) {
                        return parsedDate;
                    }
                }
            }
        } catch (error) {
            // EXIF reading failed, will fall back to filename parsing
            console.log(`No EXIF data for ${filename}, using filename date`);
        }
        
        // Fallback: parse date from filename
        return this.parseDateFromFilename(filename);
    }

    /**
     * Get the nth most recent image file (sorted by EXIF date, then filename date)
     * @param {Object} params - { cowTag, imageType, n }
     */
    async getActualImageFile(params) {
        const { cowTag, imageType, n = 1 } = params;
        const fs = require('fs').promises;
        
        try {
            const safeTagName = this.remCowtagSlash(cowTag);
            const cowDir = path.join(this.cowPhotosDir, safeTagName);
            
            // Check if directory exists
            try {
                await fs.access(cowDir);
            } catch (error) {
                return {
                    success: false,
                    message: `No photos found for cow ${cowTag}`
                };
            }

            // Get all files
            const files = await fs.readdir(cowDir);
            const validImages = files.filter(file => {
                return this.validateFileType(file, this.imageFormats) &&
                    file.toUpperCase().startsWith(safeTagName.toUpperCase());
            });

            // Filter by image type
            const typeKeyword = imageType === 'headshot' ? ' HEAD ' : ' BODY ';
            const imageList = validImages.filter(file => 
                file.toUpperCase().includes(typeKeyword)
            );

            if (imageList.length === 0) {
                return {
                    success: false,
                    message: `No ${imageType} images found for cow ${cowTag}`
                };
            }

            // Get dates for all images
            const imagesWithDates = await Promise.all(
                imageList.map(async (filename) => {
                    const filePath = path.join(cowDir, filename);
                    const date = await this.getImageDate(filePath, filename);
                    return { filename, filePath, date };
                })
            );

            // Sort by date (newest first), put null dates at the end
            imagesWithDates.sort((a, b) => {
                if (!a.date && !b.date) return 0;
                if (!a.date) return 1;  // a goes to end
                if (!b.date) return -1; // b goes to end
                return b.date - a.date; // Newest first
            });

            // Check if nth image exists
            if (imagesWithDates.length < n) {
                return {
                    success: false,
                    message: `Only ${imagesWithDates.length} ${imageType} images available for cow ${cowTag}`
                };
            }

            // Get the nth image (1-indexed)
            const targetImage = imagesWithDates[n - 1];
            const fileBuffer = await fs.readFile(targetImage.filePath);
            const stats = await fs.stat(targetImage.filePath);

            return {
                success: true,
                fileBuffer,
                filename: targetImage.filename,
                size: stats.size,
                modified: stats.mtime,
                dateTaken: targetImage.date,
                mimeType: this.getMimeType(targetImage.filename)
            };
        } catch (error) {
            console.error('Error getting actual image file:', error);
            return { 
                success: false, 
                message: `Failed to get ${imageType} image: ${error.message}` 
            };
        }
    }

    /**
     * Renames the given cowtag to another cowtag
     * @param {*} params 
     */
    async renameCow(params) {
        // Find the original cow folder, create it if it doesnt exist.

        // Rename all files within the folder

        // Finally, rename the folder itself

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
     * Get main map image, public resource
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
     * Get list of available minimap field names, public resource
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


    async uploadMinimap(params) {
        const ALLOW_OVERWRITE = false;
        const fs = require('fs').promises;
        const { fieldName, fileBuffer, filename, mimeType } = params;

        try {
            // Validate required parameters
            if (!fieldName || !fileBuffer) {
                return {
                    success: false,
                    message: 'Field name and file buffer are required'
                };
            }

            // Validate file type
            const originalFilename = filename || 'upload.png';
            if (!this.validateFileType(originalFilename, this.imageFormats)) {
                return {
                    success: false,
                    message: 'Invalid image file type. Allowed: ' + this.imageFormats.join(', ')
                };
            }

            // Determine file extension
            const extension = originalFilename.substring(originalFilename.lastIndexOf('.'));
            const minimapFilename = `${fieldName}_minimap${extension}`;
            const minimapPath = path.join(this.minimapsDir, minimapFilename);

            // Check if file already exists
            if (!ALLOW_OVERWRITE) {
                try {
                    await fs.access(minimapPath);
                    return {
                        success: false,
                        message: `Minimap for field "${fieldName}" already exists. Overwrite not allowed.`,
                        existingFile: minimapFilename
                    };
                } catch (error) {
                    // File doesn't exist, continue with upload
                }
            }

            // Ensure minimaps directory exists
            await fs.mkdir(this.minimapsDir, { recursive: true });

            // Write file to disk
            await fs.writeFile(minimapPath, fileBuffer);
            const stats = await fs.stat(minimapPath);

            return {
                success: true,
                message: `Minimap uploaded successfully for field "${fieldName}"`,
                filename: minimapFilename,
                fieldName: fieldName,
                size: stats.size,
                path: minimapPath
            };
        } catch (error) {
            console.error('Error uploading minimap:', error);
            return {
                success: false,
                message: `Failed to upload minimap: ${error.message}`
            };
        }
    }


    async uploadMap(params) {
        const ALLOW_OVERWRITE = false;
        const fs = require('fs').promises;
        const { mapType, fileBuffer, filename, mimeType } = params;

        try {
            // Validate required parameters
            if (!mapType || !fileBuffer) {
                return {
                    success: false,
                    message: 'Map type and file buffer are required'
                };
            }

            // Validate map type
            const validMapTypes = ['map', 'MapCombined'];
            if (!validMapTypes.includes(mapType)) {
                return {
                    success: false,
                    message: `Invalid map type. Allowed: ${validMapTypes.join(', ')}`
                };
            }

            // Validate file type
            const originalFilename = filename || 'upload.png';
            if (!this.validateFileType(originalFilename, this.imageFormats)) {
                return {
                    success: false,
                    message: 'Invalid image file type. Allowed: ' + this.imageFormats.join(', ')
                };
            }

            // Determine file extension
            const extension = originalFilename.substring(originalFilename.lastIndexOf('.'));
            const mapFilename = `${mapType}${extension}`;
            const mapPath = path.join(this.mapDataDir, mapFilename);

            // Check if file already exists
            if (!ALLOW_OVERWRITE) {
                try {
                    await fs.access(mapPath);
                    return {
                        success: false,
                        message: `Map "${mapType}" already exists. Overwrite not allowed.`,
                        existingFile: mapFilename
                    };
                } catch (error) {
                    // File doesn't exist, continue with upload
                }
            }

            // Ensure map data directory exists
            await fs.mkdir(this.mapDataDir, { recursive: true });

            // Write file to disk
            await fs.writeFile(mapPath, fileBuffer);
            const stats = await fs.stat(mapPath);

            return {
                success: true,
                message: `Map "${mapType}" uploaded successfully`,
                filename: mapFilename,
                mapType: mapType,
                size: stats.size,
                path: mapPath
            };
        } catch (error) {
            console.error('Error uploading map:', error);
            return {
                success: false,
                message: `Failed to upload map: ${error.message}`
            };
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
     * Parse CSV content into array of user objects
     */
    parseUsersCSV(csvContent) {
        const lines = csvContent.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',');
        const users = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length !== headers.length) continue;
            
            const user = {
                id: parseInt(values[0]),
                username: values[1],
                email: values[2],
                passwordHash: values[3],
                permissions: values[4] ? values[4].split('|').filter(p => p) : [],
                blocked: values[5] === 'true'
            };
            users.push(user);
        }
        
        return users;
    }

    /**
     * Convert users array to CSV content
     */
    usersToCSV(users) {
        const headers = 'id,username,email,passwordHash,permissions,blocked';
        const rows = users.map(user => {
            const permissions = user.permissions.join('|');
            return `${user.id},${user.username},${user.email},${user.passwordHash},${permissions},${user.blocked}`;
        });
        
        return [headers, ...rows].join('\n');
    }

    /**
     * Checks the users file is valid, creates it if file does not exist.
     * If creating new file, marks first user as admin with all permissions.
     */
    async checkUsers() {
        try {
            await fs.access(this.usersFile);
            
            // File exists, validate structure
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            // Ensure at least one admin exists
            const hasAdmin = users.some(user => !user.blocked && user.permissions.includes('admin'));
            if (!hasAdmin && users.length > 0) {
                console.warn('WARNING: No active admin users found in users.csv');
            }
            
            return {
                success: true,
                exists: true,
                userCount: users.length,
                hasAdmin
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, create with headers only
                const headers = 'id,username,email,passwordHash,permissions,blocked\n';
                await fs.writeFile(this.usersFile, headers);
                
                console.log('Created new users.csv file');
                return {
                    success: true,
                    exists: false,
                    created: true,
                    firstUserWillBeAdmin: true
                };
            } else {
                throw error;
            }
        }
    }

    /**
     * Gets a list of all users (excluding password hashes)
     */
    async getAllUsers() {
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            // Return users without password hashes
            return {
                success: true,
                users: users.map(user => ({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    permissions: user.permissions,
                    blocked: user.blocked,
                    hasPassword: !!user.passwordHash && user.passwordHash !== ''
                }))
            };
        } catch (error) {
            console.error('Error getting all users:', error);
            return {
                success: false,
                message: `Failed to get users: ${error.message}`
            };
        }
    }

    /**
     * Given an email, return the user info (if it exists)
     */
    async lookupUser(params) {
        const { email } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            if (!user) {
                return {
                    success: false,
                    exists: false,
                    message: 'User not found'
                };
            }
            
            return {
                success: true,
                exists: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    permissions: user.permissions,
                    blocked: user.blocked,
                    hasPassword: !!user.passwordHash && user.passwordHash !== '',
                    isAdmin: user.permissions.includes('admin')
                }
            };
        } catch (error) {
            console.error('Error looking up user:', error);
            return {
                success: false,
                message: `Failed to lookup user: ${error.message}`
            };
        }
    }

    /**
     * Called to initialize user on first login or registration
     */
    async setupUser(params) {
        const { username, email, password } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            // Validate username is not reserved
            if (username.toUpperCase() === 'PREREGISTERED') {
                return {
                    success: false,
                    message: 'Username "PREREGISTERED" is reserved. Please choose a different username.'
                };
            }
            
            // Check if user already exists
            const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            if (existingUser) {
                // User exists (pre-registered) - update their username and password
                if (existingUser.username !== 'PREREGISTERED') {
                    return {
                        success: false,
                        message: 'User already has a username set'
                    };
                }
                
                // Hash password
                const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
                
                // Update user
                const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
                users[userIndex].username = username;
                users[userIndex].passwordHash = passwordHash;
                
                // Save to file
                const csvContent = this.usersToCSV(users);
                await fs.writeFile(this.usersFile, csvContent);
                
                return {
                    success: true,
                    user: {
                        id: users[userIndex].id,
                        username: users[userIndex].username,
                        email: users[userIndex].email,
                        permissions: users[userIndex].permissions
                    },
                    wasPreregistered: true
                };
            }
            
            // New user - create fresh account
            // Generate new user ID
            const maxId = users.length > 0 ? Math.max(...users.map(u => u.id)) : 0;
            const newId = maxId + 1;
            
            // Hash password
            const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
            
            // Determine permissions - first user gets all permissions including admin
            let permissions = ['view'];
            if (users.length === 0) {
                permissions = ['view', 'add', 'admin', 'dev'];
                console.log('First user created - granted all permissions including admin');
            }
            
            // Create new user
            const newUser = {
                id: newId,
                username,
                email,
                passwordHash,
                permissions,
                blocked: false
            };
            
            users.push(newUser);
            
            // Save to file
            const csvContent = this.usersToCSV(users);
            await fs.writeFile(this.usersFile, csvContent);
            
            return {
                success: true,
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    permissions: newUser.permissions,
                    isFirstUser: users.length === 1
                }
            };
        } catch (error) {
            console.error('Error setting up user:', error);
            return {
                success: false,
                message: `Failed to setup user: ${error.message}`
            };
        }
    }

    /**
     * Checks if the password for given user email matches their expected hash
     */
    async validatePassword(params) {
        const { email, password } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            if (user.blocked) {
                return {
                    success: false,
                    blocked: true,
                    message: 'User account is blocked'
                };
            }
            
            if (!user.passwordHash || user.passwordHash === '') {
                return {
                    success: false,
                    needsPasswordSetup: true,
                    message: 'Password needs to be set'
                };
            }
            
            const isValid = await bcrypt.compare(password, user.passwordHash);
            
            if (isValid) {
                return {
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        permissions: user.permissions
                    }
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid password'
                };
            }
        } catch (error) {
            console.error('Error validating password:', error);
            return {
                success: false,
                message: `Failed to validate password: ${error.message}`
            };
        }
    }

    /**
     * Reset the user password, clearing hash to prompt new password on next login
     */
    async resetUserPassword(params) {
        const { email, adminEmail } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            // Verify admin has permission
            const admin = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
            if (!admin || !admin.permissions.includes('admin')) {
                return {
                    success: false,
                    message: 'Only admins can reset passwords'
                };
            }
            
            // Find target user
            const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
            if (userIndex === -1) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            // Clear password hash
            users[userIndex].passwordHash = '';
            
            // Save to file
            const csvContent = this.usersToCSV(users);
            await fs.writeFile(this.usersFile, csvContent);
            
            return {
                success: true,
                message: `Password reset for ${email}. User will be prompted to set new password on next login.`
            };
        } catch (error) {
            console.error('Error resetting password:', error);
            return {
                success: false,
                message: `Failed to reset password: ${error.message}`
            };
        }
    }

    /**
     * Set a new password for user (used when user needs to create/reset password)
     */
    async setUserPassword(params) {
        const { email, password } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
            if (userIndex === -1) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            if (users[userIndex].blocked) {
                return {
                    success: false,
                    message: 'Cannot set password for blocked user'
                };
            }
            
            // Hash and set new password
            const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
            users[userIndex].passwordHash = passwordHash;
            
            // Save to file
            const csvContent = this.usersToCSV(users);
            await fs.writeFile(this.usersFile, csvContent);
            
            return {
                success: true,
                user: {
                    id: users[userIndex].id,
                    username: users[userIndex].username,
                    email: users[userIndex].email,
                    permissions: users[userIndex].permissions
                }
            };
        } catch (error) {
            console.error('Error setting password:', error);
            return {
                success: false,
                message: `Failed to set password: ${error.message}`
            };
        }
    }

    /**
     * Update user permissions
     */
    async updateUserPermissions(params) {
        const { email, permissions, adminEmail } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            // Verify admin has permission
            const admin = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
            if (!admin || !admin.permissions.includes('admin')) {
                return {
                    success: false,
                    message: 'Only admins can update permissions'
                };
            }
            
            // Find target user
            const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
            if (userIndex === -1) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            // Check if removing admin would leave zero admins
            const wasAdmin = users[userIndex].permissions.includes('admin');
            const willBeAdmin = permissions.includes('admin');
            
            if (wasAdmin && !willBeAdmin) {
                const activeAdmins = users.filter(u => 
                    !u.blocked && 
                    u.permissions.includes('admin') && 
                    u.email.toLowerCase() !== email.toLowerCase()
                );
                
                if (activeAdmins.length === 0) {
                    return {
                        success: false,
                        message: 'Cannot remove admin permission - at least one admin must remain'
                    };
                }
            }
            
            // Update permissions
            users[userIndex].permissions = permissions;
            
            // Save to file
            const csvContent = this.usersToCSV(users);
            await fs.writeFile(this.usersFile, csvContent);
            
            return {
                success: true,
                user: {
                    id: users[userIndex].id,
                    username: users[userIndex].username,
                    email: users[userIndex].email,
                    permissions: users[userIndex].permissions
                }
            };
        } catch (error) {
            console.error('Error updating permissions:', error);
            return {
                success: false,
                message: `Failed to update permissions: ${error.message}`
            };
        }
    }

    /**
     * Block a user account
     */
    async blockUser(params) {
        const { email, adminEmail } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            // Verify admin has permission
            const admin = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
            if (!admin || !admin.permissions.includes('admin')) {
                return {
                    success: false,
                    message: 'Only admins can block users'
                };
            }
            
            // Find target user
            const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
            if (userIndex === -1) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            // Prevent blocking if it would leave zero admins
            if (users[userIndex].permissions.includes('admin')) {
                const activeAdmins = users.filter(u => 
                    !u.blocked && 
                    u.permissions.includes('admin') && 
                    u.email.toLowerCase() !== email.toLowerCase()
                );
                
                if (activeAdmins.length === 0) {
                    return {
                        success: false,
                        message: 'Cannot block user - at least one active admin must remain'
                    };
                }
            }
            
            // Block user
            users[userIndex].blocked = true;
            
            // Save to file
            const csvContent = this.usersToCSV(users);
            await fs.writeFile(this.usersFile, csvContent);
            
            return {
                success: true,
                message: `User ${email} has been blocked`
            };
        } catch (error) {
            console.error('Error blocking user:', error);
            return {
                success: false,
                message: `Failed to block user: ${error.message}`
            };
        }
    }

    /**
     * Unblock a user account
     */
    async unblockUser(params) {
        const { email, adminEmail } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            // Verify admin has permission
            const admin = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
            if (!admin || !admin.permissions.includes('admin')) {
                return {
                    success: false,
                    message: 'Only admins can unblock users'
                };
            }
            
            // Find target user
            const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
            if (userIndex === -1) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            // Unblock user
            users[userIndex].blocked = false;
            
            // Save to file
            const csvContent = this.usersToCSV(users);
            await fs.writeFile(this.usersFile, csvContent);
            
            return {
                success: true,
                message: `User ${email} has been unblocked`
            };
        } catch (error) {
            console.error('Error unblocking user:', error);
            return {
                success: false,
                message: `Failed to unblock user: ${error.message}`
            };
        }
    }



    /**
     * Get backend log file content
     */
    async getBackendLog() {
        const fs = require('fs').promises;
        
        try {
            const logPath = path.join(this.basePath, 'backend.log');
            
            try {
                await fs.access(logPath);
            } catch (error) {
                return {
                    success: true,
                    content: 'No log file found'
                };
            }

            const content = await fs.readFile(logPath, 'utf8');
            
            return {
                success: true,
                content: content || 'Log file is empty'
            };
        } catch (error) {
            console.error('Error reading backend log:', error);
            return {
                success: false,
                message: `Failed to read backend log: ${error.message}`
            };
        }
    }

    /**
     * Get frontend log file content
     */
    async getFrontendLog() {
        const fs = require('fs').promises;
        
        try {
            const logPath = path.join(this.basePath, 'frontend.log');
            
            try {
                await fs.access(logPath);
            } catch (error) {
                return {
                    success: true,
                    content: 'No log file found'
                };
            }

            const content = await fs.readFile(logPath, 'utf8');
            
            return {
                success: true,
                content: content || 'Log file is empty'
            };
        } catch (error) {
            console.error('Error reading frontend log:', error);
            return {
                success: false,
                message: `Failed to read frontend log: ${error.message}`
            };
        }
    }

    /**
     * Clear backend log file
     */
    async clearBackendLog() {
        const fs = require('fs').promises;
        
        try {
            const logPath = path.join(this.basePath, 'backend.log');
            await fs.writeFile(logPath, '');
            
            return {
                success: true,
                message: 'Backend log cleared'
            };
        } catch (error) {
            console.error('Error clearing backend log:', error);
            return {
                success: false,
                message: `Failed to clear backend log: ${error.message}`
            };
        }
    }

    /**
     * Clear frontend log file
     */
    async clearFrontendLog() {
        const fs = require('fs').promises;
        
        try {
            const logPath = path.join(this.basePath, 'frontend.log');
            await fs.writeFile(logPath, '');
            
            return {
                success: true,
                message: 'Frontend log cleared'
            };
        } catch (error) {
            console.error('Error clearing frontend log:', error);
            return {
                success: false,
                message: `Failed to clear frontend log: ${error.message}`
            };
        }
    }

    /**
     * Pre-register a user with email and permissions (no password yet)
     */
    async preRegisterUser(params) {
        const { email, permissions, adminEmail } = params;
        
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);
            
            // Verify admin has permission
            const admin = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
            if (!admin || !admin.permissions.includes('admin')) {
                return {
                    success: false,
                    message: 'Only admins can pre-register users'
                };
            }
            
            // Check if user already exists
            const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (existingUser) {
                return {
                    success: false,
                    message: 'User already exists'
                };
            }
            
            // Generate new user ID
            const maxId = users.length > 0 ? Math.max(...users.map(u => u.id)) : 0;
            const newId = maxId + 1;
            
            // Create new user with PREREGISTERED username and no password
            const newUser = {
                id: newId,
                username: 'PREREGISTERED',  // Changed: Use reserved name
                email,
                passwordHash: '', // Empty - user will set on first login
                permissions,
                blocked: false
            };
            
            users.push(newUser);
            
            // Save to file
            const csvContent = this.usersToCSV(users);
            await fs.writeFile(this.usersFile, csvContent);
            
            return {
                success: true,
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    permissions: newUser.permissions
                }
            };
        } catch (error) {
            console.error('Error pre-registering user:', error);
            return {
                success: false,
                message: `Failed to pre-register user: ${error.message}`
            };
        }
    }


    /**
     * Dev console command
     */
    async executeConsoleCommand(params) {
        const { command, userPermissions } = params;
        
        // Must have dev permission
        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }
        
        // Command must be provided
        if (!command || typeof command !== 'string') {
            return {
                success: false,
                message: 'Command required',
                code: 'BAD_REQUEST'
            };
        }
        
        //  Command must be in whitelist
        const safeCommands = ['dir', 'pwd', 'cat'];
        const cmdParts = command.trim().split(' ');
        const baseCmd = cmdParts[0];
        if (!safeCommands.includes(baseCmd)) {
            return {
                success: false,
                message: `Command '${baseCmd}' not allowed. Allowed commands: ${safeCommands.join(', ')}`,
                code: 'FORBIDDEN'
            };
        }
        

        return {
            success: false,
            message: `Dev console is disabled until further experimentation & talks with client`,
            code: 'FORBIDDEN'
        };
        // Execute the command TEMP DISABLED, CHECK SECURITY, SANITIZE COMMANDS, ECT?
        // const { exec } = require('child_process');
        // const util = require('util');
        // const execPromise = util.promisify(exec);
        
        // try {
        //     const { stdout, stderr } = await execPromise(command, {
        //         cwd: this.basePath,
        //         timeout: 5000,
        //         maxBuffer: 1024 * 1024
        //     });
            
        //     return {
        //         success: true,
        //         output: stdout || stderr || 'Command executed (no output)'
        //     };
        // } catch (error) {
        //     return {
        //         success: false,
        //         message: error.message,
        //         output: error.stderr || '',
        //         code: 'EXECUTION_ERROR'
        //     };
        // }
    }

    async connectSqlServer(params) {
        const { username, password, userPermissions } = params;
        
        // VALIDATION 1: Access Control - Must have dev permission
        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }
        
        // VALIDATION 2: Credentials required
        if (!username || !password) {
            return {
                success: false,
                message: 'Username and password required',
                code: 'BAD_REQUEST'
            };
        }
        
        const { createDevConnection } = require('./db');
        
        try {
            console.log('Creating dev SQL connection for user:', username);
            
            await createDevConnection(username, password);
            
            return {
                success: true,
                message: 'Connected successfully',
                server: process.env.DB_SERVER,
                database: process.env.DB_DATABASE,
                port: parseInt(process.env.DB_PORT, 10) || 1433
            };
        } catch (error) {
            console.error('SQL connection error:', error);
            
            // Provide more helpful error messages
            let helpfulMessage = error.message;
            if (error.code === 'ELOGIN') {
                helpfulMessage = `Login failed for user '${username}'. Check credentials and SQL Server authentication mode.`;
            } else if (error.code === 'ESOCKET') {
                helpfulMessage = `Cannot connect to server '${process.env.DB_SERVER}:${process.env.DB_PORT}'. Check server address and firewall settings.`;
            }
            
            return {
                success: false,
                message: helpfulMessage,
                details: error.code || '',
                code: 'CONNECTION_ERROR'
            };
        }
    }

    /**
     * Execute SQL query - DEV ONLY
     * Uses the persistent dev connection created by connectSqlServer
     */
    async executeSqlQuery(params) {
        const { query, userPermissions } = params;
        
        // Must have dev permission
        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }
        
        //Query required
        if (!query) {
            return {
                success: false,
                message: 'Query required',
                code: 'BAD_REQUEST'
            };
        }
        
        const { getDevConnection, hasDevConnection } = require('./db');
        
        try {
            // Check if dev connection exists
            if (!hasDevConnection()) {
                return {
                    success: false,
                    message: 'No active database connection. Please connect first.',
                    code: 'NO_CONNECTION'
                };
            }
            
            const pool = getDevConnection();
            const result = await pool.request().query(query);
            
            return {
                success: true,
                data: result.recordset || [],
                rowCount: result.rowsAffected[0] || 0
            };
        } catch (error) {
            console.error('SQL query error:', error);
            
            // Provide helpful error messages
            let helpfulMessage = error.message;
            if (error.code === 'ELOGIN') {
                helpfulMessage = `Authentication failed. Connection may have expired, please reconnect.`;
            } else if (error.message.includes('No active dev connection')) {
                helpfulMessage = 'Connection lost. Please reconnect.';
            }
            
            return {
                success: false,
                message: helpfulMessage,
                code: 'QUERY_ERROR'
            };
        }
    }

    /**
     * Creates permanent .bak file in SQL Server's default backup directory,
     * stores a copy in database table for easy download via web
     * Create backup storage table (run this once to set up)
     */
    async createBackupTable() {
        const { hasDevConnection, getDevConnection } = require('./db');
        
        if (!hasDevConnection()) {
            return {
                success: false,
                message: 'No active database connection',
                code: 'NO_CONNECTION'
            };
        }
        
        try {
            const pool = getDevConnection();
            
            const createTableQuery = `
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DatabaseBackups')
                BEGIN
                    CREATE TABLE DatabaseBackups (
                        BackupID INT IDENTITY(1,1) PRIMARY KEY,
                        DatabaseName NVARCHAR(255) NOT NULL,
                        BackupFileName NVARCHAR(500) NOT NULL,
                        BackupFilePath NVARCHAR(1000) NOT NULL,
                        BackupData VARBINARY(MAX) NOT NULL,
                        BackupDate DATETIME NOT NULL DEFAULT GETDATE(),
                        BackupSize BIGINT NOT NULL,
                        CreatedBy NVARCHAR(255) NULL
                    );
                END
            `;
            
            await pool.request().query(createTableQuery);
            
            return {
                success: true,
                message: 'Backup table created or already exists'
            };
        } catch (error) {
            console.error('Error creating backup table:', error);
            return {
                success: false,
                message: `Failed to create backup table: ${error.message}`,
                code: 'TABLE_ERROR'
            };
        }
    }

    /**
     * Backup the SQL database - HYBRID approach
     * 1. Saves permanent .bak file to SQL Server's backup directory
     * 2. Stores copy in database table for easy web download
     */
    async backupSqlDatabase(params = {}) {
        const { userPermissions } = params;
        
        // VALIDATION: Must have dev permission
        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }
        
        const { hasDevConnection, getDevConnection } = require('./db');
        
        if (!hasDevConnection()) {
            return {
                success: false,
                message: 'No active database connection. Please connect first.',
                code: 'NO_CONNECTION'
            };
        }
        
        try {
            const pool = getDevConnection();
            
            // Ensure backup table exists
            await this.createBackupTable();
            
            // Get SQL Server's default backup directory
            const dirQuery = `EXEC master.dbo.xp_instance_regread 
                            N'HKEY_LOCAL_MACHINE', 
                            N'Software\\Microsoft\\MSSQLServer\\MSSQLServer',
                            N'BackupDirectory'`;
            
            const dirResult = await pool.request().query(dirQuery);
            const sqlBackupDir = dirResult.recordset[0]?.Data;
            
            if (!sqlBackupDir) {
                return {
                    success: false,
                    message: 'Could not determine SQL Server backup directory',
                    code: 'CONFIGURATION_ERROR'
                };
            }
            
            // Create timestamp for backup filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${process.env.DB_DATABASE}_backup_${timestamp}.bak`;
            const backupFilePath = path.join(sqlBackupDir, backupFileName);
            const escapedPath = path.resolve(backupFilePath).replace(/\\/g, '\\\\');
            
            // STEP 1: Create permanent backup file in SQL Server's backup directory
            const backupQuery = `
                BACKUP DATABASE [${process.env.DB_DATABASE}] 
                TO DISK = N'${escapedPath}' 
                WITH FORMAT, INIT, 
                NAME = 'Full Backup', 
                DESCRIPTION = 'Backup created via dev console'
            `;
            
            await pool.request().query(backupQuery);
            console.log(`✓ Backup file created: ${backupFilePath}`);
            
            // STEP 2: Read the backup file and store in database table for easy download
            const insertQuery = `
                DECLARE @BackupData VARBINARY(MAX);
                
                -- Read the backup file
                SELECT @BackupData = BulkColumn 
                FROM OPENROWSET(
                    BULK N'${escapedPath}', 
                    SINGLE_BLOB
                ) AS BackupFile;
                
                -- Store in database table (for easy web download)
                INSERT INTO DatabaseBackups (DatabaseName, BackupFileName, BackupFilePath, BackupData, BackupSize)
                VALUES (
                    '${process.env.DB_DATABASE}',
                    '${backupFileName}',
                    '${backupFilePath}',
                    @BackupData,
                    DATALENGTH(@BackupData)
                );
                
                -- Return the BackupID
                SELECT SCOPE_IDENTITY() AS BackupID, DATALENGTH(@BackupData) AS BackupSize;
            `;
            
            const result = await pool.request().query(insertQuery);
            const backupID = result.recordset[0]?.BackupID;
            const backupSize = result.recordset[0]?.BackupSize;
            
            console.log(`✓ Backup stored in database table (BackupID: ${backupID})`);
            
            return {
                success: true,
                message: `Database backed up successfully`,
                backupID: backupID,
                backupFileName: backupFileName,
                backupFilePath: backupFilePath,
                backupSize: backupSize,
                database: process.env.DB_DATABASE,
                permanent: {
                    location: sqlBackupDir,
                    note: 'Permanent backup file saved - will accumulate over time'
                },
                downloadable: {
                    backupID: backupID,
                    note: 'Also stored in database table for easy download'
                }
            };
            
        } catch (error) {
            console.error('Error backing up database:', error);
            
            if (error.message?.includes('OPENROWSET')) {
                return {
                    success: false,
                    message: 'Backup file created, but OPENROWSET is not enabled. Backup is saved but cannot be downloaded via web.',
                    code: 'PARTIAL_SUCCESS',
                    solution: 'Ask administrator to enable: EXEC sp_configure \'Ad Hoc Distributed Queries\', 1; RECONFIGURE;',
                    note: 'Backup file exists in SQL Server backup directory but cannot be stored in database table'
                };
            }
            
            return {
                success: false,
                message: `Failed to backup database: ${error.message}`,
                code: 'BACKUP_ERROR'
            };
        }
    }

    
    /**
     * Backup and retrieve the SQL database - DEV ONLY
     * Automatically creates a new backup if needed, then downloads it
     */
    async getSqlDatabase(params = {}) {
        const { userPermissions, backupID } = params;
        
        // VALIDATION: Must have dev permission
        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }
        
        const { hasDevConnection, getDevConnection } = require('./db');
        
        if (!hasDevConnection()) {
            return {
                success: false,
                message: 'No active database connection',
                code: 'NO_CONNECTION'
            };
        }
        
        try {
            const pool = getDevConnection();
            
            // Ensure backup table exists first
            await this.createBackupTable();
            
            let backup;
            
            // If specific backupID requested, get that one
            if (backupID) {
                const query = `
                    SELECT BackupID, DatabaseName, BackupFileName, BackupFilePath, BackupData, BackupDate, BackupSize
                    FROM DatabaseBackups
                    WHERE BackupID = ${backupID}
                `;
                
                const result = await pool.request().query(query);
                
                if (!result.recordset || result.recordset.length === 0) {
                    return {
                        success: false,
                        message: `Backup with ID ${backupID} not found`,
                        code: 'NOT_FOUND'
                    };
                }
                
                backup = result.recordset[0];
            } 
            // Otherwise, create a fresh backup
            else {
                console.log('Creating new backup for download...');
                
                // Call backupSqlDatabase to create a new backup
                const backupResult = await this.backupSqlDatabase({ userPermissions });
                
                if (!backupResult.success) {
                    return backupResult;
                }
                
                // Now fetch the backup we just created
                const query = `
                    SELECT BackupID, DatabaseName, BackupFileName, BackupFilePath, BackupData, BackupDate, BackupSize
                    FROM DatabaseBackups
                    WHERE BackupID = ${backupResult.backupID}
                `;
                
                const result = await pool.request().query(query);
                
                if (!result.recordset || result.recordset.length === 0) {
                    return {
                        success: false,
                        message: 'Backup was created but could not be retrieved',
                        code: 'INTERNAL_ERROR'
                    };
                }
                
                backup = result.recordset[0];
            }
            
            // Convert VARBINARY to base64 for transmission
            const backupData = backup.BackupData;
            
            return {
                success: true,
                message: 'Database backup retrieved successfully',
                fileName: backup.BackupFileName,
                fileSize: backup.BackupSize,
                fileData: backupData.toString('base64'),
                database: backup.DatabaseName,
                backupDate: backup.BackupDate,
                backupID: backup.BackupID,
                permanentLocation: backup.BackupFilePath
            };
            
        } catch (error) {
            console.error('Error getting database backup:', error);
            return {
                success: false,
                message: `Failed to get database backup: ${error.message}`,
                code: 'QUERY_ERROR'
            };
        }
    }

    /**
     * List available backups
     */
    async listBackups(params = {}) {
        const { userPermissions } = params;
        
        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }
        
        const { hasDevConnection, getDevConnection } = require('./db');
        
        if (!hasDevConnection()) {
            return {
                success: false,
                message: 'No active database connection',
                code: 'NO_CONNECTION'
            };
        }
        
        try {
            const pool = getDevConnection();
            
            const query = `
                SELECT 
                    BackupID, 
                    DatabaseName, 
                    BackupFileName,
                    BackupFilePath,
                    BackupDate, 
                    BackupSize,
                    CreatedBy
                FROM DatabaseBackups
                WHERE DatabaseName = '${process.env.DB_DATABASE}'
                ORDER BY BackupDate DESC
            `;
            
            const result = await pool.request().query(query);
            
            return {
                success: true,
                backups: result.recordset || [],
                count: result.recordset?.length || 0
            };
            
        } catch (error) {
            console.error('Error listing backups:', error);
            return {
                success: false,
                message: `Failed to list backups: ${error.message}`,
                code: 'QUERY_ERROR'
            };
        }
    }

    /**
     * Delete old backups FROM DATABASE TABLE ONLY
     * NOTE: This only cleans up the database table, permanent .bak files remain
     */
    async deleteOldBackups(params = {}) {
        const { userPermissions, daysToKeep = 7 } = params;
        
        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }
        
        const { hasDevConnection, getDevConnection } = require('./db');
        
        if (!hasDevConnection()) {
            return {
                success: false,
                message: 'No active database connection',
                code: 'NO_CONNECTION'
            };
        }
        
        try {
            const pool = getDevConnection();
            
            const query = `
                DELETE FROM DatabaseBackups
                WHERE DatabaseName = '${process.env.DB_DATABASE}'
                AND BackupDate < DATEADD(day, -${daysToKeep}, GETDATE())
            `;
            
            const result = await pool.request().query(query);
            
            return {
                success: true,
                message: `Deleted ${result.rowsAffected[0] || 0} backup entries from database table (older than ${daysToKeep} days)`,
                deletedCount: result.rowsAffected[0] || 0,
                note: 'Permanent .bak files in SQL Server backup directory are not deleted'
            };
            
        } catch (error) {
            console.error('Error deleting old backups:', error);
            return {
                success: false,
                message: `Failed to delete old backups: ${error.message}`,
                code: 'QUERY_ERROR'
            };
        }
    }


    /**
     * Close dev SQL connection - DEV ONLY
     */
    async closeDevSqlConnection(params = {}) {
        const { userPermissions } = params;
        
        // Must have dev permission
        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }
        
        const { closeDevConnection } = require('./db');
        
        try {
            await closeDevConnection();
            return {
                success: true,
                message: 'Dev connection closed'
            };
        } catch (error) {
            console.error('Error closing dev connection:', error);
            return {
                success: false,
                message: `Failed to close connection: ${error.message}`,
                code: 'INTERNAL_ERROR'
            };
        }
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
    uploadMinimap: (params) => localOps.uploadMinimap(params),
    uploadMap: (params) => localOps.uploadMap(params),



    configureMulter: () => localOps.configureMulter(),
    remCowtagSlash: (cowTag) => localOps.remCowtagSlash(cowTag),
    repCowtagSlash: (fileSystemCowTag) => localOps.repCowtagSlash(fileSystemCowTag),
    saveMedicalImage: (params) => localOps.saveMedicalImage(params),
    getMedicalImage: (params) => localOps.getMedicalImage(params),
    getMedicalImageCount: (params) => localOps.getMedicalImageCount(params),
    checkUsers: () => localOps.checkUsers(),
    getAllUsers: () => localOps.getAllUsers(),
    lookupUser: (params) => localOps.lookupUser(params),
    setupUser: (params) => localOps.setupUser(params),
    validatePassword: (params) => localOps.validatePassword(params),
    setUserPassword: (params) => localOps.setUserPassword(params),
    resetUserPassword: (params) => localOps.resetUserPassword(params),
    updateUserPermissions: (params) => localOps.updateUserPermissions(params),
    blockUser: (params) => localOps.blockUser(params),
    unblockUser: (params) => localOps.unblockUser(params),
    getBackendLog: () => localOps.getBackendLog(),
    getFrontendLog: () => localOps.getFrontendLog(),
    clearBackendLog: () => localOps.clearBackendLog(),
    clearFrontendLog: () => localOps.clearFrontendLog(),
    preRegisterUser: (params) => localOps.preRegisterUser(params),
    executeConsoleCommand: (params) => localOps.executeConsoleCommand(params), 
    connectSqlServer: (params) => localOps.connectSqlServer(params),
    executeSqlQuery: (params) => localOps.executeSqlQuery(params),
    closeDevSqlConnection: (params) => localOps.closeDevSqlConnection(params),

    backupSqlDatabase: (params) => localOps.backupSqlDatabase(params),
    getSqlDatabase: (params) => localOps.getSqlDatabase(params),
    
};