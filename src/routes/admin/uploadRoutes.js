const express = require('express');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');
const {
    uploadSingle,
    uploadMultiple,
    uploadFile,
    uploadFiles,
    deleteImage,
    handleUploadError,
    normalizeSingleUpload,
    processImageToWebp
} = require('../../controllers/uploadController');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

// Single file upload endpoint
// Chain: uploadSingle -> normalizeSingleUpload -> processImageToWebp -> uploadFile
// Multer errors are handled by the error handler middleware
router.post('/', 
    (req, res, next) => {
        uploadSingle(req, res, (err) => {
            if (err) {
                return handleUploadError(err, req, res, next);
            }
            next();
        });
    },
    normalizeSingleUpload,
    processImageToWebp,
    uploadFile
);

// Multiple files upload endpoint
router.post('/multiple',
    (req, res, next) => {
        uploadMultiple(req, res, (err) => {
            if (err) {
                return handleUploadError(err, req, res, next);
            }
            next();
        });
    },
    processImageToWebp,
    uploadFiles
);

// Delete image endpoint
router.post('/delete', deleteImage);

module.exports = router;
