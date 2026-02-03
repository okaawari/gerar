const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Max dimension for product images (width and height)
const PRODUCT_IMAGE_MAX_DIMENSION = 300;

/** Generate a short, recognizable filename for product images: img-<id>.webp */
function generateProductImageFilename() {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return `img-${id}.webp`;
}

// Use memory storage so we can process images (resize + webp) before writing
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

/**
 * Process uploaded image(s): resize to max 300x300 and convert to .webp.
 * Writes to disk and sets filename on req.file / req.files for URL response.
 */
const processImageToWebp = async (req, res, next) => {
    try {
        const processOne = async (file) => {
            if (!file.buffer) return;
            const filename = generateProductImageFilename();
            const filePath = path.join(uploadsDir, filename);
            await sharp(file.buffer)
                .resize(PRODUCT_IMAGE_MAX_DIMENSION, PRODUCT_IMAGE_MAX_DIMENSION, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality: 85 })
                .toFile(filePath);
            file.filename = filename;
            file.path = filePath;
            file.mimetype = 'image/webp';
        };

        if (req.file) {
            await processOne(req.file);
        } else if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await processOne(file);
            }
        }
        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Middleware for single file upload
 * Uses upload.any() to accept any field name, then takes the first file
 * This ensures the file is only processed once
 */
const uploadSingle = upload.any();

// Wrapper to normalize req.file from req.files
const normalizeSingleUpload = (req, res, next) => {
    // upload.any() puts files in req.files array
    // Get the first file (since we only expect one)
    // If multiple files are sent, only process the first one
    if (req.files && req.files.length > 0) {
        req.file = req.files[0];
        // Log warning if multiple files were sent (shouldn't happen for single upload)
        if (req.files.length > 1) {
            console.warn(`Warning: Multiple files received in single upload endpoint. Processing only the first file.`);
        }
    }
    next();
};

/**
 * Middleware for multiple file uploads
 */
const uploadMultiple = upload.array('files', 10); // Max 10 files

/**
 * Get the correct base URL for file uploads
 * Handles proxy scenarios and forces HTTPS for production domains
 */
