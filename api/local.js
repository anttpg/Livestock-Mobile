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
        this.medicalDir = path.join(this.basePath, 'Medical');
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





    /**
     * Save a cow image. Never overwrites — appends a counter if filename already exists.
     * @param {Object} params
     * @param {string} params.cowTag           - Cow tag identifier
     * @param {string} params.imageType        - "headshot" or "body"
     * @param {Buffer} params.fileBuffer       - File contents
     * @param {string} params.originalFilename - Original filename, used for extension and format validation
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async saveCowImage({ cowTag, imageType, fileBuffer, originalFilename }) {
        const safeTag = this.remCowtagSlash(cowTag);
        const bodyType = imageType === 'headshot' ? 'HEAD' : 'BODY';
        const directory = path.join(this.cowPhotosDir, safeTag);
        const baseFilename = `${safeTag} ${bodyType} ${this.formatDateForFilename()}`;

        const filePath = await this.resolveUniquePath(directory, baseFilename, path.extname(originalFilename));
        return this.writeFile(filePath, fileBuffer, originalFilename, this.imageFormats);
    }

    /**
     * Get the nth most recent cow image of a given type, sorted by EXIF date.
     * @param {Object} params
     * @param {string} params.cowTag      - Cow tag identifier
     * @param {string} params.imageType   - "headshot" or "body"
     * @param {number} [params.n=1]       - 1 = most recent
     * @returns {Object} { success, fileBuffer, filename, size, modified, dateTaken, mimeType }
     */
    async getCowImage({ cowTag, imageType, n = 1 }) {
        const safeTag = this.remCowtagSlash(cowTag);
        const directory = path.join(this.cowPhotosDir, safeTag);
        const filterKeyword = imageType === 'headshot' ? ' HEAD ' : ' BODY ';
        return this.readFile(directory, filterKeyword, n, true);
    }

    /**
     * Get all headshot and bodyshot filenames for a cow.
     * @param {Object} params
     * @param {string} params.cowTag - Cow tag identifier
     * @returns {Object} { success, images: { headshots, bodyshots }, totalImages }
     */
    async getAllCowImages({ cowTag }) {
        const safeTag = this.remCowtagSlash(cowTag);
        const directory = path.join(this.cowPhotosDir, safeTag);

        const headshots = await this.listFiles(directory, ' HEAD ');
        const bodyshots = await this.listFiles(directory, ' BODY ');

        return {
            success: true,
            images: { headshots, bodyshots },
            totalImages: headshots.length + bodyshots.length
        };
    }

    /**
     * Delete a specific cow image by filename.
     * @param {Object} params
     * @param {string} params.cowTag  - Cow tag identifier
     * @param {string} params.filename - Exact filename to delete
     * @returns {Object} { success, message }
     */
    async deleteCowImage({ cowTag, filename }) {
        const safeTag = this.remCowtagSlash(cowTag);
        const filePath = path.join(this.cowPhotosDir, safeTag, filename);
        return this.deleteFile(filePath);
    }


    /**
     * Delete a cow image by its recency index.
     * Resolves the nth most recent image of the given type and deletes it by filename.
     * @param {Object} params
     * @param {string} params.cowTag    - Cow tag identifier
     * @param {string} params.imageType - Image type keyword filter (e.g. 'headshot', 'bodyshot')
     * @param {number} params.n         - 1-based index (1 = most recent)
     * @returns {Object} { success, message }
     */
    async deleteCowImageByIndex({ cowTag, imageType, n }) {
        const safeTag = this.remCowtagSlash(cowTag);
        const directory = path.join(this.cowPhotosDir, safeTag);
        const filterKeyword = imageType === 'headshot' ? ' HEAD ' : ' BODY ';
        const found = await this.readFile(directory, filterKeyword, n, true);
        if (!found.success) return found;
        return this.deleteCowImage({ cowTag, filename: found.filename });
    }








    /**
     * Save a medical issue image for a record. Never overwrites — appends a counter if filename already exists.
     * @param {Object} params
     * @param {string} params.recordId         - Medical record ID
     * @param {Buffer} params.fileBuffer       - File contents
     * @param {string} params.originalFilename - Original filename, used for extension and format validation
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async saveMedicalImage({ recordId, fileBuffer, originalFilename }) {
        const directory = path.join(this.medicalDir, `Record_${recordId}`);
        const baseFilename = `Record_${recordId}_ISSUE_${this.formatDateForFilename()}`;

        const filePath = await this.resolveUniquePath(directory, baseFilename, path.extname(originalFilename));
        return this.writeFile(filePath, fileBuffer, originalFilename, this.imageFormats);
    }

    /**
     * Get the nth most recent medical issue image for a record, sorted by filename date.
     * @param {Object} params
     * @param {string} params.recordId - Medical record ID
     * @param {number} [params.n=1]    - 1 = most recent
     * @returns {Object} { success, fileBuffer, filename, size, modified, dateTaken, mimeType }
     */
    async getMedicalImage({ recordId, n = 1 }) {
        const directory = path.join(this.medicalDir, `Record_${recordId}`);
        return this.readFile(directory, 'ISSUE', n, false);
    }

    /**
     * Get the count of medical issue images for a record.
     * @param {Object} params
     * @param {string} params.recordId - Medical record ID
     * @returns {Object} { success, issues, total }
     */
    async getMedicalImageCount({ recordId }) {
        const directory = path.join(this.medicalDir, `Record_${recordId}`);
        const issues = await this.listFiles(directory, 'ISSUE');

        return {
            success: true,
            issues: issues.length,
            total: issues.length
        };
    }

    /**
     * Delete a specific medical issue image by filename.
     * @param {Object} params
     * @param {string} params.recordId - Medical record ID
     * @param {string} params.filename - Exact filename to delete
     * @returns {Object} { success, message }
     */
    async deleteMedicalImage({ recordId, filename }) {
        const filePath = path.join(this.medicalDir, `Record_${recordId}`, filename);
        return this.deleteFile(filePath);
    }



    // /**
    //  * Delete a medical issue image by its recency index.
    //  * Resolves the nth most recent ISSUE image and deletes it by filename.
    //  * @param {Object} params
    //  * @param {string} params.recordId - Medical record ID
    //  * @param {number} params.n        - 1-based index (1 = most recent)
    //  * @returns {Object} { success, message }
    //  */
    // async deleteMedicalImageByIndex({ recordId, n }) {
    //     const directory = path.join(this.medicalDir, `Record_${recordId}`);
    //     const found = await this.readFile(directory, 'ISSUE', n, false);
    //     if (!found.success) return found;
    //     return this.deleteMedicalImage({ recordId, filename: found.filename });
    // }











    
    /**
     * Save a generic file to a medical record's Uploads folder.
     * File must be pre-named. Fails if a file with the same name already exists.
     * @param {Object} params
     * @param {string} params.recordId   - Medical record ID
     * @param {Buffer} params.fileBuffer - File contents
     * @param {string} params.filename   - Exact filename to save as
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async saveMedicalUpload({ recordId, fileBuffer, filename }) {
        const directory = path.join(this.medicalDir, `Record_${recordId}`, 'Uploads');
        return this.saveFileStrict(directory, filename, fileBuffer);
    }


    /**
     * Get a specific upload file from a medical record by filename.
     * @param {Object} params
     * @param {string} params.recordId - Medical record ID
     * @param {string} params.filename - Exact filename to retrieve
     * @returns {Object} { success, fileBuffer, filename, size, modified, mimeType }
     */
    async getMedicalUpload({ recordId, filename }) {
        const fs = require('fs').promises;
        const directory = path.join(this.medicalDir, `Record_${recordId}`, 'Uploads');
        const filePath = path.join(directory, filename);

        try {
            await fs.access(filePath);
        } catch {
            return { success: false, message: `File '${filename}' not found for record ${recordId}.` };
        }

        const fileBuffer = await fs.readFile(filePath);
        const stats = await fs.stat(filePath);

        return {
            success: true,
            fileBuffer,
            filename,
            size: stats.size,
            modified: stats.mtime,
            mimeType: this.getMimeType(filename)
        };
    }

    /**
     * Delete a specific upload file from a medical record by filename.
     * @param {Object} params
     * @param {string} params.recordId - Medical record ID
     * @param {string} params.filename - Exact filename to delete
     * @returns {Object} { success, message }
     */
    async deleteMedicalUpload({ recordId, filename }) {
        const filePath = path.join(this.medicalDir, `Record_${recordId}`, 'Uploads', filename);
        return this.deleteFile(filePath);
    }

    async listMedicalUploads({ recordId }) {
        const directory = path.join(this.medicalDir, `Record_${recordId}`, 'Uploads');
        const fs = require('fs').promises;
        try {
            await fs.access(directory);
            const files = await fs.readdir(directory);
            return { success: true, files };
        } catch {
            return { success: true, files: [] };
        }
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


    // Cow wrappers

    /**
     * Get the nth most recent image of a given type for a cow.
     * Pass type 'both' to retrieve the nth headshot and bodyshot together.
     * @param {Object} params
     * @param {string} params.cowTag    - Cow tag identifier
     * @param {string} params.type      - 'headshot', 'body', or 'both'
     * @param {number} [params.n=1]     - 1 = most recent
     * @returns {Object} Single image result, or { success, headshot, bodyshot } for 'both'
     */
    async getNthCowImage({ cowTag, type, n = 1 }) {
        if (type !== 'both') {
            return this.getCowImage({ cowTag, imageType: type, n });
        }

        const [headshot, bodyshot] = await Promise.all([
            this.getCowImage({ cowTag, imageType: 'headshot', n }),
            this.getCowImage({ cowTag, imageType: 'body', n })
        ]);

        return { success: true, headshot, bodyshot };
    }

    /**
     * Get count of headshot and bodyshot images for a cow.
     * @param {Object} params
     * @param {string} params.cowTag - Cow tag identifier
     * @returns {Object} { success, headshots, bodyshots, total }
     */
    async numCowImages({ cowTag }) {
        const safeTag = this.remCowtagSlash(cowTag);
        const directory = path.join(this.cowPhotosDir, safeTag);

        const [headshots, bodyshots] = await Promise.all([
            this.listFiles(directory, ' HEAD '),
            this.listFiles(directory, ' BODY ')
        ]);

        return {
            success: true,
            headshots: headshots.length,
            bodyshots: bodyshots.length,
            total: headshots.length + bodyshots.length
        };
    }


    // Medical upload wrappers


    // Map wrappers

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

    /**
     * Get a main map image by type.
     * @param {string} mapType - Map name without extension, e.g. 'map' or 'MapCombined'
     * @returns {Object} { success, fileBuffer, filename, size, modified, mimeType }
     */
    async getMapImage(mapType) {
        const filePath = path.join(this.mapDataDir, `${mapType}.png`);
        return this.readFileByPath(filePath);
    }

    /**
     * Upload a main map image. Fails if map of that type already exists.
     * @param {Object} params
     * @param {string} params.mapType    - 'map' or 'MapCombined'
     * @param {Buffer} params.fileBuffer - File contents
     * @param {string} params.filename   - Original filename, used for extension
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async uploadMap({ mapType, fileBuffer, filename }) {
        const validMapTypes = ['map', 'MapCombined'];
        if (!validMapTypes.includes(mapType)) {
            return { success: false, message: `Invalid map type. Allowed: ${validMapTypes.join(', ')}` };
        }

        const ext = path.extname(filename);
        const mapFilename = `${mapType}${ext}`;
        return this.saveFileStrict(this.mapDataDir, mapFilename, fileBuffer, this.imageFormats);
    }

    /**
     * Get a minimap for a specific field. Falls back to a partial name match if exact not found.
     * @param {Object} params
     * @param {string} params.fieldName - Field name to look up
     * @returns {Object} { success, fileBuffer, filename, fieldName, size, modified, mimeType }
     */
    async getMinimap({ fieldName }) {
        const exactPath = path.join(this.minimapsDir, `${fieldName}_minimap.png`);
        const exact = await this.readFileByPath(exactPath);

        if (exact.success) return { ...exact, fieldName };

        // Fuzzy fallback
        const all = await this.listFiles(this.minimapsDir, fieldName);
        const match = all.find(f => f.toLowerCase().includes('minimap'));

        if (!match) {
            return {
                success: false,
                message: `No minimap found for field "${fieldName}"`,
                availableFields: await this.getAvailableMinimaps()
            };
        }

        const result = await this.readFileByPath(path.join(this.minimapsDir, match));
        return { ...result, fieldName };
    }

    /**
     * Upload a minimap for a field. Fails if one already exists.
     * @param {Object} params
     * @param {string} params.fieldName  - Field name
     * @param {Buffer} params.fileBuffer - File contents
     * @param {string} params.filename   - Original filename, used for extension
     * @returns {Object} { success, relativePath, absolutePath, filename, message }
     */
    async uploadMinimap({ fieldName, fileBuffer, filename }) {
        const ext = path.extname(filename);
        const minimapFilename = `${fieldName}_minimap${ext}`;
        return this.saveFileStrict(this.minimapsDir, minimapFilename, fileBuffer, this.imageFormats);
    }

    /**
     * Get list of field names that have minimaps available.
     * @returns {string[]} Field names
     */
    async getAvailableMinimaps() {
        const files = await this.listFiles(this.minimapsDir, 'minimap');
        return files.map(f => f.replace(/_minimap\.(png|jpg|jpeg|gif|webp)$/i, ''));
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
    // Cow images
    saveCowImage: (params) => localOps.saveCowImage(params),
    getCowImage: (params) => localOps.getCowImage(params),
    getNthCowImage: (params) => localOps.getNthCowImage(params),
    getAllCowImages: (params) => localOps.getAllCowImages(params),
    numCowImages: (params) => localOps.numCowImages(params),
    deleteCowImage: (params) => localOps.deleteCowImage(params),
    // deleteCowImageByIndex: (params) => localOps.deleteCowImageByIndex(params),

    // Medical images
    saveMedicalImage: (params) => localOps.saveMedicalImage(params),
    getMedicalImage: (params) => localOps.getMedicalImage(params),
    getMedicalImageCount: (params) => localOps.getMedicalImageCount(params),
    deleteMedicalImage: (params) => localOps.deleteMedicalImage(params),
    // deleteMedicalImageByIndex: (params) => localOps.deleteMedicalImageByIndex(params),


    // Medical uploads
    saveMedicalUpload: (params) => localOps.saveMedicalUpload(params),
    getMedicalUpload: (params) => localOps.getMedicalUpload(params),
    deleteMedicalUpload: (params) => localOps.deleteMedicalUpload(params),
    listMedicalUploads: (params) => localOps.listMedicalUploads(params),


    // Maps
    getMap: (params) => localOps.getMap(params),
    getMapImage: (mapType) => localOps.getMapImage(mapType),
    uploadMap: (params) => localOps.uploadMap(params),
    getMinimap: (params) => localOps.getMinimap(params),
    getAvailableMinimaps: () => localOps.getAvailableMinimaps(),
    uploadMinimap: (params) => localOps.uploadMinimap(params),

    // Utilities
    configureMulter: () => localOps.configureMulter(),
    remCowtagSlash: (cowTag) => localOps.remCowtagSlash(cowTag),
    repCowtagSlash: (fileSystemCowTag) => localOps.repCowtagSlash(fileSystemCowTag),


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
    preRegisterUser: (params) => localOps.preRegisterUser(params),

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