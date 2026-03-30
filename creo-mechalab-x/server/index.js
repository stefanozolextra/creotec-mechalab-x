require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { extname, join } = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const db = require('./db');
const { verifyToken, requireAdmin } = require('./utils/auth');
const { createClient } = require("@supabase/supabase-js"); // <-- Added Supabase

const app = express();
const PORT = process.env.PORT || 4000;

// Setup Supabase Storage
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const BUCKET_NAME = "mechalab-pdfs";

app.use(cors());
app.use(express.json());

// Set up file storage paths
const UPLOADS_DIR = join(__dirname, 'uploads');
const LESSON_PDFS_DIR = join(UPLOADS_DIR, 'lessons', 'pdfs');

async function ensureLessonUploadsDirectory() {
    try {
        await fsPromises.access(LESSON_PDFS_DIR);
    } catch {
        await fsPromises.mkdir(LESSON_PDFS_DIR, { recursive: true });
    }
}

// Multer memory storage (we process buffers, not disk files)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed.'));
        }
    }
});

// Helper for generating storage keys
function createLessonPdfStorageKey(moduleId, resourceId, originalName) {
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const ext = extname(safeName) || '.pdf';
    return `mod_${moduleId}_res_${resourceId}_${Date.now()}${ext}`;
}

// --- NEW STORAGE HELPER FUNCTIONS ---
async function storeLessonPdf(storageKey, buffer, mimeType) {
    if (supabase) {
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(storageKey, buffer, {
            contentType: mimeType,
            upsert: true
        });
        if (error) throw new Error("Supabase upload failed: " + error.message);
    } else {
        const filePath = join(LESSON_PDFS_DIR, storageKey);
        await ensureLessonUploadsDirectory();
        await fsPromises.writeFile(filePath, buffer);
    }
}

async function removeStoredLessonPdf(storageKey) {
    if (supabase) {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove([storageKey]);
        if (error) console.error("Supabase delete failed:", error.message);
    } else {
        const filePath = join(LESSON_PDFS_DIR, storageKey);
        try {
            await fsPromises.unlink(filePath);
        } catch (e) {
            if (e.code !== "ENOENT") console.error("Local file delete failed:", e);
        }
    }
}

// --- ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Admin: Get all modules and lessons
app.get('/api/admin/lessons', verifyToken, requireAdmin, async (req, res) => {
    try {
        const modulesResult = await db.query('SELECT * FROM modules ORDER BY order_no ASC');
        const modules = modulesResult.rows;

        const resourcesResult = await db.query(`
            SELECT r.*, f.original_filename as file_name, f.file_size 
            FROM module_resources r
            LEFT JOIN module_resource_files f ON f.resource_id = r.resource_id
            ORDER BY r.module_id, r.order_no ASC
        `);
        const resources = resourcesResult.rows;

        const items = modules.map(m => ({
            ...m,
            module_title: m.title,
            lessons: resources.filter(r => r.module_id === m.module_id).map(r => ({
                ...r,
                has_uploaded_file: !!r.file_name,
                resolved_url: r.url
            }))
        }));

        res.json({ items });
    } catch (error) {
        console.error('Error fetching lessons:', error);
        res.status(500).json({ error: 'Failed to fetch lessons' });
    }
});

// Admin: Create Module
app.post('/api/admin/lessons/modules', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { moduleCode, title, description } = req.body;
        
        if (!moduleCode || !title) {
            return res.status(400).json({ error: 'Module Code and Title are required' });
        }

        const maxOrderResult = await db.query('SELECT COALESCE(MAX(order_no), 0) as max_order FROM modules');
        const nextOrder = parseInt(maxOrderResult.rows[0].max_order) + 1;

        const result = await db.query(
            'INSERT INTO modules (module_code, title, description, order_no) VALUES ($1, $2, $3, $4) RETURNING *',
            [moduleCode, title, description || '', nextOrder]
        );

        res.status(201).json({ module: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Module code already exists' });
        }
        console.error('Error creating module:', error);
        res.status(500).json({ error: 'Failed to create module' });
    }
});

