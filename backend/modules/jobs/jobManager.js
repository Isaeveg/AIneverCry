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
      annotation: null,
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

function updateFileAnnotation(jobId, fileIndex, annotation) {
  const job = loadJob(jobId);
  if (!job) return null;

  if (fileIndex < 0 || fileIndex >= job.files.length) return null;

  job.files[fileIndex].annotation = annotation;
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
      hasErrors: (f.errors?.length > 0) || (f.validationErrors?.length > 0) || (f.securityIssues?.length > 0),
    })),
  };
}

function exportJobAsJson(jobId) {
  const job = loadJob(jobId);
  if (!job) return null;

  const cleanExtractedData = (extracted) => {
    if (!extracted) return null;

    if (extracted.rawContent !== undefined) {
      const cleaned = {
        type: extracted.type,
        format: extracted.format,
        lines: extracted.lines,
        characters: extracted.characters,
        preview: extracted.preview,
        headers: extracted.headers,
        columnCount: extracted.columnCount,
        rowCount: extracted.rowCount,
      };

      Object.keys(cleaned).forEach(key => cleaned[key] === undefined && delete cleaned[key]);

      if (extracted.redactionDetails) {
        cleaned.piiRedaction = {
          applied: true,
          patterns: extracted.redactionDetails.patternsRemoved,
          originalLength: extracted.redactionDetails.originalLength,
          redactedLength: extracted.redactionDetails.redactedLength,
        };
      }

      return cleaned;
    }

    if (extracted.shapes !== undefined) {
      return {
        type: 'SVG',
        format: 'SVG',
        dimensions: {
          width: extracted.width,
          height: extracted.height,
        },
        shapes: extracted.shapes,
      };
    }

    if (extracted.format === 'PNG' || extracted.format === 'JPG') {
      const normalizationStatus = extracted.processingReport?.normalizationStatus || 'NOT_NEEDED';
      const isNormalized = normalizationStatus === 'COMPLETED';

      const imageExport = {
        type: 'IMAGE',
        format: extracted.format,
        dimensions: {
          original: extracted.dimensions?.original,
        },
        fileSize: {
          original: extracted.fileSize?.original,
        },
        metadata: extracted.metadata || {},
        sanitizationStatus: extracted.processingReport?.sanitizationStatus || 'NOT_NEEDED',
        normalizationStatus: normalizationStatus,
      };

      if (isNormalized) {
        imageExport.dimensions.normalized = extracted.dimensions?.normalized;
        imageExport.fileSize.normalized = extracted.fileSize?.normalized;
        imageExport.fileSize.compressionRatio = extracted.fileSize?.compressionRatio || null;
      }

      return imageExport;
    }

    return extracted;
  };

  const buildFileExport = (f) => {
    const fileExport = {
      id: f.id,
      originalName: f.originalName,
      type: f.detectedType,
      mimeType: f.detectedMime,
      secure: !f.isMalicious && (f.validationErrors?.length || 0) === 0 && (f.securityIssues?.length || 0) === 0,
      processing: {
        validated: (f.validationErrors?.length || 0) === 0,
        extracted: !!f.extractedData,
        sanitized: f.extractedData?.sanitized || false,
        piiRedacted: f.extractedData?.redactionDetails ? true : false,
      },
    };

    if (f.annotation || f.fileSize || f.processedAt) {
      fileExport.metadata = {};
      if (f.annotation) fileExport.metadata.annotation = f.annotation;
      if (f.fileSize) fileExport.metadata.fileSize = f.fileSize;
      if (f.processedAt) fileExport.metadata.processedAt = f.processedAt;
    }

    if (f.extractedData) {
      fileExport.extracted = cleanExtractedData(f.extractedData);
    }

    if (f.warnings && f.warnings.length > 0) {
      fileExport.warnings = f.warnings;
    }

    const validationErrors = f.validationErrors?.map(e => typeof e === 'string' ? e : e.message) || [];
    if (validationErrors.length > 0) {
      fileExport.validationErrors = validationErrors;
    }

    if (f.securityIssues && f.securityIssues.length > 0) {
      fileExport.securityIssues = f.securityIssues;
    }

    return fileExport;
  };

  const output = {
    system: 'Data Refinery Gateway',
    version: '1.0.0',
    jobId: job.jobId,
    processedAt: new Date().toISOString(),
    totalFiles: job.files.length,
    files: job.files.map(f => buildFileExport(f)),
    summary: {
      totalProcessed: job.files.filter(f => f.processedAt).length,
      totalFailed: job.files.filter(f => (f.validationErrors?.length || 0) > 0).length,
      secureFiles: job.files.filter(f => !f.isMalicious && (f.validationErrors?.length || 0) === 0 && (f.securityIssues?.length || 0) === 0).length,
      filesWithPII: job.files.filter(f => f.extractedData?.redactionDetails).length,
      filesWithSecurityIssues: job.files.filter(f => (f.securityIssues?.length || 0) > 0).length,
      filesWithMetadata: job.files.filter(f => f.extractedData?.processingReport?.metadataRemoved).length,
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
  updateFileAnnotation,
  setJobResult,
  getJobSummary,
  exportJobAsJson,
  cleanupOldJobs,
  listJobs,
  JOB_STATUSES,
};
