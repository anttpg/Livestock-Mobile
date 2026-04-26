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
        this.imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

        this.basePath = process.env.LOCAL_PATH || './files';

        this.cowPhotosDir = path.join(this.basePath, 'Cow Photos');
        this.medicalDir = path.join(this.basePath, 'Medical');
        this.equipmentDir = path.join(this.basePath, 'Equipment');
        this.equipmentMaintenanceDir = path.join(this.basePath, 'EquipmentMaintenance');

        this.mapDataDir = path.join(this.basePath, 'MapData');
        this.minimapsDir = path.join(this.mapDataDir, 'minimaps');

        this.pasturesDir = path.join(this.basePath, 'Pastures');
        this.pastureSprayDir = path.join(this.basePath, 'PesticideSpray');
        this.pastureHayUpload = path.join(this.basePath, 'HayProduction');
        
        this.usersFile = path.join(this.basePath, 'users.csv');
        // this.backups = path.join(this.basePath, 'backups');
        this.SALT_ROUNDS = 10;

        this.IMAGE_DOMAIN_CONFIG = {
            medical: {
                getDirectory: (id) => path.join(this.medicalDir, `Record_${id}`),
                getBaseFilename: (id, filter) => `Record_${id}_${filter}_${this.formatDateForFilename()}`,
            },
            cow: {
                getDirectory: (id) => path.join(this.cowPhotosDir, this.remCowtagSlash(id)),
                getBaseFilename: (id, filter) => `${this.remCowtagSlash(id)} ${filter} ${this.formatDateForFilename()}`,
            },
            equipment: {
                getDirectory: (id) => path.join(this.equipmentDir, `Item_${id}`),
                getBaseFilename: (id, _filter) => `Item_${id}_${this.formatDateForFilename()}`,
            },
            equipmentMaintenance: {
                getDirectory: (id) => path.join(this.equipmentMaintenanceDir, `Record_${id}`),
                getBaseFilename: (id, _filter) => `Record_${id}_${this.formatDateForFilename()}`,
            },

            map: {
                getDirectory: (_id) => this.mapDataDir,
                getBaseFilename: (id, _filter) => id,
            },
            minimap: {
                getDirectory: (_id) => this.minimapsDir,
                getBaseFilename: (id, _filter) => `${id}_minimap`,
            },


        };


        this.FILE_DOMAIN_CONFIG = {
            medicalUpload: {
                getDirectory: (id) => path.join(this.medicalDir, `Record_${id}`, 'Uploads'),
            },
            equipmentUpload: {
                getDirectory: (id) => path.join(this.equipmentDir, `Item_${id}`, 'Uploads'),
            },
            equipmentMaintenanceUpload: {
                getDirectory: (id) => path.join(this.equipmentMaintenanceDir, `Record_${id}`, 'Uploads'),
            },

            pastureUpload: {
                getDirectory: (id) => path.join(this.pasturesDir, `${id}`, 'Uploads'),
            },
            pastureSprayUpload: {
                getDirectory: (id) => path.join(this.pastureSprayDir, `Record_${id}`, 'Uploads'),
            },
            pastureHayUpload: {
                getDirectory: (id) => path.join(this.pastureHayDir, `Record_${id}`, 'Uploads'),
            },
        };
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
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain',
            '.csv': 'text/csv',
        };
        return mimeTypes[ext] || 'application/octet-stream';
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
     * Configure multer for file upload handling.
     * Stores files in memory, enforces 20MB limit and image format validation.
     * @returns {multer.Multer} Configured multer instance
     */
    configureMulter() {
        return multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 20 * 1024 * 1024,
                files: 1
            },
            fileFilter: (req, file, cb) => {
                if (this.validateFileType(file.originalname, this.imageFormats)) {
                    cb(null, true);
                } else {
                    cb(new Error('Invalid image file type. Allowed: ' + this.imageFormats.join(', ')), false);
                }
            }
        });
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
     * Resolve a unique file path, appending a counter if the file already exists.
     * Never overwrites. Used for cow images and medical images.
     * @param {string} directory    - Absolute directory to save into
     * @param {string} baseFilename - Desired filename without extension
     * @param {string} ext          - File extension including dot, e.g. ".jpg"
     * @returns {string} Absolute path guaranteed not to exist yet
     */
    async resolveUniquePath(directory, baseFilename, ext) {
        const fs = require('fs').promises;
        await this.ensureDirectoryExists(directory);

        let filename = `${baseFilename}${ext}`;
        let filePath = path.join(directory, filename);
        let counter = 1;

        while (true) {
            try {
                await fs.access(filePath);
                filename = `${baseFilename} (${counter})${ext}`;
                filePath = path.join(directory, filename);
                counter++;
            } catch (err) {
                if (err.code === 'ENOENT') return filePath;
                throw err;
            }
        }
    }

    /**
     * Write a buffer to an absolute file path. Validates format before writing.
     * @param {string}   filePath          - Absolute destination path
     * @param {Buffer}   fileBuffer        - File contents
     * @param {string}   originalFilename  - Used only for format validation
     * @param {string[]} allowedFormats    - Allowed file extensions, e.g. ['.jpg', '.png']
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async writeFile(filePath, fileBuffer, originalFilename, allowedFormats) {
        const fs = require('fs').promises;

        if (!this.validateFileType(originalFilename, allowedFormats)) {
            throw new Error(`Invalid format. Allowed: ${allowedFormats.join(', ')}`);
        }

        await fs.writeFile(filePath, fileBuffer);

        const relativePath = path.relative(this.cowPhotosDir, filePath).replace(/\\/g, '/');

        return {
            success: true,
            relativePath,
            absolutePath: filePath,
            filename: path.basename(filePath),
            message: `Saved as ${path.basename(filePath)}`
        };
    }

    /**
     * Read the nth most recent file from a directory, optionally filtered by keyword.
     * Sorts by EXIF date if useExif is true, otherwise by filename.
     * @param {string}  directory       - Absolute directory to read from
     * @param {string}  [filterKeyword] - Optional case-insensitive substring filter
     * @param {number}  [n=1]           - 1 = most recent
     * @param {boolean} [useExif=false] - Whether to sort by EXIF date
     * @returns {Object} { success, fileBuffer, filename, size, modified, dateTaken, mimeType }
     */
    async readFile(directory, filterKeyword, n = 1, useExif = false) {
        const fs = require('fs').promises;

        try {
            await fs.access(directory);
        } catch {
            return { success: false, message: `Directory not found: ${directory}` };
        }

        let files = (await fs.readdir(directory)).filter(f =>
            this.validateFileType(f, this.imageFormats)
        );

        if (filterKeyword) {
            files = files.filter(f => f.toUpperCase().includes(filterKeyword.toUpperCase()));
        }

        if (files.length === 0) {
            return { success: false, message: 'No matching files found.' };
        }

        let sorted;
        if (useExif) {
            const withDates = await Promise.all(
                files.map(async filename => {
                    const filePath = path.join(directory, filename);
                    const date = await this.getImageDate(filePath, filename);
                    return { filename, filePath, date };
                })
            );
            withDates.sort((a, b) => {
                if (!a.date && !b.date) return 0;
                if (!a.date) return 1;
                if (!b.date) return -1;
                return b.date - a.date;
            });
            sorted = withDates;
        } else {
            sorted = files.sort().reverse().map(filename => ({
                filename,
                filePath: path.join(directory, filename)
            }));
        }

        if (sorted.length < n) {
            return { success: false, message: `Only ${sorted.length} file(s) available.` };
        }

        const target = sorted[n - 1];
        const fileBuffer = await fs.readFile(target.filePath);
        const stats = await fs.stat(target.filePath);

        return {
            success: true,
            fileBuffer,
            filename: target.filename,
            size: stats.size,
            modified: stats.mtime,
            dateTaken: target.date ?? null,
            mimeType: this.getMimeType(target.filename)
        };
    }

    /**
     * List files in a directory, optionally filtered by a keyword.
     * Returns an empty array if the directory does not exist.
     * @param {string} directory       - Absolute directory to list
     * @param {string} [filterKeyword] - Optional case-insensitive substring filter
     * @returns {string[]} Matching filenames
     */
    async listFiles(directory, filterKeyword) {
        const fs = require('fs').promises;

        try {
            await fs.access(directory);
        } catch {
            return [];
        }

        let files = (await fs.readdir(directory)).filter(f =>
            this.validateFileType(f, this.imageFormats)
        );

        if (filterKeyword) {
            files = files.filter(f => f.toUpperCase().includes(filterKeyword.toUpperCase()));
        }

        return files;
    }

    /**
     * Delete a file at the given absolute path. Fails if file does not exist.
     * @param {string} filePath - Absolute path to the file
     * @returns {Object} { success, message }
     */
    async deleteFile(filePath) {
        const fs = require('fs').promises;

        try {
            await fs.access(filePath);
        } catch {
            return { success: false, message: `File not found: ${filePath}` };
        }

        await fs.unlink(filePath);

        return {
            success: true,
            message: `Deleted ${path.basename(filePath)}`
        };
    }




    // Primitives

    /**
     * Read a single file at a known absolute path.
     * @param {string} filePath - Absolute path to the file
     * @returns {Object} { success, fileBuffer, filename, size, modified, mimeType }
     */
    async readFileByPath(filePath) {
        const fs = require('fs').promises;

        try {
            await fs.access(filePath);
        } catch {
            return { success: false, message: `File not found: ${filePath}` };
        }

        const fileBuffer = await fs.readFile(filePath);
        const stats = await fs.stat(filePath);

        return {
            success: true,
            fileBuffer,
            filename: path.basename(filePath),
            size: stats.size,
            modified: stats.mtime,
            mimeType: this.getMimeType(filePath)
        };
    }

    /**
     * Save a file with an exact pre-determined name. Fails if file already exists.
     * @param {string}   directory      - Absolute directory to save into
     * @param {string}   filename       - Exact filename to save as
     * @param {Buffer}   fileBuffer     - File contents
     * @param {string[]} [allowedFormats] - If provided, validates file extension before saving
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async saveFileStrict(directory, filename, fileBuffer, allowedFormats) {
        const fs = require('fs').promises;

        if (allowedFormats && !this.validateFileType(filename, allowedFormats)) {
            return { success: false, message: `Invalid format. Allowed: ${allowedFormats.join(', ')}` };
        }

        await this.ensureDirectoryExists(directory);
        const filePath = path.join(directory, filename);

        try {
            await fs.access(filePath);
            return { success: false, message: `File '${filename}' already exists.` };
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        await fs.writeFile(filePath, fileBuffer);

        return {
            success: true,
            absolutePath: filePath,
            relativePath: path.relative(this.basePath, filePath).replace(/\\/g, '/'),
            filename,
            message: `Saved ${filename}`
        };
    }




















    _resolveImageDomain(domain, id) {
        const config = this.IMAGE_DOMAIN_CONFIG[domain];
        if (!config) throw new Error(`Unknown image domain: ${domain}`);
        return {
            directory: config.getDirectory(id),
            baseFilename: (filter) => config.getBaseFilename(id, filter),
        };
    }

        
    /**
     * Save an image for a domain record. Never overwrites — appends a counter if filename already exists.
     * @param {Object} params
     * @param {string} params.domain           - Image domain key (e.g. 'medical', 'cow')
     * @param {string|number} params.recordId  - Record ID or cow tag
     * @param {string} params.filter           - Keyword embedded in filename (e.g. 'ISSUE', 'HEAD', 'BODY')
     * @param {Buffer} params.fileBuffer       - File contents
     * @param {string} params.originalFilename - Used for extension and format validation
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async saveImage({ domain, recordId, filter, fileBuffer, originalFilename, failIfExists = false }) {
        const { directory, baseFilename } = this._resolveImageDomain(domain, recordId);
        const ext = path.extname(originalFilename);

        if (failIfExists) {
            const filename = `${baseFilename(filter)}${ext}`;
            return this.saveFileStrict(directory, filename, fileBuffer, this.imageFormats);
        }

        const filePath = await this.resolveUniquePath(directory, baseFilename(filter), ext);
        return this.writeFile(filePath, fileBuffer, originalFilename, this.imageFormats);
    }


    /**
     * Get the nth most recent image for a domain record, optionally filtered by keyword.
     * @param {Object} params
     * @param {string} params.domain          - Image domain key
     * @param {string|number} params.recordId - Record ID or cow tag
     * @param {string} [params.filter]        - Optional case-insensitive filename substring filter
     * @param {number} [params.n=1]           - 1 = most recent
     * @returns {Object} { success, fileBuffer, filename, size, modified, dateTaken, mimeType }
     */
    async getImage({ domain, recordId, filter, n = 1 }) {
        const { directory } = this._resolveImageDomain(domain, recordId);
        return this.readFile(directory, filter, n, false);
    }


    /**
     * Get the count of images for a domain record, optionally filtered by keyword.
     * @param {Object} params
     * @param {string} params.domain          - Image domain key
     * @param {string|number} params.recordId - Record ID or cow tag
     * @param {string} [params.filter]        - Optional filename substring filter
     * @returns {Object} { success, total }
     */
    async getImageCount({ domain, recordId, filter }) {
        const { directory } = this._resolveImageDomain(domain, recordId);
        const files = await this.listFiles(directory, filter);
        return { success: true, total: files.length };
    }


    /**
     * Delete a specific image by filename for a domain record.
     * @param {Object} params
     * @param {string} params.domain          - Image domain key
     * @param {string|number} params.recordId - Record ID or cow tag
     * @param {string} params.filename        - Exact filename to delete
     * @returns {Object} { success, message }
     */
    async deleteImage({ domain, recordId, filename }) {
        const { directory } = this._resolveImageDomain(domain, recordId);
        return this.deleteFile(path.join(directory, filename));
    }


    /**
     * List image filenames for a domain record, optionally filtered by keyword.
     * @param {Object} params
     * @param {string} params.domain          - Image domain key
     * @param {string|number} params.recordId - Record ID or cow tag
     * @param {string} [params.filter]        - Optional filename substring filter
     * @returns {Object} { success, files }
     */
    async listImages({ domain, recordId, filter }) {
        const { directory } = this._resolveImageDomain(domain, recordId);
        const files = await this.listFiles(directory, filter);
        return { success: true, files };
    }


    /**
     * Get a specific image by exact filename for a domain record.
     * @param {Object} params
     * @param {string} params.domain          - Image domain key
     * @param {string|number} params.recordId - Record ID or cow tag
     * @param {string} params.filename        - Exact filename to retrieve
     * @returns {Object} { success, fileBuffer, filename, size, modified, mimeType }
     */
    async getImageByName({ domain, recordId, filename }) {
        const { directory } = this._resolveImageDomain(domain, recordId);
        return this.readFileByPath(path.join(directory, filename));
    }














    _resolveFileDomain(domain, id) {
        const config = this.FILE_DOMAIN_CONFIG[domain];
        if (!config) throw new Error(`Unknown file domain: ${domain}`);
        return { directory: config.getDirectory(id) };
    }

    /**
     * Save a file for a domain record. Always fails if filename already exists.
     * @param {Object} params
     * @param {string} params.domain    - File domain key (e.g. 'medicalUpload')
     * @param {string} params.recordId  - Record ID
     * @param {string} params.filename  - Exact filename to save as
     * @param {Buffer} params.fileBuffer - File contents
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async saveFile({ domain, recordId, filename, fileBuffer }) {
        const { directory } = this._resolveFileDomain(domain, recordId);
        return this.saveFileStrict(directory, filename, fileBuffer);
    }

    /**
     * Get a specific file by filename for a domain record.
     * @param {Object} params
     * @param {string} params.domain   - File domain key
     * @param {string} params.recordId - Record ID
     * @param {string} params.filename - Exact filename to retrieve
     * @returns {Object} { success, fileBuffer, filename, size, modified, mimeType }
     */
    async getFile({ domain, recordId, filename }) {
        const { directory } = this._resolveFileDomain(domain, recordId);
        return this.readFileByPath(path.join(directory, filename));
    }

    /**
     * Delete a specific file by filename for a domain record.
     * @param {Object} params
     * @param {string} params.domain   - File domain key
     * @param {string} params.recordId - Record ID
     * @param {string} params.filename - Exact filename to delete
     * @returns {Object} { success, message }
     */
    async deleteDomainFile({ domain, recordId, filename }) {
        const { directory } = this._resolveFileDomain(domain, recordId);
        return this.deleteFile(path.join(directory, filename));
    }

    /**
     * List all files for a domain record.
     * @param {Object} params
     * @param {string} params.domain   - File domain key
     * @param {string} params.recordId - Record ID
     * @returns {Object} { success, files }
     */
    async listDomainFiles({ domain, recordId }) {
        const fs = require('fs').promises;
        const { directory } = this._resolveFileDomain(domain, recordId);
        try {
            await fs.access(directory);
            const files = await fs.readdir(directory);
            return { success: true, files };
        } catch {
            return { success: true, files: [] };
        }
    }


    






























    /**
     * Get map data and available map image URLs, optionally with coordinates for a specific pasture.
     * @param {Object} [params]
     * @param {string} [params.pastureName] - Optional pasture name to look up pinpoint coordinates
     * @returns {Object} { success, availableMaps, fieldData, coordinates, pastureName }
     */
    async getMap(params = {}) {
        const fs = require('fs').promises;
        const { pastureName } = params;

        try {
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
                } catch {
                    console.log(`Map file ${mapFile} not found`);
                }
            }

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
            } catch {
                console.log('MapData.json not found or invalid');
            }

            return {
                success: true,
                availableMaps,
                fieldData,
                coordinates: normalizedCoordinates,
                pastureName
            };
        } catch (error) {
            console.error('Error getting map:', error);
            return { success: false, message: `Failed to get map: ${error.message}` };
        }
    }




    // USER MANAGEMENT 


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

    async readoutUsersJSON() {
        try {
            const content = await fs.readFile(this.usersFile, 'utf8');
            const users = this.parseUsersCSV(content);

            return {
                success: true,
                users: users.map(user => ({
                    id: user.id,
                    username: user.username,
                    Email: user.email,
                    PasswordHash: user.passwordHash,
                    Permissions: user.permissions.join('|'),
                    Blocked: user.blocked
                }))
            };
        } catch (error) {
            console.error('Error reading users CSV:', error);
            return {
                success: false,
                message: `Failed to read users: ${error.message}`
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

        if (!userPermissions || !Array.isArray(userPermissions) || !userPermissions.includes('dev')) {
            return {
                success: false,
                message: 'Access denied: dev permission required',
                code: 'FORBIDDEN'
            };
        }

        const { hasDevConnection, getDevConnection } = require('./db');
        const fs = require('fs');

        if (!hasDevConnection()) {
            return {
                success: false,
                message: 'No active database connection. Please connect first.',
                code: 'NO_CONNECTION'
            };
        }

        try {
            const pool = getDevConnection();

            await this.createBackupTable();

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

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${process.env.DB_DATABASE}_backup_${timestamp}.bak`;
            const backupFilePath = path.join(sqlBackupDir, backupFileName);
            const escapedPath = path.resolve(backupFilePath).replace(/\\/g, '\\\\');

            // STEP 1: Create the .bak file
            const backupQuery = `
                BACKUP DATABASE [${process.env.DB_DATABASE}] 
                TO DISK = N'${escapedPath}' 
                WITH FORMAT, INIT, 
                NAME = 'Full Backup', 
                DESCRIPTION = 'Backup created via dev console'
            `;

            await pool.request().query(backupQuery);
            console.log(`✓ Backup file created: ${backupFilePath}`);

            // STEP 2: Get file size from disk directly — no SQL permissions needed
            const backupSize = fs.statSync(backupFilePath).size;

            // STEP 3: Record metadata — OUTPUT clause avoids SCOPE_IDENTITY() scope issues with tedious
            const insertQuery = `
                INSERT INTO DatabaseBackups (DatabaseName, BackupFileName, BackupFilePath, BackupSize)
                OUTPUT INSERTED.BackupID
                VALUES (
                    '${process.env.DB_DATABASE}',
                    '${backupFileName}',
                    '${backupFilePath}',
                    ${backupSize}
                );
            `;

            const result = await pool.request().query(insertQuery);
            const backupID = result.recordset[0]?.BackupID;

            console.log(`✓ Backup metadata recorded (BackupID: ${backupID}, Size: ${backupSize} bytes)`);

            return {
                success: true,
                message: 'Database backed up successfully',
                backupID,
                backupFileName,
                backupFilePath,
                backupSize,
                database: process.env.DB_DATABASE,
                permanent: {
                    location: sqlBackupDir,
                    note: 'Backup file saved to SQL Server backup directory'
                }
            };

        } catch (error) {
            console.error('Error backing up database:', error);
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
                const result = await pool.request().query(`
                    SELECT BackupID, DatabaseName, BackupFileName, BackupFilePath, BackupDate, BackupSize
                    FROM DatabaseBackups
                    WHERE BackupID = ${backupID}
                `);

                if (!result.recordset || result.recordset.length === 0) {
                    return {
                        success: false,
                        message: `Backup with ID ${backupID} not found`,
                        code: 'NOT_FOUND'
                    };
                }

                backup = result.recordset[0];
            }
            // Otherwise create a fresh backup
            else {
                console.log('Creating new backup for download...');

                const backupResult = await this.backupSqlDatabase({ userPermissions });

                if (!backupResult.success) {
                    return backupResult;
                }

                const result = await pool.request().query(`
                    SELECT BackupID, DatabaseName, BackupFileName, BackupFilePath, BackupDate, BackupSize
                    FROM DatabaseBackups
                    WHERE BackupID = ${backupResult.backupID}
                `);

                if (!result.recordset || result.recordset.length === 0) {
                    return {
                        success: false,
                        message: 'Backup was created but could not be retrieved',
                        code: 'INTERNAL_ERROR'
                    };
                }

                backup = result.recordset[0];
            }

            return {
                success: true,
                message: 'Database backup ready',
                fileName: backup.BackupFileName,
                fileSize: backup.BackupSize,
                filePath: backup.BackupFilePath,
                database: backup.DatabaseName,
                backupDate: backup.BackupDate,
                backupID: backup.BackupID
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
    // Utilities
    configureMulter: () => localOps.configureMulter(),
    remCowtagSlash: (cowTag) => localOps.remCowtagSlash(cowTag),
    repCowtagSlash: (fileSystemCowTag) => localOps.repCowtagSlash(fileSystemCowTag),

    // image operations
    saveImage: (params) => localOps.saveImage(params),
    getImage: (params) => localOps.getImage(params),
    getImageCount: (params) => localOps.getImageCount(params),
    deleteImage: (params) => localOps.deleteImage(params),
    listImages: (params) => localOps.listImages(params),
    getImageByName: (params) => localOps.getImageByName(params),

    // file save/load operations
    saveFile: (params) => localOps.saveFile(params),
    getFile: (params) => localOps.getFile(params),
    deleteDomainFile: (params) => localOps.deleteDomainFile(params),
    listDomainFiles: (params) => localOps.listDomainFiles(params),


    // Maps
    getMap: (params) => localOps.getMap(params),

    // User management
    checkUsers: () => localOps.checkUsers(),
    readoutUsersJSON: () => localOps.readoutUsersJSON(),


    getBackendLog: () => localOps.getBackendLog(),
    getFrontendLog: () => localOps.getFrontendLog(),
    clearBackendLog: () => localOps.clearBackendLog(),
    clearFrontendLog: () => localOps.clearFrontendLog(),

    executeConsoleCommand: (params) => localOps.executeConsoleCommand(params),
    connectSqlServer: (params) => localOps.connectSqlServer(params),
    executeSqlQuery: (params) => localOps.executeSqlQuery(params),
    closeDevSqlConnection: (params) => localOps.closeDevSqlConnection(params),
    backupSqlDatabase: (params) => localOps.backupSqlDatabase(params),
    getSqlDatabase: (params) => localOps.getSqlDatabase(params),

};