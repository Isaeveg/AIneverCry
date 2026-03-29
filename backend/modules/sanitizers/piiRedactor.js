const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(?:\+[\d]{1,3}[-.\s]?)?\(?[\d]{2,4}\)?[-.\s]?[\d]{2,4}[-.\s]?[\d]{2,4}(?:[-.\s]?[\d]{1,4})?\b/g,
  ssn: /\b(?!000|666)[0-9]{3}-?(?!00)[0-9]{2}-?(?!0000)[0-9]{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ipAddress: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  apiKey: /api[_-]?key[:\s]*([a-zA-Z0-9_\-]{20,})/gi,
  password: /password[:\s]*([^\s,\n]{6,})/gi,
  privateKey: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
};

const SENSITIVE_KEYWORDS = [
  'password', 'secret', 'token', 'apikey', 'api_key', 'auth',
  'private', 'confidential', 'ssn', 'social',
];

function detectPII(text) {
  const findings = [];
  if (!text || typeof text !== 'string') return findings;

  const emails = text.match(PII_PATTERNS.email);
  if (emails) {
    findings.push({
      type: 'EMAIL',
      count: emails.length,
      severity: 'medium',
      samples: emails.slice(0, 3),
    });
  }

  PII_PATTERNS.phone.lastIndex = 0;
  const phones = text.match(PII_PATTERNS.phone);
  if (phones) {
    findings.push({
      type: 'PHONE',
      count: phones.length,
      severity: 'medium',
      samples: phones.slice(0, 3),
    });
  }

  const ssns = text.match(PII_PATTERNS.ssn);
  if (ssns) {
    findings.push({
      type: 'SSN',
      count: ssns.length,
      severity: 'high',
      samples: ssns.slice(0, 1),
    });
  }

  const creditCards = text.match(PII_PATTERNS.creditCard);
  if (creditCards) {
    findings.push({
      type: 'CREDIT_CARD',
      count: creditCards.length,
      severity: 'critical',
      samples: creditCards.slice(0, 1),
    });
  }

  const ips = text.match(PII_PATTERNS.ipAddress);
  if (ips) {
    findings.push({
      type: 'IP_ADDRESS',
      count: ips.length,
      severity: 'low',
      samples: ips.slice(0, 3),
    });
  }

  const apiKeys = text.match(PII_PATTERNS.apiKey);
  if (apiKeys) {
    findings.push({
      type: 'API_KEY',
      count: apiKeys.length,
      severity: 'critical',
      samples: apiKeys.slice(0, 1),
    });
  }

  const passwords = text.match(PII_PATTERNS.password);
  if (passwords) {
    findings.push({
      type: 'PASSWORD',
      count: passwords.length,
      severity: 'critical',
    });
  }

  const privateKeys = text.match(PII_PATTERNS.privateKey);
  if (privateKeys) {
    findings.push({
      type: 'PRIVATE_KEY',
      count: privateKeys.length,
      severity: 'critical',
    });
  }

  return findings;
}

function redactPII(text) {
  if (!text || typeof text !== 'string') return text;

  let redacted = text;
  redacted = redacted.replace(PII_PATTERNS.email, '[EMAIL_REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.phone, '[PHONE_REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.ssn, '[SSN_REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.creditCard, '[CREDIT_CARD_REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.ipAddress, '[IP_REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.apiKey, 'api_key=[APIKEY_REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.password, 'password=[PASSWORD_REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.privateKey, '[PRIVATE_KEY_REDACTED]');

  return redacted;
}

function detectContextualSensitivity(text) {
  const issues = [];
  if (!text || typeof text !== 'string') return issues;

  const lowerText = text.toLowerCase();

  SENSITIVE_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      const index = lowerText.indexOf(keyword);
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + keyword.length + 50);
      const context = text.substring(start, end).trim();

      issues.push({
        keyword,
        context: context,
        severity: 'medium',
      });
    }
  });

  return issues;
}

function analyzePII(text) {
  const pii = detectPII(text);
  const contextual = detectContextualSensitivity(text);
  const redacted = redactPII(text);

  const hasCritical = pii.some(p => p.severity === 'critical');
  const hasHighRisk = pii.some(p => p.severity === 'high') || contextual.length > 0;

  return {
    piiDetected: pii,
    contextualSensitivity: contextual,
    redactedContent: redacted,
    summary: {
      totalIssues: pii.length + contextual.length,
      criticalFindings: pii.filter(p => p.severity === 'critical').length,
      hasCriticalData: hasCritical,
      hasHighRiskData: hasHighRisk,
      requiresRedaction: pii.length > 0,
    },
  };
}

function scanObjectForSensitivity(obj, depth = 0) {
  const maxDepth = 10;
  const findings = [];

  if (depth > maxDepth) return findings;

  if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach(key => {
      const value = obj[key];

      if (SENSITIVE_KEYWORDS.some(kw => key.toLowerCase().includes(kw))) {
        findings.push({
          type: 'SENSITIVE_KEY',
          key: key,
          value: typeof value === 'string' ? value.substring(0, 50) : typeof value,
        });
      }

      if (typeof value === 'object' && value !== null) {
        findings.push(...scanObjectForSensitivity(value, depth + 1));
      } else if (typeof value === 'string') {
        const pii = detectPII(value);
        if (pii.length > 0) {
          findings.push({
            type: 'PII_IN_VALUE',
            key: key,
            piiTypes: pii.map(p => p.type),
          });
        }
      }
    });
  }

  return findings;
}

module.exports = {
  detectPII,
  redactPII,
  detectContextualSensitivity,
  analyzePII,
  scanObjectForSensitivity,
};
