const fs = require('fs');
const path = require('path');
const fileValidator = require('./validators/fileValidator');
const securityChecker = require('./validators/securityChecker');
const { extractContent } = require('./extractors/textExtractor');
const { processImage } = require('./extractors/imageProcessor');
const piiRedactor = require('./sanitizers/piiRedactor');
const jobManager = require('./jobs/jobManager');

async function processFile(filePath, originalFilename, jobId, fileId) {
  const result = {
    id: fileId,
    originalName: originalFilename,
    fileSize: null,
    detectedType: null,
    detectedMime: null,
    isMalicious: false,
    validationErrors: [],
    securityIssues: [],
    extractedData: null,
    piiAnalysis: null,
    warnings: [],
  };

  try {
    const validation = fileValidator.validateFile(filePath, originalFilename);
    result.fileSize = validation.fileSize;
    result.detectedType = validation.detectedType;
    result.detectedMime = validation.detectedMime;

    if (!validation.valid) {
      result.validationErrors = validation.errors;
      return updateJobWithResult(jobId, result);
    }

    const security = securityChecker.checkSecurity(filePath, originalFilename, validation.detectedType);
    result.securityIssues = security.issues;
    result.isMalicious = security.isMalicious;

    if (security.isMalicious) {
      result.warnings.push('File marked as malicious - processing stopped');
      return updateJobWithResult(jobId, result);
    }

    if (!security.isSafe) {
      result.warnings.push(`Security warnings: ${security.issues.map(i => i.message).join(', ')}`);
    }

    let extractedData = null;
    const fileType = validation.detectedType;

    if (['PDF', 'TXT', 'MD', 'CSV'].includes(fileType)) {
      extractedData = extractContent(filePath, fileType, originalFilename);

      if (extractedData.success) {
        const piiAnalysis = piiRedactor.analyzePII(
          extractedData.rawContent || JSON.stringify(extractedData)
        );

        result.piiAnalysis = {
          found: piiAnalysis.summary,
          redactionApplied: piiAnalysis.summary.requiresRedaction,
        };

        if (piiAnalysis.summary.requiresRedaction) {
          const sanitized = {
            ...extractedData,
            rawContent: piiAnalysis.redactedContent,
            preview: piiAnalysis.redactedContent.substring(0, 500),
          };
          result.extractedData = sanitized;
          result.warnings.push(`PII redacted: ${piiAnalysis.piiDetected.map(p => p.type).join(', ')}`);
        } else {
          result.extractedData = extractedData;
        }
      } else {
        result.validationErrors.push(`Content extraction failed: ${extractedData.error}`);
      }
    } else if (['PNG', 'JPG', 'GIF', 'SVG'].includes(fileType)) {
      const imageData = processImage(filePath, fileType);

      if (imageData.success) {
        result.extractedData = {
          type: 'IMAGE',
          format: fileType,
          dimensions: {
            width: imageData.original?.width,
            height: imageData.original?.height,
          },
          metadata: imageData.original?.metadata,
          sanitized: imageData.sanitization.success,
          sanitizedPath: imageData.sanitization.success ? imageData.sanitizedPath : null,
          recommendation: imageData.recommendation,
        };

        if (imageData.original?.hasMetadata) {
          result.warnings.push(`Image metadata removed: ${Object.keys(imageData.original.metadata).filter(k => imageData.original.metadata[k].includes('detected')).join(', ')}`);
        }
      } else {
        result.validationErrors.push(`Image processing failed: ${imageData.error}`);
      }
    }

    return updateJobWithResult(jobId, result);
  } catch (err) {
    result.validationErrors.push(`Processing error: ${err.message}`);
    return updateJobWithResult(jobId, result);
  }
}

function updateJobWithResult(jobId, result) {
  try {
    jobManager.updateFileResult(jobId, result.id, result);
    return result;
  } catch (err) {
    console.error('Error updating job:', err);
    return result;
  }
}

async function processJobFiles(jobId, filePaths) {
  jobManager.updateJobStatus(jobId, jobManager.JOB_STATUSES.PROCESSING);

  const results = [];
  for (let i = 0; i < filePaths.length; i++) {
    const { filePath, originalFilename } = filePaths[i];
    const fileId = jobManager.loadJob(jobId).files[i].id;

    const result = await processFile(filePath, originalFilename, jobId, fileId);
    results.push(result);

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const job = jobManager.loadJob(jobId);
  const exportData = jobManager.exportJobAsJson(jobId);
  jobManager.setJobResult(jobId, exportData);

  jobManager.updateJobStatus(jobId, jobManager.JOB_STATUSES.COMPLETED);

  return results;
}

module.exports = {
  processFile,
  processJobFiles,
};
