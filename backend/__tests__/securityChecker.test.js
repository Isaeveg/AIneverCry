const securityChecker = require('../modules/validators/securityChecker');
const fs = require('fs');
const path = require('path');

describe('securityChecker', () => {
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

  describe('checkSecurity - XSS detection', () => {
    test('should detect script tag in content', () => {
      const testPath = path.join(testDir, 'xss.txt');
      fs.writeFileSync(testPath, 'Hello <script>alert("xss")</script> world');

      const result = securityChecker.checkSecurity(testPath, 'xss.txt', 'TXT');

      expect(result.isSafe).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].code).toBe('XSS_PAYLOAD');
    });

    test('should detect javascript: protocol', () => {
      const testPath = path.join(testDir, 'js-protocol.svg');
      fs.writeFileSync(testPath, '<svg><a href="javascript:alert(1)">click</a></svg>');

      const result = securityChecker.checkSecurity(testPath, 'js-protocol.svg', 'SVG');

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].code).toBe('XSS_PAYLOAD');
    });

    test('should detect event handler in SVG', () => {
      const testPath = path.join(testDir, 'onclick.svg');
      fs.writeFileSync(testPath, '<svg><rect onclick="alert(1)"/></svg>');

      const result = securityChecker.checkSecurity(testPath, 'onclick.svg', 'SVG');

      expect(result.issues.length).toBeGreaterThan(0);
      const hasEventHandler = result.issues.some(i => i.code === 'SVG_EVENT_HANDLER');
      expect(hasEventHandler).toBe(true);
    });
  });

  describe('checkSecurity - SQL injection detection', () => {
    test('should detect DROP TABLE pattern', () => {
      const testPath = path.join(testDir, 'sql-drop.csv');
      fs.writeFileSync(testPath, 'name,value\ntest,"; DROP TABLE users; --');

      const result = securityChecker.checkSecurity(testPath, 'sql-drop.csv', 'CSV');

      expect(result.isSafe).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      const hasInjection = result.issues.some(i => i.code === 'INJECTION_PATTERN');
      expect(hasInjection).toBe(true);
    });

    test('should detect DELETE FROM pattern', () => {
      const testPath = path.join(testDir, 'sql-delete.txt');
      fs.writeFileSync(testPath, "'; DELETE FROM accounts WHERE '1'='1");

      const result = securityChecker.checkSecurity(testPath, 'sql-delete.txt', 'TXT');

      expect(result.issues.length).toBeGreaterThan(0);
      const hasInjection = result.issues.some(i => i.code === 'INJECTION_PATTERN');
      expect(hasInjection).toBe(true);
    });

    test('should detect INSERT INTO pattern', () => {
      const testPath = path.join(testDir, 'sql-insert.txt');
      fs.writeFileSync(testPath, "'; INSERT INTO users VALUES ('admin', 'pass');");

      const result = securityChecker.checkSecurity(testPath, 'sql-insert.txt', 'TXT');

      expect(result.issues.length).toBeGreaterThan(0);
      const hasInjection = result.issues.some(i => i.code === 'INJECTION_PATTERN');
      expect(hasInjection).toBe(true);
    });
  });

  describe('checkSecurity - Polyglot detection', () => {
    test('should detect executable header in binary file', () => {
      const testPath = path.join(testDir, 'polyglot.jpg');
      const content = Buffer.alloc(512, 0xFF);
      const mzHeader = Buffer.from([0x4D, 0x5A]);
      const combined = Buffer.concat([mzHeader, content]);
      const withScript = Buffer.concat([combined, Buffer.from('<script>')]);
      fs.writeFileSync(testPath, withScript);

      const result = securityChecker.checkSecurity(testPath, 'polyglot.jpg', 'JPG');

      expect(result.issues.length).toBeGreaterThan(0);
      const hasPolyglot = result.issues.some(i => i.code === 'POLYGLOT_FILE');
      expect(hasPolyglot).toBe(true);
    });
  });

  describe('checkSecurity - Double extension', () => {
    test('should detect double extension vulnerability', () => {
      const testPath = path.join(testDir, 'file.exe.pdf');
      fs.writeFileSync(testPath, 'fake pdf content');

      const result = securityChecker.checkSecurity(testPath, 'file.exe.pdf', 'TXT');

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].code).toBe('DOUBLE_EXTENSION');
    });
  });

  describe('checkSecurity - Clean content', () => {
    test('should pass clean text file', () => {
      const testPath = path.join(testDir, 'clean.txt');
      fs.writeFileSync(testPath, 'This is clean content with no malicious patterns');

      const result = securityChecker.checkSecurity(testPath, 'clean.txt', 'TXT');

      expect(result.isSafe).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    test('should pass clean CSV file', () => {
      const testPath = path.join(testDir, 'clean.csv');
      fs.writeFileSync(testPath, 'name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com');

      const result = securityChecker.checkSecurity(testPath, 'clean.csv', 'CSV');

      expect(result.isSafe).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    test('should pass clean SVG file', () => {
      const testPath = path.join(testDir, 'clean.svg');
      fs.writeFileSync(testPath, '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>');

      const result = securityChecker.checkSecurity(testPath, 'clean.svg', 'SVG');

      expect(result.isSafe).toBe(true);
      expect(result.issues.length).toBe(0);
    });
  });

  describe('checkSecurity - Issue severity', () => {
    test('should mark executable file detection as CRITICAL', () => {
      const testPath = path.join(testDir, 'critical.exe');
      fs.writeFileSync(testPath, Buffer.from([0x4D, 0x5A]));

      const result = securityChecker.checkSecurity(testPath, 'critical.exe', 'TXT');

      expect(result.isMalicious).toBe(true);
      const issue = result.issues.find(i => i.code === 'EXECUTABLE_DETECTED');
      if (issue) {
        expect(issue.severity).toBe('critical');
      }
    });
  });

  describe('checkSecurity - Multiple issues', () => {
    test('should detect multiple security issues in one file', () => {
      const testPath = path.join(testDir, 'multi-issue.txt');
      fs.writeFileSync(testPath, 'Text with <script>alert(1)</script> and DROP TABLE users;');

      const result = securityChecker.checkSecurity(testPath, 'multi-issue.txt', 'TXT');

      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      const codes = result.issues.map(i => i.code);
      expect(codes).toContain('XSS_PAYLOAD');
      expect(codes).toContain('INJECTION_PATTERN');
    });
  });

  describe('checkSecurity - Issue deduplication', () => {
    test('should avoid duplicate issues for same pattern', () => {
      const testPath = path.join(testDir, 'duplicate.txt');
      fs.writeFileSync(testPath, '<script>1</script> and <script>2</script> repeat');

      const result = securityChecker.checkSecurity(testPath, 'duplicate.txt', 'TXT');

      const xssCount = result.issues.filter(i => i.code === 'XSS_PAYLOAD').length;
      expect(xssCount).toBeGreaterThanOrEqual(1);
    });
  });
});
