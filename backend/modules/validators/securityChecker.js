const fs = require('fs');

const MALICIOUS_PATTERNS = {
  executable: [
    /\.exe$/i, /\.com$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i,
    /\.vbs$/i, /\.js$/i, /\.jar$/i, /\.zip[\s\S]*\.(exe|bat|vbs)/i,
  ],
  xss: [
    /<script[^>]*>/gi, /javascript:/gi, /on\w+\s*=/gi,
    /<iframe/gi, /<embed/gi, /<object/gi,
  ],
  injectionPatterns: [
    /(\.\.\/).+/g, /;[\s]*rm[\s]+/gi, /DROP[\s]+TABLE/gi,
    /DELETE[\s]+FROM/gi, /INSERT[\s]+INTO/gi, /UPDATE[\s]+SET/gi,
  ],
};

function checkFilename(filename) {
  const issues = [];
  const parts = filename.split('.');

  if (parts.length > 2) {
    const ext = parts[parts.length - 1].toLowerCase();
    const prevExt = parts[parts.length - 2].toLowerCase();
    issues.push({
      severity: 'high',
      message: `Double extension detected: .${prevExt}.${ext}`,
      code: 'DOUBLE_EXTENSION',
    });
  }

  if (MALICIOUS_PATTERNS.executable.some(p => p.test(filename))) {
    issues.push({
      severity: 'critical',
      message: 'Potential executable file detected',
      code: 'EXECUTABLE_DETECTED',
    });
  }

  if (/[<>"|?*]/.test(filename)) {
    issues.push({
      severity: 'high',
      message: 'Filename contains suspicious characters',
      code: 'SUSPICIOUS_CHARS',
    });
  }

  return issues;
}

function checkFileContent(filePath, detectedType) {
  const issues = [];
  const issueCodes = new Set();

  try {
    if (['PDF', 'TXT', 'CSV', 'MD', 'SVG'].includes(detectedType)) {
      const content = fs.readFileSync(filePath, 'utf-8');

      MALICIOUS_PATTERNS.xss.forEach(pattern => {
        pattern.lastIndex = 0;
        if (pattern.test(content) && !issueCodes.has('XSS_PAYLOAD')) {
          issueCodes.add('XSS_PAYLOAD');
          issues.push({
            severity: 'critical',
            message: 'XSS payload detected in content',
            code: 'XSS_PAYLOAD',
          });
        }
      });

      MALICIOUS_PATTERNS.injectionPatterns.forEach(pattern => {
        pattern.lastIndex = 0;
        if (pattern.test(content) && !issueCodes.has('INJECTION_PATTERN')) {
          issueCodes.add('INJECTION_PATTERN');
          issues.push({
            severity: 'high',
            message: 'SQL injection pattern detected',
            code: 'INJECTION_PATTERN',
          });
        }
      });

      if (detectedType === 'SVG') {
        if (/<script/i.test(content) && !issueCodes.has('SVG_SCRIPT')) {
          issueCodes.add('SVG_SCRIPT');
          issues.push({
            severity: 'critical',
            message: 'SVG contains embedded script',
            code: 'SVG_SCRIPT',
          });
        }
        if (/on\w+\s*=/i.test(content) && !issueCodes.has('SVG_EVENT_HANDLER')) {
          issueCodes.add('SVG_EVENT_HANDLER');
          issues.push({
            severity: 'high',
            message: 'SVG contains event handlers',
            code: 'SVG_EVENT_HANDLER',
          });
        }
      }
    }

    if (['PNG', 'JPG'].includes(detectedType)) {
      const buffer = Buffer.alloc(1024);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);

      const content = buffer.toString('utf-8', 0, 1024);
      if (/<script/i.test(content) || /javascript:/i.test(content)) {
        issues.push({
          severity: 'high',
          message: 'Potential polyglot - image contains executable code',
          code: 'POLYGLOT_FILE',
        });
      }
    }
  } catch (err) {
    issues.push({
      severity: 'medium',
      message: `Could not scan file content: ${err.message}`,
      code: 'SCAN_ERROR',
    });
  }

  return issues;
}

function checkSecurity(filePath, filename, detectedType) {
  const allIssues = [];
  const filenameIssues = checkFilename(filename);
  allIssues.push(...filenameIssues);
  const contentIssues = checkFileContent(filePath, detectedType);
  allIssues.push(...contentIssues);
  const isMalicious = allIssues.some(issue => issue.severity === 'critical');

  return {
    isMalicious,
    issues: allIssues,
    isSafe: allIssues.length === 0,
  };
}

module.exports = {
  checkSecurity,
  checkFilename,
  checkFileContent,
};
