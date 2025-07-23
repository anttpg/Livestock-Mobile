// db/local.js - Local file operations for cattle management system
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
require('dotenv').config();

/**
 * Local file operations for managing cattle images and maps
 * Works with existing file structure: Cow Photos/{CowTag}/{CowTag} {BODY/HEAD} {date}.jpg
 */
class LocalFileOperations {
    constructor() {
        this.basePath = process.env.LOCAL_PATH || './files';
        this.imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        this.cowPhotosDir = path.join(this.basePath, 'Cow Photos');
        this.mapDataDir = path.join(this.basePath, 'MapData');
        this.minimapsDir = path.join(this.mapDataDir, 'minimaps');
    }

    /**
     * Ensure directory exists, create if it doesn't
     */
    async ensureDirectoryExists(dirPath) {
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
     * Save cow image (headshot or body) - NEVER overwrites existing files
     */
    async saveCowImage(params) {
        const { cowTag, imageType, fileBuffer, originalFilename } = params;
        
        if (!['headshot', 'body'].includes(imageType.toLowerCase())) {
            throw new Error('Image type must be "headshot" or "body"');
        }

        if (!this.validateFileType(originalFilename, this.imageFormats)) {
            throw new Error('Invalid image format. Allowed: ' + this.imageFormats.join(', '));
        }

        try {
            // Create cow-specific directory following existing structure
            const cowDir = path.join(this.cowPhotosDir, cowTag.toString());
            await this.ensureDirectoryExists(cowDir);

            // Convert imageType to match existing naming convention
            const bodyType = imageType.toLowerCase() === 'headshot' ? 'HEAD' : 'BODY';
            const dateStr = this.formatDateForFilename();
            const ext = path.extname(originalFilename);

            // Generate base filename following existing convention: {CowTag} {BODY/HEAD} {date}
            let baseFilename = `${cowTag} ${bodyType} ${dateStr}`;
            let filename = `${baseFilename}${ext}`;
            let filePath = path.join(cowDir, filename);

            // NEVER overwrite - find next available filename with counter
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
            const relativePath = path.join('Cow Photos', cowTag.toString(), filename);
            
            return {
                success: true,
                relativePath: relativePath.replace(/\\/g, '/'), // Normalize path separators
                absolutePath: filePath,
                filename: filename,
                message: `${imageType} image saved as ${filename}`
            };
        } catch (error) {
            console.error('Error saving cow image:', error);
            throw new Error(`Failed to save ${imageType} image: ${error.message}`);
        }
    }

    /**
     * Get cow image (headshot or body) - returns most recent image of specified type
     */
    async getCowImage(params) {
        const { cowTag, imageType } = params;
        
        if (!['headshot', 'body'].includes(imageType.toLowerCase())) {
            throw new Error('Image type must be "headshot" or "body"');
        }

        try {
            const cowDir = path.join(this.cowPhotosDir, cowTag.toString());
            
            // Check if cow directory exists
            try {
                await fs.access(cowDir);
            } catch (error) {
                return { 
                    success: false, 
                    message: `No photos found for cow ${cowTag}` 
                };
            }

            const files = await fs.readdir(cowDir);
            
            // Convert imageType to match existing naming convention
            const bodyType = imageType.toLowerCase() === 'headshot' ? 'HEAD' : 'BODY';
            
            // Find all images of the specified type
            const matchingFiles = files.filter(file => {
                const isValidImage = this.validateFileType(file, this.imageFormats);
                const matchesBodyType = file.toUpperCase().includes(` ${bodyType} `);
                const startsWithCowTag = file.toUpperCase().startsWith(cowTag.toString().toUpperCase());
                
                return isValidImage && matchesBodyType && startsWithCowTag;
            });

            if (matchingFiles.length === 0) {
                return { 
                    success: false, 
                    message: `No ${imageType} images found for cow ${cowTag}` 
                };
            }

            // Sort by filename to get the most recent (filenames include dates)
            // Most recent will be last when sorted alphabetically due to date format
            matchingFiles.sort();
            const mostRecentFile = matchingFiles[matchingFiles.length - 1];

            const filePath = path.join(cowDir, mostRecentFile);
            const fileBuffer = await fs.readFile(filePath);
            const stats = await fs.stat(filePath);

            return {
                success: true,
                fileBuffer,
                filename: mostRecentFile,
                size: stats.size,
                modified: stats.mtime,
                mimeType: this.getMimeType(mostRecentFile),
                availableImages: matchingFiles.length,
                allImages: matchingFiles // Include list of all available images
            };
        } catch (error) {
            console.error('Error getting cow image:', error);
            return { 
                success: false, 
                message: `Failed to get ${imageType} image: ${error.message}` 
            };
        }
    }

    /**
     * Get main map image
     */
    async getMap() {
        try {
            // Look for map.png first, then MapCombined.png as fallback
            const mapFiles = ['map.png', 'MapCombined.png'];
            
            for (const mapFile of mapFiles) {
                const mapPath = path.join(this.mapDataDir, mapFile);
                
                try {
                    await fs.access(mapPath);
                    const fileBuffer = await fs.readFile(mapPath);
                    const stats = await fs.stat(mapPath);

                    return {
                        success: true,
                        fileBuffer,
                        filename: mapFile,
                        size: stats.size,
                        modified: stats.mtime,
                        mimeType: this.getMimeType(mapFile)
                    };
                } catch (error) {
                    // File doesn't exist, try next one
                    continue;
                }
            }

            return {
                success: false,
                message: 'No map file found (looked for map.png and MapCombined.png)'
            };
        } catch (error) {
            console.error('Error getting map:', error);
            return {
                success: false,
                message: `Failed to get map: ${error.message}`
            };
        }
    }

    /**
     * Get minimap for a specific field
     */
    async getMinimap(params) {
        const { fieldName } = params;
        
        if (!fieldName) {
            throw new Error('Field name is required');
        }

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
     * Get list of available minimap field names
     */
    async getAvailableMinimaps() {
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
     * Configure multer for file uploads (only for cow images)
     */
    configureMulter() {
        const storage = multer.memoryStorage(); // Store in memory for processing
        
        return multer({
            storage: storage,
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB limit
                files: 1 // Only one file at a time for cow images
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
     * Get all images for a specific cow (for listing purposes)
     */
    async getAllCowImages(params) {
        const { cowTag } = params;
        
        try {
            const cowDir = path.join(this.cowPhotosDir, cowTag.toString());
            
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
            const validImages = files.filter(file => 
                this.validateFileType(file, this.imageFormats) &&
                file.toUpperCase().startsWith(cowTag.toString().toUpperCase())
            );

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
}

// Export singleton instance
const localOps = new LocalFileOperations();

module.exports = {
    saveCowImage: (params) => localOps.saveCowImage(params),
    getCowImage: (params) => localOps.getCowImage(params),
    getMap: () => localOps.getMap(),
    getMinimap: (params) => localOps.getMinimap(params),
    getAllCowImages: (params) => localOps.getAllCowImages(params),
    getAvailableMinimaps: () => localOps.getAvailableMinimaps(),
    configureMulter: () => localOps.configureMulter()
};