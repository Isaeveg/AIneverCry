const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const jobManager = require('./modules/jobs/jobManager');
const { processJobFiles } = require('./modules/fileProcessor');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/api/v1/jobs', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        const files = req.files.map(file => ({
            originalName: file.originalname,
            uploadPath: file.path,
            uploadedAt: new Date().toISOString(),
        }));

        const job = jobManager.createJob(files);

        const filePaths = req.files.map(file => ({
            filePath: file.path,
            originalFilename: file.originalname,
        }));

        processJobFiles(job.jobId, filePaths).catch(err => {
            console.error('Error processing job:', err);
            jobManager.updateJobStatus(job.jobId, jobManager.JOB_STATUSES.FAILED);
        });

        res.status(201).json({
            jobId: job.jobId,
            status: job.status,
            totalFiles: job.files.length,
            message: 'Job created. Processing started...',
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Failed to create job' });
    }
});

app.get('/api/v1/jobs/:id', (req, res) => {
    try {
        const jobId = req.params.id;
        const summary = jobManager.getJobSummary(jobId);

        if (!summary) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(summary);
    } catch (err) {
        console.error('Error fetching job:', err);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
});

app.get('/api/v1/jobs/:id/export', (req, res) => {
    try {
        const jobId = req.params.id;
        const job = jobManager.loadJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== jobManager.JOB_STATUSES.COMPLETED) {
            return res.status(400).json({ error: 'Job is not completed yet', status: job.status });
        }

        const exportData = jobManager.exportJobAsJson(jobId);
        res.json(exportData);
    } catch (err) {
        console.error('Error exporting job:', err);
        res.status(500).json({ error: 'Failed to export job' });
    }
});

app.put('/api/v1/jobs/:id/annotation', express.json(), (req, res) => {
    try {
        const jobId = req.params.id;
        const { fileIndex, annotation } = req.body;

        if (fileIndex === undefined || !annotation) {
            return res.status(400).json({ error: 'File index and annotation required' });
        }

        const updated = jobManager.updateFileAnnotation(jobId, fileIndex, annotation);
        if (!updated) {
            return res.status(404).json({ error: 'Job or file not found' });
        }

        res.json({ success: true, message: 'Annotation saved' });
    } catch (err) {
        console.error('Error saving annotation:', err);
        res.status(500).json({ error: 'Failed to save annotation' });
    }
});

app.get('/api/v1/jobs', (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const jobs = jobManager.listJobs(limit);
        res.json({ jobs, total: jobs.length });
    } catch (err) {
        console.error('Error listing jobs:', err);
        res.status(500).json({ error: 'Failed to list jobs' });
    }
});

app.get('/api/v1/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'AINEVERCRY Gateway',
        version: '1.0.0',
        uptime: process.uptime(),
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 AINEVERCRY Backend started on http://localhost:${PORT}`);
    console.log(`📍 API Base: http://localhost:${PORT}/api/v1`);
    console.log(`\n📚 Available endpoints:`);
    console.log(`  POST   /api/v1/jobs              - Create job with files`);
    console.log(`  GET    /api/v1/jobs/:id          - Get job status`);
    console.log(`  GET    /api/v1/jobs/:id/export   - Export final JSON`);
    console.log(`  GET    /api/v1/jobs              - List all jobs`);
    console.log(`  GET    /api/v1/health            - Health check\n`);
});