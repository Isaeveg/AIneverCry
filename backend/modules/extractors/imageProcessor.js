const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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
        exif: hasExif ? 'EXIF data detected - removed' : 'No EXIF data',
        iptc: hasIptc ? 'IPTC data detected - removed' : 'No IPTC data',
        xmp: hasXmp ? 'XMP data detected - removed' : 'No XMP data',
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

function removePngMetadata(buffer) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const chunks = [pngSignature];

  let pos = 8;
  while (pos < buffer.length) {
    if (pos + 8 > buffer.length) break;

    const length = buffer.readUInt32BE(pos);
    const chunkType = buffer.slice(pos + 4, pos + 8).toString('ascii');

    const isMetadata = ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'].includes(chunkType);

    if (!isMetadata) {
      const chunkData = buffer.slice(pos, pos + 12 + length);
      chunks.push(chunkData);
    }

    pos += 12 + length;
  }

  return Buffer.concat(chunks);
}

async function normalizeImage(sourcePath, outputPath, maxWidth = 2000, maxHeight = 2000, quality = 95) {
  try {
    const image = sharp(sourcePath);
    const metadata = await image.metadata();

    let transform = image;

    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      transform = transform.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (metadata.format === 'jpeg') {
      transform = transform.jpeg({ quality, progressive: true });
    } else if (metadata.format === 'png') {
      transform = transform.png({ compressionLevel: 9 });
    } else if (metadata.format === 'webp') {
      transform = transform.webp({ quality });
    }

    await transform.toFile(outputPath);

    const originalStats = fs.statSync(sourcePath);
    const normalizedStats = fs.statSync(outputPath);
    const normalizedMeta = await sharp(outputPath).metadata();

    return {
      success: true,
      originalSize: originalStats.size,
      normalizedSize: normalizedStats.size,
      originalDimensions: { width: metadata.width, height: metadata.height },
      normalizedDimensions: { width: normalizedMeta.width, height: normalizedMeta.height },
      compressionRatio: Math.round((1 - normalizedStats.size / originalStats.size) * 100),
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

async function processImage(filePath, fileType) {
  const imageInfo = getImageInfo(filePath, fileType);

  if (!imageInfo.success) {
    return imageInfo;
  }

  const sanitizedPath = filePath + '.sanitized';
  let sanitizationResult = { success: true, message: 'No sanitization needed' };
  let normalizationResult = {
    success: true,
    performed: false,
    message: 'No normalization needed',
    compressionRatio: null,
  };

  if (imageInfo.hasMetadata) {
    const fileBuffer = fs.readFileSync(filePath);
    let sanitizedBuffer = fileBuffer;

    if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8) {
      sanitizedBuffer = removeJpegMetadata(fileBuffer);
    } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50) {
      sanitizedBuffer = removePngMetadata(fileBuffer);
    }

    fs.writeFileSync(sanitizedPath, sanitizedBuffer);
    sanitizationResult = {
      success: true,
      originalSize: fileBuffer.length,
      sanitizedSize: sanitizedBuffer.length,
      message: 'Metadata removed',
    };
  } else {
    fs.copyFileSync(filePath, sanitizedPath);
  }

  if (imageInfo.normalization.needsNormalization) {
    const normalizedPath = filePath + '.normalized';
    const quality = imageInfo.normalization.recommendedQuality;
    const maxDim = imageInfo.normalization.needsSizeReduction ? 2000 : undefined;

    normalizationResult = await normalizeImage(sanitizedPath, normalizedPath, maxDim, maxDim, quality);

    if (normalizationResult.success) {
      fs.copyFileSync(normalizedPath, sanitizedPath);
      fs.unlinkSync(normalizedPath);
      normalizationResult.performed = true;
    }
  } else {
    normalizationResult.compressionRatio = null;
  }

  return {
    success: true,
    type: fileType,
    original: imageInfo,
    sanitization: sanitizationResult,
    normalization: normalizationResult,
    sanitizedPath: sanitizedPath,
    status: {
      sanitized: imageInfo.hasMetadata ? 'COMPLETED' : 'NOT_NEEDED',
      normalized: imageInfo.normalization.needsNormalization ? (normalizationResult.success ? 'COMPLETED' : 'FAILED') : 'NOT_NEEDED',
    }
  };
}

module.exports = {
  getImageDimensions,
  checkExifData,
  removeJpegMetadata,
  removePngMetadata,
  normalizeImage,
  checkImageNormalization,
  getImageInfo,
  processImage,
};
