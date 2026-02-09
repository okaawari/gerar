const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Jimp } = require('jimp');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../public/uploads');
const bannersSubdir = 'banners'; // Banner images go under uploads/banners/
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
// Ensure banners subfolder exists for banner-desktop / banner-mobile uploads
const bannersDir = path.join(uploadsDir, bannersSubdir);
if (!fs.existsSync(bannersDir)) {
    fs.mkdirSync(bannersDir, { recursive: true });
}

// Max dimension presets for image types (width and height)
const IMAGE_DIMENSIONS = {
    product: { w: 300, h: 300 },
    'banner-desktop': { w: 1920, h: 600 },
    'banner-mobile': { w: 768, h: 400 }
};

/** Generate a short, recognizable filename for product images: img-<id>.jpg */
function generateProductImageFilename() {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return `img-${id}.jpg`;
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
 * Process uploaded image(s): resize to max 300x300 (fit inside, no enlargement) and save as JPEG.
 * Uses default Jimp (pure JS, no WASM/fetch) so it runs in Node on any host including old shared hosting.
 */
const processImageToWebp = async (req, res, next) => {
    try {
        const imageType = (req.body && req.body.imageType) ? String(req.body.imageType) : 'product';
        const dimensions = IMAGE_DIMENSIONS[imageType] || IMAGE_DIMENSIONS.product;
        const isBanner = imageType === 'banner-desktop' || imageType === 'banner-mobile';
        const targetDir = isBanner ? bannersDir : uploadsDir;
        const processOne = async (file) => {
            if (!file.buffer) return;
            const baseFilename = generateProductImageFilename();
            const filePath = path.join(targetDir, baseFilename);
            const image = await Jimp.read(file.buffer);
            const w = image.bitmap.width;
            const h = image.bitmap.height;
            if (w > dimensions.w || h > dimensions.h) {
                image.scaleToFit({ w: dimensions.w, h: dimensions.h });
            }
            await image.write(filePath, { quality: 85 });
            // Response URL uses /uploads/<filename>; for banners use subpath so file is in uploads/banners/
            file.filename = isBanner ? path.join(bannersSubdir, baseFilename).split(path.sep).join('/') : baseFilename;
            file.path = filePath;
            file.mimetype = 'image/jpeg';
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

        // Extract relative path under uploads (e.g. "image.jpg" or "banners/image.jpg")
        let relativePath;
        if (imagePath) {
            relativePath = imagePath.replace(/^\/uploads\/?/, '').replace(/\\/g, '/').trim() || path.basename(imagePath);
        } else if (imageUrl) {
            const suffix = imageUrl.includes('/uploads/') ? imageUrl.split('/uploads/')[1] : imageUrl;
            relativePath = (suffix || '').replace(/\\/g, '/').trim() || path.basename(imageUrl);
        }
        if (!relativePath) {
            const error = new Error('Could not determine file path');
            error.statusCode = 400;
            throw error;
        }
        // Security: no directory traversal; allow only filenames or "banners/" subfolder
        const normalized = path.normalize(relativePath).replace(/\\/g, '/');
        if (normalized.includes('..') || normalized.startsWith('/') || /[\0]/.test(normalized)) {
            const error = new Error('Invalid filename or path');
            error.statusCode = 400;
            throw error;
        }
        // Only allow one optional "banners/" prefix and a simple filename
        if (!/^(?:banners\/)?[a-zA-Z0-9_.-]+$/.test(normalized)) {
            const error = new Error('Invalid filename or path');
            error.statusCode = 400;
            throw error;
        }
        const filename = path.basename(relativePath);

        // Construct full file path (supports uploads/ and uploads/banners/)
        const filePath = path.join(uploadsDir, normalized);

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
