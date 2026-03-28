const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const FILE_SIGNATURES = {
  PDF: [0x25, 0x50, 0x44, 0x46],
  PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  JPG: [0xFF, 0xD8, 0xFF],
  GIF: [0x47, 0x49, 0x46],
  SVG: null,
  CSV: null,
  TXT: null,
  MD: null,
};

const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'svg', 'jpg', 'jpeg', 'png'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function getActualMimeType(filePath) {
  try {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    if (matchSignature(buffer, FILE_SIGNATURES.PNG)) return 'image/png';
    if (matchSignature(buffer, FILE_SIGNATURES.PDF)) return 'application/pdf';
    if (matchSignature(buffer, FILE_SIGNATURES.JPG)) return 'image/jpeg';
    if (matchSignature(buffer, FILE_SIGNATURES.GIF)) return 'image/gif';

    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.trim().startsWith('<svg')) return 'image/svg+xml';
    if (content.includes(',') && content.split('\n')[0].split(',').length > 1) return 'text/csv';
    if (content.trim().startsWith('#') || /^#+\s/.test(content)) return 'text/markdown';

    return 'text/plain';
  } catch (err) {
    logger.error('Failed to detect MIME type', { filePath, error: err.message });
    return null;
  }
}

function matchSignature(buffer, signature) {
  if (!signature) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

function mimeToStandardType(mimeType) {
  if (!mimeType) return null;
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('png')) return 'PNG';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'JPG';
  if (mimeType.includes('gif')) return 'GIF';
  if (mimeType.includes('svg')) return 'SVG';
  if (mimeType.includes('csv')) return 'CSV';
  if (mimeType.includes('markdown') || mimeType.includes('md')) return 'MD';
  if (mimeType.includes('text') || mimeType === 'text/plain') return 'TXT';
  return null;
}

function validateFile(filePath, originalFilename) {
  const errors = [];
  const warnings = [];

  try {
    if (!fs.existsSync(filePath)) {
      errors.push('File not found');
      return { valid: false, errors, warnings, detectedType: null };
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) errors.push('File is empty');
    if (stats.size > MAX_FILE_SIZE) errors.push(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);

    const ext = path.extname(originalFilename).toLowerCase().slice(1);
    if (!ext) errors.push('File has no extension');
    if (ext && !SUPPORTED_EXTENSIONS.includes(ext)) errors.push(`Unsupported file extension: .${ext}`);

    const actualMimeType = getActualMimeType(filePath);
    const standardType = mimeToStandardType(actualMimeType);

    if (!actualMimeType) errors.push('Could not determine file type from content');

    const expectedMimes = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      csv: 'text/csv',
      txt: 'text/plain',
      md: 'text/markdown',
    };

    if (ext && expectedMimes[ext]) {
      if (!actualMimeType.includes(expectedMimes[ext].split('/')[0])) {
        errors.push(`File extension mismatch: .${ext} but contains ${actualMimeType} data`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      detectedType: standardType,
      detectedMime: actualMimeType,
      fileSize: stats.size,
      originalFilename,
    };
  } catch (err) {
    errors.push(`Validation error: ${err.message}`);
    return { valid: false, errors, warnings, detectedType: null };
  }
}

module.exports = {
  validateFile,
  SUPPORTED_EXTENSIONS,
  MAX_FILE_SIZE,
};
