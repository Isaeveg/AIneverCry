const {
  extractFromTxt,
  extractFromMarkdown,
  extractFromCsv,
} = require('../modules/extractors/textExtractor');
const fs = require('fs');
const path = require('path');

describe('textExtractor', () => {
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

  describe('extractFromTxt', () => {
    test('should extract text from TXT file', () => {
      const txtPath = path.join(testDir, 'test.txt');
      fs.writeFileSync(txtPath, 'Hello World\nThis is a test file');

      const result = extractFromTxt(txtPath);

      expect(result.success).toBe(true);
      expect(result.type).toBe('TXT');
      expect(result.lines).toBeGreaterThan(0);
      expect(result.characters).toBeGreaterThan(0);
    });

    test('should calculate line count correctly', () => {
      const txtPath = path.join(testDir, 'lines.txt');
      fs.writeFileSync(txtPath, 'Line 1\nLine 2\nLine 3');

      const result = extractFromTxt(txtPath);

      expect(result.lines).toBe(3);
    });

    test('should count characters correctly', () => {
      const txtPath = path.join(testDir, 'chars.txt');
      const content = 'Test123';
      fs.writeFileSync(txtPath, content);

      const result = extractFromTxt(txtPath);

      expect(result.characters).toBe(content.length);
    });

    test('should generate preview', () => {
      const txtPath = path.join(testDir, 'preview.txt');
      const content = 'a'.repeat(1000) + ' END';
      fs.writeFileSync(txtPath, content);

      const result = extractFromTxt(txtPath);

      expect(result.preview.length).toBeLessThanOrEqual(500);
    });

    test('should handle empty file', () => {
      const txtPath = path.join(testDir, 'empty.txt');
      fs.writeFileSync(txtPath, '');

      const result = extractFromTxt(txtPath);

      expect(result.success).toBe(true);
      expect(result.characters).toBe(0);
    });
  });

  describe('extractFromMarkdown', () => {
    test('should extract markdown content', () => {
      const mdPath = path.join(testDir, 'test.md');
      fs.writeFileSync(mdPath, '# Title\n## Subtitle\nContent here');

      const result = extractFromMarkdown(mdPath);

      expect(result.success).toBe(true);
      expect(result.type).toBe('MD');
    });

    test('should extract headings', () => {
      const mdPath = path.join(testDir, 'headings.md');
      fs.writeFileSync(mdPath, '# h1\n## h2\n### h3\nContent');

      const result = extractFromMarkdown(mdPath);

      expect(result.headings.length).toBe(3);
      expect(result.headings[0]).toContain('h1');
    });

    test('should count lines correctly', () => {
      const mdPath = path.join(testDir, 'md-lines.md');
      fs.writeFileSync(mdPath, '# Header\nParagraph 1\nParagraph 2');

      const result = extractFromMarkdown(mdPath);

      expect(result.lines).toBeGreaterThan(0);
    });
  });

  describe('extractFromCsv', () => {
    test('should extract CSV data', () => {
      const csvPath = path.join(testDir, 'test.csv');
      fs.writeFileSync(csvPath, 'name,email\nJohn,john@example.com\nJane,jane@example.com');

      const result = extractFromCsv(csvPath);

      expect(result.success).toBe(true);
      expect(result.type).toBe('CSV');
      expect(result.headers).toEqual(['name', 'email']);
    });

    test('should count rows correctly', () => {
      const csvPath = path.join(testDir, 'rows.csv');
      fs.writeFileSync(csvPath, 'col1,col2\nval1,val2\nval3,val4');

      const result = extractFromCsv(csvPath);

      expect(result.rowCount).toBe(2);
    });

    test('should count columns correctly', () => {
      const csvPath = path.join(testDir, 'cols.csv');
      fs.writeFileSync(csvPath, 'a,b,c,d\n1,2,3,4');

      const result = extractFromCsv(csvPath);

      expect(result.columnCount).toBe(4);
    });

    test('should handle quoted fields', () => {
      const csvPath = path.join(testDir, 'quoted.csv');
      fs.writeFileSync(csvPath, 'name,address\n"John Doe","123 Main St"');

      const result = extractFromCsv(csvPath);

      expect(result.success).toBe(true);
      expect(result.data[0][0]).not.toContain('"');
    });

    test('should limit preview to 10 rows', () => {
      const csvPath = path.join(testDir, 'large.csv');
      let content = 'col1,col2\n';
      for (let i = 0; i < 20; i++) {
        content += `val${i},data${i}\n`;
      }
      fs.writeFileSync(csvPath, content);

      const result = extractFromCsv(csvPath);

      expect(result.data.length).toBe(10);
    });

    test('should handle empty CSV', () => {
      const csvPath = path.join(testDir, 'empty.csv');
      fs.writeFileSync(csvPath, '');

      const result = extractFromCsv(csvPath);

      expect(result.success).toBe(false);
    });
  });

  describe('extractFromCsv - Edge cases', () => {
    test('should handle single column CSV', () => {
      const csvPath = path.join(testDir, 'single-col.csv');
      fs.writeFileSync(csvPath, 'name\nJohn\nJane');

      const result = extractFromCsv(csvPath);

      expect(result.columnCount).toBe(1);
      expect(result.rowCount).toBe(2);
    });

    test('should handle CSV with different delimiters in quoted fields', () => {
      const csvPath = path.join(testDir, 'delim.csv');
      fs.writeFileSync(csvPath, 'name,description\n"John","Has, comma"');

      const result = extractFromCsv(csvPath);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('Content extraction - Special characters', () => {
    test('should handle UTF-8 characters', () => {
      const txtPath = path.join(testDir, 'utf8.txt');
      fs.writeFileSync(txtPath, 'Héllo Wørld 中文 العربية');

      const result = extractFromTxt(txtPath);

      expect(result.success).toBe(true);
      expect(result.characters).toBeGreaterThan(0);
    });
  });
});
