const fs = require('fs');
const path = require('path');

function getImageDimensions(filePath) {
  try {
    const buffer = Buffer.alloc(26);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 26, 0);
    fs.closeSync(fd);

    if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, format: 'PNG' };
    }

    const fileBuffer = fs.readFileSync(filePath);
    for (let i = 0; i < fileBuffer.length - 9; i++) {
      if (fileBuffer[i] === 0xFF && (fileBuffer[i + 1] === 0xC0 || fileBuffer[i + 1] === 0xC2)) {
        const height = fileBuffer.readUInt16BE(i + 5);
        const width = fileBuffer.readUInt16BE(i + 7);
        return { width, height, format: 'JPEG' };
      }
    }

    return { width: null, height: null, format: 'UNKNOWN' };
  } catch (err) {
    return { width: null, height: null, error: err.message };
  }
}

function checkExifData(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    let hasExif = false;
    let hasIptc = false;
    let hasXmp = false;

    if (buffer.includes(Buffer.from([0xFF, 0xE1]))) {
      hasExif = true;
    }

    if (buffer.includes(Buffer.from([0xFF, 0xED]))) {
      hasIptc = true;
    }

    const bufferStr = buffer.toString('utf-8', 0, Math.min(50000, buffer.length));
    if (bufferStr.includes('xmlns:xmp') || bufferStr.includes('http://ns.adobe.com/xap')) {
      hasXmp = true;
    }

    return {
      hasExif,
      hasIptc,
      hasXmp,
      metadata: {
        exif: hasExif ? 'EXIF data detected - will be removed' : 'No EXIF data',
        iptc: hasIptc ? 'IPTC data detected - will be removed' : 'No IPTC data',
        xmp: hasXmp ? 'XMP data detected - will be removed' : 'No XMP data',
      },
    };
  } catch (err) {
    return { error: err.message };
  }
}

function removeJpegMetadata(buffer) {
  let pos = 2;
  const result = Buffer.alloc(buffer.length);
  let resultPos = 0;

  result.writeUInt16BE(0xFFD8, resultPos);
  resultPos += 2;

  while (pos < buffer.length) {
    const marker = buffer.readUInt16BE(pos);

    if (
      (marker & 0xFFF0) === 0xFFE0 ||
      marker === 0xFFFE ||
      marker === 0xFFDB ||
      marker === 0xFFC0 ||
      marker === 0xFFC2
    ) {
      const len = buffer.readUInt16BE(pos + 2);
      pos += 2 + len;

      if ((marker & 0xFFF0) === 0xFFE0 || marker === 0xFFFE) {
        continue;
      }
    }

    if (resultPos + 2 <= result.length) {
      result.writeUInt16BE(marker, resultPos);
      resultPos += 2;
      pos += 2;
    } else {
      break;
    }

    if (marker !== 0xFFD8 && marker !== 0xFFD9 && (marker & 0xFF00) === 0xFF00) {
      if (pos + 2 <= buffer.length) {
        const len = buffer.readUInt16BE(pos);
        const chunkSize = len + 2;

        if ((marker & 0xFFF0) === 0xFFE0 || marker === 0xFFFE) {
          pos += chunkSize;
        } else {
          if (resultPos + chunkSize <= result.length) {
            buffer.copy(result, resultPos, pos, pos + chunkSize);
            resultPos += chunkSize;
            pos += chunkSize;
          } else {
            break;
          }
        }
      }
    }
  }

  return result.slice(0, resultPos);
}

function sanitizeImage(sourcePath, outputPath) {
  try {
    const fileBuffer = fs.readFileSync(sourcePath);
    let sanitizedBuffer = fileBuffer;

    if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8) {
      sanitizedBuffer = removeJpegMetadata(fileBuffer);
    }

    fs.writeFileSync(outputPath, sanitizedBuffer);

    return {
      success: true,
      originalSize: fileBuffer.length,
      sanitizedSize: sanitizedBuffer.length,
      message: 'Image sanitized - metadata removed',
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function checkImageNormalization(dimensions, fileSize) {
  const MAX_DIMENSION = 2000;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const needsSizeReduction = dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION;
  const needsCompression = fileSize > MAX_FILE_SIZE;

  let recommendedWidth = dimensions.width;
  let recommendedHeight = dimensions.height;

  if (needsSizeReduction) {
    const ratio = dimensions.width / dimensions.height;
    if (dimensions.width > dimensions.height) {
      recommendedWidth = MAX_DIMENSION;
      recommendedHeight = Math.round(MAX_DIMENSION / ratio);
    } else {
      recommendedHeight = MAX_DIMENSION;
      recommendedWidth = Math.round(MAX_DIMENSION * ratio);
    }
  }

  return {
    needsNormalization: needsSizeReduction || needsCompression,
    needsSizeReduction,
    needsCompression,
    currentDimensions: { width: dimensions.width, height: dimensions.height },
    recommendedDimensions: { width: recommendedWidth, height: recommendedHeight },
    currentSize: fileSize,
    recommendedQuality: needsCompression ? 85 : 95,
    details: {
      sizingIssue: needsSizeReduction ? `Image exceeds ${MAX_DIMENSION}px limit` : 'Image size OK',
      compressionIssue: needsCompression ? `File size exceeds ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB` : 'File size OK',
    }
  };
}

function getImageInfo(filePath, fileType) {
  try {
    const stats = fs.statSync(filePath);
    const dimensions = getImageDimensions(filePath);
    const metadata = checkExifData(filePath);
    const normalization = checkImageNormalization(dimensions, stats.size);

    return {
      success: true,
      type: fileType,
      fileSize: stats.size,
      fileSizeHuman: formatFileSize(stats.size),
      ...dimensions,
      metadata: metadata.metadata,
      hasMetadata: metadata.hasExif || metadata.hasIptc || metadata.hasXmp,
      needsSanitization: metadata.hasExif || metadata.hasIptc || metadata.hasXmp,
      normalization: normalization,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function processImage(filePath, fileType) {
  const imageInfo = getImageInfo(filePath, fileType);

  if (!imageInfo.success) {
    return imageInfo;
  }

  const sanitizedPath = filePath + '.sanitized';
  const sanitization = sanitizeImage(filePath, sanitizedPath);

  const sanitizationMessage = imageInfo.hasMetadata
    ? 'Image contains metadata - sanitized copy created'
    : 'Image is clean - no metadata detected';

  const normalizationMessage = imageInfo.normalization.needsNormalization
    ? `Normalization recommended: ${imageInfo.normalization.details.sizingIssue}${imageInfo.normalization.needsCompression ? ', ' + imageInfo.normalization.details.compressionIssue : ''}`
    : 'Image dimensions and size are optimal';

  return {
    success: true,
    type: fileType,
    original: imageInfo,
    sanitization: sanitization,
    sanitizedPath: sanitizedPath,
    normalizationReport: {
      needsNormalization: imageInfo.normalization.needsNormalization,
      recommendations: imageInfo.normalization,
      message: normalizationMessage,
    },
    status: {
      sanitized: imageInfo.hasMetadata,
      normalized: imageInfo.normalization.needsNormalization ? 'RECOMMENDED' : 'OK',
    }
  };
}

module.exports = {
  getImageDimensions,
  checkExifData,
  sanitizeImage,
  checkImageNormalization,
  getImageInfo,
  processImage,
};
