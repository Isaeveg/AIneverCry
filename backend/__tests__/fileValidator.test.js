const fileValidator = require('../modules/validators/fileValidator');
const fs = require('fs');
const path = require('path');

describe('fileValidator', () => {
  const testDir = path.join(__dirname, '../test-files');

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

  describe('validateFile - PDF validation', () => {
    test('should accept valid PDF file', () => {
      const pdfPath = path.join(testDir, 'test.pdf');
      fs.writeFileSync(pdfPath, Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from('test content')]));

      const result = fileValidator.validateFile(pdfPath, 'test.pdf');

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('PDF');
      expect(result.detectedMime).toBe('application/pdf');
    });

    test('should reject PDF with wrong magic bytes', () => {
      const pdfPath = path.join(testDir, 'fake.pdf');
      fs.writeFileSync(pdfPath, Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.from('fake pdf')]));

      const result = fileValidator.validateFile(pdfPath, 'fake.pdf');

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/extension.*mismatch|type/)
      ]));
    });
  });

  describe('validateFile - Image validation', () => {
    test('should accept valid JPG file', () => {
      const jpgPath = path.join(testDir, 'test.jpg');
      fs.writeFileSync(jpgPath, Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('jpg data')]));

      const result = fileValidator.validateFile(jpgPath, 'test.jpg');

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('JPG');
    });

    test('should accept valid PNG file', () => {
      const pngPath = path.join(testDir, 'test.png');
      fs.writeFileSync(pngPath, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.from('png data')]));

      const result = fileValidator.validateFile(pngPath, 'test.png');

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('PNG');
    });

    test('should reject executable file renamed as image', () => {
      const exePath = path.join(testDir, 'malware.jpg');
      fs.writeFileSync(exePath, Buffer.concat([Buffer.from([0x4D, 0x5A, 0x90, 0x00]), Buffer.from('PE executable')]));

      const result = fileValidator.validateFile(exePath, 'malware.jpg');

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/extension|mismatch/)
      ]));
    });
  });

  describe('validateFile - Text files', () => {
    test('should accept valid TXT file', () => {
      const txtPath = path.join(testDir, 'test.txt');
      fs.writeFileSync(txtPath, 'plain text content');

      const result = fileValidator.validateFile(txtPath, 'test.txt');

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('TXT');
    });

    test('should accept valid CSV file', () => {
      const csvPath = path.join(testDir, 'test.csv');
      fs.writeFileSync(csvPath, 'name,email\nJohn,john@example.com');

      const result = fileValidator.validateFile(csvPath, 'test.csv');

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('CSV');
    });

    test('should accept valid Markdown file', () => {
      const mdPath = path.join(testDir, 'test.md');
      fs.writeFileSync(mdPath, '# Title\nContent here');

      const result = fileValidator.validateFile(mdPath, 'test.md');

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('MD');
    });
  });

  describe('validateFile - SVG validation', () => {
    test('should accept valid SVG file', () => {
      const svgPath = path.join(testDir, 'test.svg');
      fs.writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');

      const result = fileValidator.validateFile(svgPath, 'test.svg');

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('SVG');
    });

    test('should accept SVG with XML declaration', () => {
      const svgPath = path.join(testDir, 'test-xml.svg');
      fs.writeFileSync(svgPath, '<?xml version="1.0"?><svg xmlns="..."></svg>');

      const result = fileValidator.validateFile(svgPath, 'test-xml.svg');

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe('SVG');
    });
  });

  describe('validateFile - Unsupported formats', () => {
    test('should reject unsupported file type', () => {
      const exePath = path.join(testDir, 'test.exe');
      fs.writeFileSync(exePath, Buffer.from([0x4D, 0x5A]));

      const result = fileValidator.validateFile(exePath, 'test.exe');

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/unsupported|not found|unknown/i)
      ]));
    });

    test('should reject empty file', () => {
      const emptyPath = path.join(testDir, 'empty.txt');
      fs.writeFileSync(emptyPath, '');

      const result = fileValidator.validateFile(emptyPath, 'empty.txt');

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/empty/)
      ]));
    });
  });

  describe('validateFile - File size limits', () => {
    test('should accept file within size limit', () => {
      const filePath = path.join(testDir, 'normal.txt');
      fs.writeFileSync(filePath, 'a'.repeat(1000));

      const result = fileValidator.validateFile(filePath, 'normal.txt');

      expect(result.valid).toBe(true);
      expect(result.fileSize).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('validateFile - MIME type detection', () => {
    test('should detect correct MIME for each file type', () => {
      const testCases = [
        { ext: 'txt', content: 'test content for txt', expectedMime: 'text/plain' },
        { ext: 'csv', content: 'col1,col2,col3\nval1,val2,val3', expectedMime: 'text/csv' },
        { ext: 'md', content: '# Title\nContent here', expectedMime: 'text/markdown' },
        { ext: 'svg', content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', expectedMime: 'image/svg+xml' },
      ];

      testCases.forEach(({ ext, content, expectedMime }) => {
        const filePath = path.join(testDir, `test-mime.${ext}`);
        fs.writeFileSync(filePath, content);

        const result = fileValidator.validateFile(filePath, `test-mime.${ext}`);

        expect(result.detectedMime).toBe(expectedMime);
      });
    });
  });
});