// Admin: Create Lesson (Resource)
app.post('/api/admin/modules/:moduleId/lessons', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { moduleId } = req.params;
        const { title, type, url } = req.body;

        if (!title || !type) {
            return res.status(400).json({ error: 'Title and Type are required' });
        }

        const maxOrderResult = await db.query('SELECT COALESCE(MAX(order_no), 0) as max_order FROM module_resources WHERE module_id = $1', [moduleId]);
        const nextOrder = parseInt(maxOrderResult.rows[0].max_order) + 1;

        const result = await db.query(
            'INSERT INTO module_resources (module_id, type, title, url, order_no) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [moduleId, type, url || '', nextOrder]
        );

        res.status(201).json({ lesson: result.rows[0] });
    } catch (error) {
        console.error('Error creating lesson:', error);
        res.status(500).json({ error: 'Failed to create lesson' });
    }
});


// Admin: Upload Lesson PDF
app.post('/api/admin/modules/:moduleId/lessons/:resourceId/pdf', verifyToken, requireAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        const { resourceId } = req.params;
        const storageKey = createLessonPdfStorageKey(req.params.moduleId, resourceId, req.file.originalname);
        
        // Save to Supabase Storage (or local fallback)
        await storeLessonPdf(storageKey, req.file.buffer, req.file.mimetype);

        // Update database metadata
        await db.query('BEGIN');
        
        // Remove old file metadata if replacing
        const oldFileResult = await db.query('SELECT storage_key FROM module_resource_files WHERE resource_id = $1', [resourceId]);
        if (oldFileResult.rows.length > 0) {
            await removeStoredLessonPdf(oldFileResult.rows[0].storage_key);
            await db.query('DELETE FROM module_resource_files WHERE resource_id = $1', [resourceId]);
        }

        await db.query(
            `INSERT INTO module_resource_files (resource_id, storage_key, original_filename, mime_type, file_size) 
             VALUES ($1, $2, $3, $4, $5)`,
            [resourceId, storageKey, req.file.originalname, req.file.mimetype, req.file.size]
        );
        
        // Ensure URL points to our backend fetcher
        await db.query('UPDATE module_resources SET url = $1 WHERE resource_id = $2', [`/api/resources/${resourceId}/pdf`, resourceId]);

        await db.query('COMMIT');
        res.json({ message: 'PDF uploaded successfully' });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error uploading PDF:', error);
        res.status(500).json({ error: 'Failed to upload PDF' });
    }
});


// Fetch/Download PDF File
app.get('/api/resources/:resourceId/pdf', verifyToken, async (req, res) => {
    try {
        const { resourceId } = req.params;
        
        const result = await db.query('SELECT * FROM module_resource_files WHERE resource_id = $1', [resourceId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'PDF metadata not found.' });
        }

        const resource = result.rows[0];
        const storageKey = resource.storage_key;

        if (supabase) {
            // Fetch from Supabase Bucket
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storageKey);
            
            if (error) {
                console.error("Supabase download error:", error);
                return res.status(404).json({ error: "PDF file not found in storage." });
            }
            
            const buffer = Buffer.from(await data.arrayBuffer());
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(resource.original_filename)}"`);
            return res.send(buffer);
            
        } else {
            // Fallback to local disk
            const filePath = join(LESSON_PDFS_DIR, storageKey);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Local PDF file not found.' });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.original_filename)}"`);
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
        }
    } catch (error) {
        console.error('Error fetching PDF:', error);
        res.status(500).json({ error: 'Failed to fetch PDF.' });
    }
});

// Delete Lesson (Cascade handles metadata, but we must delete the physical file)
app.delete('/api/admin/modules/:moduleId/lessons/:resourceId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { resourceId } = req.params;
        
        // Find file before deleting resource
        const fileResult = await db.query('SELECT storage_key FROM module_resource_files WHERE resource_id = $1', [resourceId]);
        
        await db.query('DELETE FROM module_resources WHERE resource_id = $1', [resourceId]);
        
        if (fileResult.rows.length > 0) {
            await removeStoredLessonPdf(fileResult.rows[0].storage_key);
        }

        res.json({ removed: true });
    } catch (error) {
        console.error('Error deleting lesson:', error);
        res.status(500).json({ error: 'Failed to delete lesson' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (supabase) console.log("✅ Supabase Storage Enabled");
});