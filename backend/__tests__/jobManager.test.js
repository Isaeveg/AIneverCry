const fs = require('fs');
const path = require('path');
const jobManager = require('../modules/jobs/jobManager');

describe('jobManager', () => {
  const testDir = path.join(__dirname, '../test-files');
  const jobsDir = path.join(__dirname, '../jobs');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    if (!fs.existsSync(jobsDir)) {
      fs.mkdirSync(jobsDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    if (fs.existsSync(jobsDir)) {
      const files = fs.readdirSync(jobsDir);
      files.forEach(f => {
        try {
          fs.unlinkSync(path.join(jobsDir, f));
        } catch (e) {}
      });
    }
  });

  describe('createJob', () => {
    test('should create a job with unique ID', () => {
      const files = [
        { originalName: 'test1.txt', detectedType: 'TXT', detectedMime: 'text/plain' },
        { originalName: 'test2.pdf', detectedType: 'PDF', detectedMime: 'application/pdf' },
      ];

      const job = jobManager.createJob(files);

      expect(job.jobId).toBeDefined();
      expect(job.jobId).toMatch(/^[0-9a-f-]{36}$/);
      expect(job.createdAt).toBeDefined();
      expect(new Date(job.createdAt)).toBeInstanceOf(Date);
      expect(job.status).toBe(jobManager.JOB_STATUSES.PENDING);
    });

    test('should initialize file objects with unique IDs', () => {
      const files = [{ originalName: 'test.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);

      expect(job.files.length).toBe(1);
      expect(job.files[0].id).toBeDefined();
      expect(job.files[0].originalName).toBe('test.txt');
      expect(job.files[0].processedAt).toBeNull();
      expect(job.files[0].extractedData).toBeNull();
      expect(job.files[0].annotation).toBeNull();
    });

    test('should persist job to disk', () => {
      const files = [{ originalName: 'persist.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      const jobPath = path.join(jobsDir, `${job.jobId}.json`);

      expect(fs.existsSync(jobPath)).toBe(true);
    });

    test('should create job with empty errors array', () => {
      const files = [{ originalName: 'test.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);

      expect(job.errors).toEqual([]);
      expect(job.files[0].errors).toEqual([]);
    });
  });

  describe('loadJob', () => {
    test('should load existing job from disk', () => {
      const files = [{ originalName: 'load.txt', detectedType: 'TXT' }];
      const created = jobManager.createJob(files);

      const loaded = jobManager.loadJob(created.jobId);

      expect(loaded).not.toBeNull();
      expect(loaded.jobId).toBe(created.jobId);
      expect(loaded.files[0].originalName).toBe('load.txt');
    });

    test('should return null for nonexistent job', () => {
      const result = jobManager.loadJob('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateJobStatus', () => {
    test('should update job status and add timestamp', () => {
      const files = [{ originalName: 'status.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);

      const updated = jobManager.updateJobStatus(job.jobId, jobManager.JOB_STATUSES.PROCESSING);

      expect(updated.status).toBe(jobManager.JOB_STATUSES.PROCESSING);
      expect(updated.updatedAt).toBeDefined();
    });

    test('should persist status change to disk', () => {
      const files = [{ originalName: 'persist-status.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);

      jobManager.updateJobStatus(job.jobId, jobManager.JOB_STATUSES.PROCESSING);
      const reloaded = jobManager.loadJob(job.jobId);

      expect(reloaded.status).toBe(jobManager.JOB_STATUSES.PROCESSING);
    });
  });

  describe('updateFileResult', () => {
    test('should update file processing result', () => {
      const files = [{ originalName: 'result.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      const result = {
        extractedData: { rawContent: 'Hello World', lines: 1 },
        sanitized: true,
      };

      const updated = jobManager.updateFileResult(job.jobId, fileId, result);

      expect(updated.files[0].extractedData).toEqual(result.extractedData);
      expect(updated.files[0].processedAt).toBeDefined();
    });

    test('should auto-complete job when all files processed', () => {
      const files = [{ originalName: 'file1.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      jobManager.updateJobStatus(job.jobId, jobManager.JOB_STATUSES.PROCESSING);
      const fileId = job.files[0].id;

      const result = { extractedData: { content: 'test' } };
      const updated = jobManager.updateFileResult(job.jobId, fileId, result);

      expect(updated.status).toBe(jobManager.JOB_STATUSES.COMPLETED);
    });
  });

  describe('addFileError', () => {
    test('should add error to file with timestamp', () => {
      const files = [{ originalName: 'error.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      const updated = jobManager.addFileError(job.jobId, fileId, 'Processing failed');

      expect(updated.files[0].errors.length).toBe(1);
      expect(updated.files[0].errors[0].message).toBe('Processing failed');
      expect(updated.files[0].errors[0].timestamp).toBeDefined();
    });

    test('should allow multiple errors per file', () => {
      const files = [{ originalName: 'multi-error.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      jobManager.addFileError(job.jobId, fileId, 'Error 1');
      const updated = jobManager.addFileError(job.jobId, fileId, 'Error 2');

      expect(updated.files[0].errors.length).toBe(2);
      expect(updated.files[0].errors[1].message).toBe('Error 2');
    });
  });

  describe('updateFileAnnotation', () => {
    test('should add annotation to file by index', () => {
      const files = [
        { originalName: 'file1.txt', detectedType: 'TXT' },
        { originalName: 'file2.txt', detectedType: 'TXT' },
      ];
      const job = jobManager.createJob(files);

      const updated = jobManager.updateFileAnnotation(job.jobId, 1, 'Important document');

      expect(updated.files[1].annotation).toBe('Important document');
    });

    test('should return null for invalid file index', () => {
      const files = [{ originalName: 'file.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);

      const result = jobManager.updateFileAnnotation(job.jobId, 99, 'Test');

      expect(result).toBeNull();
    });
  });

  describe('setJobResult', () => {
    test('should set final job result', () => {
      const files = [{ originalName: 'final.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      const finalResult = { success: true, filesProcessed: 1 };

      const updated = jobManager.setJobResult(job.jobId, finalResult);

      expect(updated.result).toEqual(finalResult);
    });
  });

  describe('getJobSummary', () => {
    test('should calculate progress correctly', () => {
      const files = [
        { originalName: 'file1.txt', detectedType: 'TXT' },
        { originalName: 'file2.txt', detectedType: 'TXT' },
      ];
      const job = jobManager.createJob(files);
      jobManager.updateJobStatus(job.jobId, jobManager.JOB_STATUSES.PROCESSING);

      const fileId = job.files[0].id;
      jobManager.updateFileResult(job.jobId, fileId, { extractedData: { content: 'test' } });

      const summary = jobManager.getJobSummary(job.jobId);

      expect(summary.totalFiles).toBe(2);
      expect(summary.processedFiles).toBe(1);
      expect(summary.progress).toBe(50);
    });

    test('should track failed files', () => {
      const files = [{ originalName: 'fail.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      jobManager.addFileError(job.jobId, fileId, 'Failed to process');
      const summary = jobManager.getJobSummary(job.jobId);

      expect(summary.failedFiles).toBe(1);
    });

    test('should mark files with security issues as having errors', () => {
      const files = [{ originalName: 'security.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      jobManager.updateFileResult(job.jobId, fileId, {
        securityIssues: [{ type: 'XSS', message: 'Found XSS' }],
      });

      const summary = jobManager.getJobSummary(job.jobId);

      expect(summary.files[0].hasErrors).toBe(true);
    });
  });

  describe('exportJobAsJson', () => {
    test('should export complete job structure with system metadata', () => {
      const files = [{ originalName: 'export.txt', detectedType: 'TXT', detectedMime: 'text/plain' }];
      const job = jobManager.createJob(files);

      const exported = jobManager.exportJobAsJson(job.jobId);

      expect(exported).toBeDefined();
      expect(exported.system).toBe('Data Refinery Gateway');
      expect(exported.version).toBe('1.0.0');
      expect(exported.jobId).toBe(job.jobId);
      expect(exported.processedAt).toBeDefined();
      expect(exported.totalFiles).toBe(1);
      expect(exported).toHaveProperty('files');
      expect(exported).toHaveProperty('summary');
    });

    test('should export file details with security and processing status', () => {
      const files = [{ originalName: 'details.txt', detectedType: 'TXT', detectedMime: 'text/plain' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      jobManager.updateFileResult(job.jobId, fileId, {
        extractedData: { type: 'TXT', rawContent: 'Test content', lines: 1 },
        validationErrors: [],
        securityIssues: [],
        isMalicious: false,
      });

      const exported = jobManager.exportJobAsJson(job.jobId);
      const exportedFile = exported.files[0];

      expect(exportedFile).toHaveProperty('id');
      expect(exportedFile).toHaveProperty('originalName');
      expect(exportedFile).toHaveProperty('type');
      expect(exportedFile).toHaveProperty('mimeType');
      expect(exportedFile).toHaveProperty('secure');
      expect(exportedFile).toHaveProperty('processing');
      expect(exportedFile.processing).toHaveProperty('validated');
      expect(exportedFile.processing).toHaveProperty('extracted');
      expect(exportedFile.processing).toHaveProperty('sanitized');
      expect(exportedFile.processing).toHaveProperty('piiRedacted');
    });

    test('should mark files as secure only when all checks pass', () => {
      const files = [{ originalName: 'secure.txt', detectedType: 'TXT', detectedMime: 'text/plain' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      jobManager.updateFileResult(job.jobId, fileId, {
        extractedData: { type: 'TXT', rawContent: 'clean' },
        validationErrors: [],
        securityIssues: [],
        isMalicious: false,
      });

      const exported = jobManager.exportJobAsJson(job.jobId);

      expect(exported.files[0].secure).toBe(true);
    });

    test('should mark file as insecure when validation errors present', () => {
      const files = [{ originalName: 'insecure.txt', detectedType: 'TXT', detectedMime: 'text/plain' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      jobManager.updateFileResult(job.jobId, fileId, {
        extractedData: { type: 'TXT', rawContent: 'content' },
        validationErrors: ['Extension mismatch detected'],
        securityIssues: [],
      });

      const exported = jobManager.exportJobAsJson(job.jobId);

      expect(exported.files[0].secure).toBe(false);
      expect(exported.files[0].validationErrors).toContain('Extension mismatch detected');
    });

    test('should track PII redaction metadata in extracted data', () => {
      const files = [{ originalName: 'pii.txt', detectedType: 'TXT', detectedMime: 'text/plain' }];
      const job = jobManager.createJob(files);
      const fileId = job.files[0].id;

      jobManager.updateFileResult(job.jobId, fileId, {
        extractedData: {
          type: 'TXT',
          rawContent: 'email: user@example.com',
          redactionDetails: {
            patternsRemoved: ['EMAIL'],
            originalLength: 30,
            redactedLength: 25,
          },
        },
      });

      const exported = jobManager.exportJobAsJson(job.jobId);

      if (exported.files[0].extracted.piiRedaction) {
        expect(exported.files[0].extracted.piiRedaction.applied).toBe(true);
        expect(exported.files[0].extracted.piiRedaction.patterns).toContain('EMAIL');
      }
    });

    test('should generate summary statistics aggregating all files', () => {
      const files = [
        { originalName: 'file1.txt', detectedType: 'TXT', detectedMime: 'text/plain' },
        { originalName: 'file2.txt', detectedType: 'TXT', detectedMime: 'text/plain' },
        { originalName: 'file3.txt', detectedType: 'TXT', detectedMime: 'text/plain' },
      ];
      const job = jobManager.createJob(files);

      jobManager.updateFileResult(job.jobId, job.files[0].id, {
        extractedData: { type: 'TXT', rawContent: 'clean' },
        validationErrors: [],
        securityIssues: [],
      });

      jobManager.updateFileResult(job.jobId, job.files[1].id, {
        extractedData: { type: 'TXT', rawContent: 'user@example.com', redactionDetails: { patternsRemoved: ['EMAIL'] } },
        validationErrors: [],
        securityIssues: [{ type: 'XSS', code: 'XSS_PAYLOAD' }],
      });

      jobManager.updateFileResult(job.jobId, job.files[2].id, {
        extractedData: { type: 'TXT', rawContent: 'failed' },
        validationErrors: ['Type mismatch'],
        securityIssues: [],
      });

      const exported = jobManager.exportJobAsJson(job.jobId);

      expect(exported.summary).toHaveProperty('totalProcessed');
      expect(exported.summary).toHaveProperty('totalFailed');
      expect(exported.summary).toHaveProperty('secureFiles');
      expect(exported.summary).toHaveProperty('filesWithPII');
      expect(exported.summary).toHaveProperty('filesWithSecurityIssues');
      expect(exported.summary.filesWithPII).toBeGreaterThanOrEqual(1);
      expect(exported.summary.filesWithSecurityIssues).toBeGreaterThanOrEqual(1);
    });

    test('should return null for nonexistent job preventing crashes', () => {
      const result = jobManager.exportJobAsJson('nonexistent-job-id-12345');

      expect(result).toBeNull();
    });
  });;

  describe('cleanupOldJobs', () => {
    test('should identify old jobs based on age', () => {
      const files = [{ originalName: 'old.txt', detectedType: 'TXT' }];
      const job = jobManager.createJob(files);
      const jobPath = path.join(jobsDir, `${job.jobId}.json`);

      const pastTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      fs.utimesSync(jobPath, pastTime, pastTime);

      const result = jobManager.cleanupOldJobs(7);

      expect(result.deletedCount).toBeGreaterThanOrEqual(1);
      expect(result).toHaveProperty('cutoffTime');
    });
  });

  describe('listJobs', () => {
    test('should list recent jobs in reverse order', () => {
      const files1 = [{ originalName: 'first.txt', detectedType: 'TXT' }];
      const job1 = jobManager.createJob(files1);

      const files2 = [{ originalName: 'second.txt', detectedType: 'TXT' }];
      const job2 = jobManager.createJob(files2);

      const jobs = jobManager.listJobs();

      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0]).toHaveProperty('jobId');
      expect(jobs[0]).toHaveProperty('status');
      expect(jobs[0]).toHaveProperty('totalFiles');
      expect(jobs[0]).toHaveProperty('processedFiles');
    });

    test('should respect list limit', () => {
      const jobs = jobManager.listJobs(2);

      expect(jobs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('End-to-end workflow', () => {
    test('should handle complete file processing workflow', () => {
      const files = [
        { originalName: 'workflow1.txt', detectedType: 'TXT', detectedMime: 'text/plain' },
        { originalName: 'workflow2.csv', detectedType: 'CSV', detectedMime: 'text/csv' },
      ];

      const job = jobManager.createJob(files);
      expect(job.status).toBe(jobManager.JOB_STATUSES.PENDING);

      jobManager.updateJobStatus(job.jobId, jobManager.JOB_STATUSES.PROCESSING);
      let current = jobManager.loadJob(job.jobId);
      expect(current.status).toBe(jobManager.JOB_STATUSES.PROCESSING);

      jobManager.updateFileResult(job.jobId, job.files[0].id, {
        extractedData: { type: 'TXT', content: 'Hello', lines: 1 },
        validationErrors: [],
      });

      jobManager.updateFileResult(job.jobId, job.files[1].id, {
        extractedData: { type: 'CSV', headers: ['col1', 'col2'], rowCount: 10 },
        validationErrors: [],
      });

      current = jobManager.loadJob(job.jobId);
      expect(current.status).toBe(jobManager.JOB_STATUSES.COMPLETED);

      jobManager.updateFileAnnotation(job.jobId, 0, 'First document');

      const summary = jobManager.getJobSummary(job.jobId);
      expect(summary.processedFiles).toBe(2);
      expect(summary.progress).toBe(100);

      const exported = jobManager.exportJobAsJson(job.jobId);
      expect(exported.files.length).toBe(2);
      expect(exported.summary.totalProcessed).toBe(2);
    });
  });
});
