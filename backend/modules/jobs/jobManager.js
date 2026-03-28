const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const JOBS_DIR = path.join(__dirname, '../../jobs');
const JOB_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

function createJob(files) {
  const jobId = uuidv4();
  const job = {
    jobId,
    createdAt: new Date().toISOString(),
    status: JOB_STATUSES.PENDING,
    files: files.map(f => ({
      ...f,
      id: uuidv4(),
      processedAt: null,
      extractedData: null,
      sanitizedData: null,
      errors: [],
    })),
    result: null,
    errors: [],
  };

  saveJob(job);
  return job;
}

function saveJob(job) {
  const jobPath = path.join(JOBS_DIR, `${job.jobId}.json`);
  fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
}

function loadJob(jobId) {
  const jobPath = path.join(JOBS_DIR, `${jobId}.json`);
  if (!fs.existsSync(jobPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
}

function updateJobStatus(jobId, status) {
  const job = loadJob(jobId);
  if (!job) return null;

  job.status = status;
  job.updatedAt = new Date().toISOString();
  saveJob(job);
  return job;
}

function updateFileResult(jobId, fileId, result) {
  const job = loadJob(jobId);
  if (!job) return null;

  const fileIndex = job.files.findIndex(f => f.id === fileId);
  if (fileIndex === -1) return null;

  job.files[fileIndex] = {
    ...job.files[fileIndex],
    ...result,
    processedAt: new Date().toISOString(),
  };

  const allProcessed = job.files.every(f => f.processedAt !== null);
  if (allProcessed && job.status === JOB_STATUSES.PROCESSING) {
    job.status = JOB_STATUSES.COMPLETED;
  }

  saveJob(job);
  return job;
}

function addFileError(jobId, fileId, error) {
  const job = loadJob(jobId);
  if (!job) return null;

  const fileIndex = job.files.findIndex(f => f.id === fileId);
  if (fileIndex === -1) return null;

  job.files[fileIndex].errors.push({
    message: error,
    timestamp: new Date().toISOString(),
  });

  saveJob(job);
  return job;
}

function setJobResult(jobId, result) {
  const job = loadJob(jobId);
  if (!job) return null;

  job.result = result;
  saveJob(job);
  return job;
}

function getJobSummary(jobId) {
  const job = loadJob(jobId);
  if (!job) return null;

  const processedCount = job.files.filter(f => f.processedAt).length;
  const failedCount = job.files.filter(f => f.errors.length > 0).length;

  return {
    jobId: job.jobId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    totalFiles: job.files.length,
    processedFiles: processedCount,
    failedFiles: failedCount,
    progress: Math.round((processedCount / job.files.length) * 100),
    files: job.files.map(f => ({
      id: f.id,
      originalName: f.originalName,
      detectedType: f.detectedType,
      status: f.processedAt ? 'processed' : 'pending',
      isMalicious: f.isMalicious || false,
      hasErrors: f.errors.length > 0,
    })),
  };
}

function exportJobAsJson(jobId) {
  const job = loadJob(jobId);
  if (!job) return null;

  const output = {
    system: 'Data Refinery Gateway',
    version: '1.0.0',
    jobId: job.jobId,
    processedAt: new Date().toISOString(),
    totalFiles: job.files.length,
    files: job.files.map(f => ({
      id: f.id,
      originalName: f.originalName,
      type: f.detectedType,
      mimeType: f.detectedMime,
      secure: !f.isMalicious && f.errors.length === 0,
      metadata: {
        operatorAnnotation: f.annotation || '',
        fileSize: f.fileSize,
        processedAt: f.processedAt,
      },
      processing: {
        validated: !f.errors.includes('Validation failed'),
        extracted: !!f.extractedData,
        sanitized: !!f.sanitizedData,
        piiRedacted: f.piiRedacted || false,
      },
      content: f.extractedData?.preview || f.extractedData?.rawContent || null,
      warnings: f.warnings || [],
      errors: f.errors.map(e => typeof e === 'string' ? e : e.message),
    })),
    summary: {
      totalProcessed: job.files.filter(f => f.processedAt).length,
      totalFailed: job.files.filter(f => f.errors.length > 0).length,
      secureFiles: job.files.filter(f => !f.isMalicious).length,
    },
  };

  return output;
}

function cleanupOldJobs(days = 7) {
  const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const files = fs.readdirSync(JOBS_DIR);

  let deletedCount = 0;
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const filePath = path.join(JOBS_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtime < cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
  });

  return { deletedCount, cutoffTime };
}

function listJobs(limit = 50) {
  const files = fs.readdirSync(JOBS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map(file => {
    const job = loadJob(file.replace('.json', ''));
    return getJobSummary(job.jobId);
  });
}

module.exports = {
  createJob,
  loadJob,
  saveJob,
  updateJobStatus,
  updateFileResult,
  addFileError,
  setJobResult,
  getJobSummary,
  exportJobAsJson,
  cleanupOldJobs,
  listJobs,
  JOB_STATUSES,
};