const getBaseUrl = (req) => {
    let baseUrl;
    
    // First, check if API_BASE_URL is explicitly set in environment
    if (process.env.API_BASE_URL) {
        baseUrl = process.env.API_BASE_URL;
    } else if (process.env.BASE_URL) {
        baseUrl = process.env.BASE_URL;
    } else {
        // Determine protocol - check x-forwarded-proto header first (for reverse proxies)
        let protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host') || '';
        
        // Force HTTPS for production domains
        if (host.includes('api.gerar.mn') || host.includes('gerar.mn')) {
            protocol = 'https';
        }
        
        // Ensure protocol is https or http
        protocol = protocol === 'https' ? 'https' : 'http';
        baseUrl = `${protocol}://${host}`;
    }
    
    // Force HTTPS for production domains even if env var is set to HTTP
    // This ensures production always uses HTTPS regardless of configuration
    if (baseUrl && (baseUrl.includes('api.gerar.mn') || baseUrl.includes('gerar.mn'))) {
        baseUrl = baseUrl.replace(/^http:\/\//, 'https://');
    }
    
    return baseUrl;
};

/**
 * Upload a single file
 * POST /api/admin/upload
 */
const uploadFile = async (req, res, next) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            const error = new Error('No file uploaded');
            error.statusCode = 400;
            throw error;
        }

        // Get base URL from environment or request
        const baseUrl = getBaseUrl(req);
        
        // Construct file URL
        // Remove /api from base URL if present, as uploads are served from root
        const cleanBaseUrl = baseUrl.replace(/\/api$/, '');
        const fileUrl = `${cleanBaseUrl}/uploads/${req.file.filename}`;

        // Return response in multiple formats for compatibility
        res.status(200).json({
            success: true,
            data: {
                url: fileUrl
            },
            url: fileUrl, // Alternative format
            imageUrl: fileUrl, // Alternative format
            path: `/uploads/${req.file.filename}` // Relative path
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Upload multiple files
 * POST /api/admin/upload/multiple
 */
const uploadFiles = async (req, res, next) => {
    try {
        // Check if files were uploaded
        if (!req.files || req.files.length === 0) {
            const error = new Error('No files uploaded');
            error.statusCode = 400;
            throw error;
        }

        // Get base URL from environment or request
        const baseUrl = getBaseUrl(req);
        
        // Remove /api from base URL if present
        const cleanBaseUrl = baseUrl.replace(/\/api$/, '');

        // Construct file URLs
        const fileUrls = req.files.map(file => ({
            url: `${cleanBaseUrl}/uploads/${file.filename}`,
            filename: file.filename,
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype
        }));

        res.status(200).json({
            success: true,
            data: {
                files: fileUrls,
                urls: fileUrls.map(f => f.url) // Array of URLs only
            },
            files: fileUrls // Alternative format
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete an uploaded image
 * POST /api/admin/upload/delete
 */
const deleteImage = async (req, res, next) => {
    try {
        const { imageUrl, path: imagePath } = req.body;

        // Validate that at least one identifier is provided
        if (!imageUrl && !imagePath) {
            const error = new Error('Either imageUrl or path is required');
            error.statusCode = 400;
            throw error;
        }

        // Extract filename from URL or path
        let filename;
        if (imagePath) {
            // Extract filename from path (e.g., "/uploads/image.jpg" -> "image.jpg")
            filename = path.basename(imagePath);
        } else if (imageUrl) {
            // Extract filename from URL (e.g., "https://api.gerar.mn/uploads/image.jpg" -> "image.jpg")
            // Handle both absolute URLs and relative paths
            const urlPath = imageUrl.includes('/uploads/') 
                ? imageUrl.split('/uploads/')[1] 
                : imageUrl;
            filename = path.basename(urlPath);
        }

        // Validate filename (security: prevent directory traversal)
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            const error = new Error('Invalid filename');
            error.statusCode = 400;
            throw error;
        }

        // Construct full file path
        const filePath = path.join(uploadsDir, filename);

        // Security check: ensure the file is within the uploads directory
        const resolvedPath = path.resolve(filePath);
        const resolvedUploadsDir = path.resolve(uploadsDir);
        if (!resolvedPath.startsWith(resolvedUploadsDir)) {
            const error = new Error('Invalid file path');
            error.statusCode = 403;
            throw error;
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            // File doesn't exist - return success anyway (idempotent)
            return res.status(200).json({
                success: true,
                message: 'Image deleted successfully (file did not exist)',
                data: {
                    filename,
                    deleted: false,
                    reason: 'File not found'
                }
            });
        }

        // Delete the file
        fs.unlinkSync(filePath);

        res.status(200).json({
            success: true,
            message: 'Image deleted successfully',
            data: {
                filename,
                deleted: true
            }
        });
    } catch (error) {
        // Handle filesystem errors
        if (error.code === 'ENOENT') {
            // File not found - return success (idempotent)
            return res.status(200).json({
                success: true,
                message: 'Image deleted successfully (file did not exist)',
                data: {
                    deleted: false,
                    reason: 'File not found'
                }
            });
        }

        // Handle permission errors
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            error.statusCode = 403;
            error.message = 'Permission denied. Cannot delete file.';
        }

        next(error);
    }
};

/**
 * Handle multer errors
 */
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            const error = new Error('File too large. Maximum size is 10MB.');
            error.statusCode = 400;
            return next(error);
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            const error = new Error('Too many files. Maximum is 10 files.');
            error.statusCode = 400;
            return next(error);
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            const error = new Error('Unexpected file field name.');
            error.statusCode = 400;
            return next(error);
        }
    }
    
    // Handle file filter errors
    if (err.message && err.message.includes('Invalid file type')) {
        err.statusCode = 400;
        return next(err);
    }
    
    next(err);
};

module.exports = {
    uploadSingle,
    uploadMultiple,
    uploadFile,
    uploadFiles,
    deleteImage,
    handleUploadError,
    normalizeSingleUpload,
    processImageToWebp
};
