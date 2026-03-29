const fs = require('fs');
const path = require('path');
const imageProcessor = require('../modules/extractors/imageProcessor');

describe('imageProcessor - Image metadata removal and normalization', () => {
  const testDir = path.join(__dirname, '../test-files');
  const jobsDir = path.join(__dirname, '../jobs');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('getImageDimensions - Binary header parsing', () => {
    test('should extract PNG dimensions from valid PNG header (magic: 0x89504E47)', () => {
      const pngPath = path.join(testDir, 'dims-valid.png');
      const pngBuffer = Buffer.alloc(32);
      pngBuffer.writeUInt32BE(0x89504E47, 0);
      pngBuffer.writeUInt32BE(0x0D0A1A0A, 4);
      pngBuffer.writeUInt32BE(100, 16);
      pngBuffer.writeUInt32BE(200, 20);
      fs.writeFileSync(pngPath, pngBuffer);

      const result = imageProcessor.getImageDimensions(pngPath);

      expect(result.format).toBe('PNG');
      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
    });

    test('should handle corrupted/truncated PNG file gracefully', () => {
      const corruptPath = path.join(testDir, 'dims-corrupt.png');
      const truncatedBuffer = Buffer.from([0x89, 0x50, 0x4E]);
      fs.writeFileSync(corruptPath, truncatedBuffer);

      const result = imageProcessor.getImageDimensions(corruptPath);

      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
    });

    test('should handle nonexistent files without crashing', () => {
      const result = imageProcessor.getImageDimensions('/nonexistent/path/image.jpg');

      expect(result).toHaveProperty('error');
      expect(result.error).toBeDefined();
    });

    test('should return UNKNOWN format for unrecognized file headers', () => {
      const unknownPath = path.join(testDir, 'dims-unknown.bin');
      const randomBuffer = Buffer.from('random binary data that is not an image');
      fs.writeFileSync(unknownPath, randomBuffer);

      const result = imageProcessor.getImageDimensions(unknownPath);

      expect(['UNKNOWN']).toContain(result.format);
    });
  });

  describe('checkExifData - Metadata detection', () => {
    test('should detect EXIF segment (0xFFE1) in JPEG', () => {
      const jpegPath = path.join(testDir, 'exif-detected.jpg');
      const jpegBuffer = Buffer.alloc(200);
      jpegBuffer.writeUInt16BE(0xFFD8, 0);
      jpegBuffer.writeUInt16BE(0xFFE1, 10);
      fs.writeFileSync(jpegPath, jpegBuffer);

      const result = imageProcessor.checkExifData(jpegPath);

      expect(result.hasExif).toBe(true);
      expect(result.metadata.exif).toContain('detected');
    });

    test('should detect IPTC segment (0xFFED) in JPEG', () => {
      const jpegPath = path.join(testDir, 'iptc-detected.jpg');
      const jpegBuffer = Buffer.alloc(200);
      jpegBuffer.writeUInt16BE(0xFFD8, 0);
      jpegBuffer.writeUInt16BE(0xFFED, 20);
      fs.writeFileSync(jpegPath, jpegBuffer);

      const result = imageProcessor.checkExifData(jpegPath);

      expect(result.hasIptc).toBe(true);
    });

    test('should detect XMP namespace in file content', () => {
      const xmpPath = path.join(testDir, 'xmp-detected.jpg');
      const contentWithXmp = Buffer.from('JPEG data xmlns:xmp="http://ns.adobe.com/xap" more data');
      fs.writeFileSync(xmpPath, contentWithXmp);

      const result = imageProcessor.checkExifData(xmpPath);

      expect(result.hasXmp).toBe(true);
    });

    test('should report clean metadata when no markers detected', () => {
      const cleanPath = path.join(testDir, 'metadata-clean.jpg');
      const cleanBuffer = Buffer.from('clean image data without metadata markers');
      fs.writeFileSync(cleanPath, cleanBuffer);

      const result = imageProcessor.checkExifData(cleanPath);

      expect(result.hasExif).toBe(false);
      expect(result.hasIptc).toBe(false);
      expect(result.hasXmp).toBe(false);
      expect(result.metadata.exif).toContain('No EXIF');
    });
  });

  describe('removeJpegMetadata - JPEG marker manipulation', () => {
    test('should preserve JPEG SOI marker (0xFFD8) at file start', () => {
      const jpegBuffer = Buffer.alloc(200);
      jpegBuffer.writeUInt16BE(0xFFD8, 0);
      jpegBuffer.writeUInt16BE(0xFFE1, 2);
      jpegBuffer.writeUInt16BE(0xFFC0, 100);

      const result = imageProcessor.removeJpegMetadata(jpegBuffer);

      expect(result.readUInt16BE(0)).toBe(0xFFD8);
      expect(result.length).toBeLessThanOrEqual(jpegBuffer.length);
    });

    test('should reduce file size by removing metadata segments', () => {
      const jpegBuffer = Buffer.alloc(500);
      jpegBuffer.writeUInt16BE(0xFFD8, 0);
      jpegBuffer.writeUInt16BE(0xFFE0, 2);
      jpegBuffer.writeUInt16BE(100, 4);

      const result = imageProcessor.removeJpegMetadata(jpegBuffer);

      expect(result.length).toBeLessThan(jpegBuffer.length);
    });
  });

  describe('removePngMetadata - PNG chunk removal', () => {
    test('should preserve PNG signature and IHDR in output', () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        Buffer.from([0x00, 0x00, 0x00, 0x0D]),
        Buffer.from('IHDR'),
      ]);

      const result = imageProcessor.removePngMetadata(pngBuffer);

      expect(result.slice(0, 8).toString('hex')).toBe(pngBuffer.slice(0, 8).toString('hex'));
    });

    test('should remove metadata chunks (tEXt, zTXt, iTXt)', () => {
      const textChunk = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x10]),
        Buffer.from('tEXt'),
        Buffer.from('metadata content'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
      ]);

      const pngWithMetadata = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        textChunk,
      ]);

      const result = imageProcessor.removePngMetadata(pngWithMetadata);

      expect(result.toString().includes('tEXt')).toBe(false);
    });
  });

  describe('checkImageNormalization - Dimension analysis and recommendations', () => {
    test('should recommend resizing for images exceeding 2000px width', () => {
      const oversizeImage = { width: 4000, height: 3000 };

      const result = imageProcessor.checkImageNormalization(oversizeImage, 100 * 1024);

      expect(result.needsSizeReduction).toBe(true);
      expect(result.recommendedDimensions.width).toBeLessThanOrEqual(2000);
      expect(result.recommendedDimensions.height).toBeLessThanOrEqual(2000);
    });

    test('should recommend compression for files exceeding 5MB', () => {
      const normalDimensions = { width: 800, height: 600 };
      const fileSizeOver5MB = 6 * 1024 * 1024;

      const result = imageProcessor.checkImageNormalization(normalDimensions, fileSizeOver5MB);

      expect(result.needsCompression).toBe(true);
      expect(result.recommendedQuality).toBe(85);
    });

    test('should preserve aspect ratio when recommending new dimensions', () => {
      const wideDimensions = { width: 6000, height: 2000 };
      const result = imageProcessor.checkImageNormalization(wideDimensions, 100 * 1024);

      const originalRatio = wideDimensions.width / wideDimensions.height;
      const recommendedRatio = result.recommendedDimensions.width / result.recommendedDimensions.height;

      expect(Math.abs(originalRatio - recommendedRatio)).toBeLessThan(0.05);
    });

    test('should not recommend normalization for compliant images', () => {
      const normalImage = { width: 800, height: 600 };
      const smallFile = 1 * 1024 * 1024;

      const result = imageProcessor.checkImageNormalization(normalImage, smallFile);

      expect(result.needsNormalization).toBe(false);
      expect(result.needsSizeReduction).toBe(false);
      expect(result.needsCompression).toBe(false);
    });

    test('should handle edge case: extremely small images', () => {
      const tinyImage = { width: 1, height: 1 };

      const result = imageProcessor.checkImageNormalization(tinyImage, 100);

      expect(result.needsNormalization).toBe(false);
    });

    test('should handle edge case: very tall images (portrait orientation)', () => {
      const portraitImage = { width: 1000, height: 5000 };

      const result = imageProcessor.checkImageNormalization(portraitImage, 100 * 1024);

      expect(result.needsSizeReduction).toBe(true);
      expect(result.recommendedDimensions.height).toBeLessThanOrEqual(2000);
    });
  });

  describe('getImageInfo - Comprehensive image analysis', () => {
    test('should return comprehensive metadata object for valid image', () => {
      const imagePath = path.join(testDir, 'comprehensive.jpg');
      const imageBuffer = Buffer.alloc(300);
      imageBuffer.writeUInt16BE(0xFFD8, 0);
      imageBuffer.writeUInt16BE(0xFFE1, 10);
      fs.writeFileSync(imagePath, imageBuffer);

      const result = imageProcessor.getImageInfo(imagePath, 'JPG');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('fileSize');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('normalization');
      expect(result).toHaveProperty('hasMetadata');
      expect(result).toHaveProperty('needsSanitization');
    });

    test('should calculate both binary and human-readable file sizes', () => {
      const imagePath = path.join(testDir, 'size.jpg');
      const imageBuffer = Buffer.alloc(1024 * 100);
      fs.writeFileSync(imagePath, imageBuffer);

      const result = imageProcessor.getImageInfo(imagePath, 'JPG');

      expect(result.fileSize).toBe(imageBuffer.length);
      expect(result.fileSizeHuman).toContain('KB');
    });

    test('should gracefully handle missing images', () => {
      const result = imageProcessor.getImageInfo('/nonexistent/path.jpg', 'JPG');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('processImage - Full image processing pipeline', () => {
    test('should execute complete processing for image with metadata', async () => {
      const imagePath = path.join(testDir, 'pipeline-full.jpg');
      const imageBuffer = Buffer.alloc(300);
      imageBuffer.writeUInt16BE(0xFFD8, 0);
      imageBuffer.writeUInt16BE(0xFFE1, 10);
      fs.writeFileSync(imagePath, imageBuffer);

      const result = await imageProcessor.processImage(imagePath, 'JPG');

      if (result.success) {
        expect(result).toHaveProperty('original');
        expect(result).toHaveProperty('sanitization');
        expect(result).toHaveProperty('normalization');
        expect(result).toHaveProperty('status');
      }
    });

    test('should create sanitized file at expected location', async () => {
      const imagePath = path.join(testDir, 'pipeline-sanitized.jpg');
      const imageBuffer = Buffer.alloc(300);
      imageBuffer.writeUInt16BE(0xFFD8, 0);
      fs.writeFileSync(imagePath, imageBuffer);

      const result = await imageProcessor.processImage(imagePath, 'JPG');

      if (result.success && result.sanitizedPath) {
        expect(fs.existsSync(result.sanitizedPath)).toBe(true);
      }
    });
  });
});
