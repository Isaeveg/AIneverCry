const piiRedactor = require('../modules/sanitizers/piiRedactor');

describe('piiRedactor', () => {
  describe('analyzePII - Email detection', () => {
    test('should detect single email', () => {
      const content = 'Contact me at john@example.com';
      const result = piiRedactor.analyzePII(content);

      expect(result.piiDetected.length).toBeGreaterThan(0);
      expect(result.piiDetected[0].type).toBe('EMAIL');
      expect(result.summary.requiresRedaction).toBe(true);
    });

    test('should detect multiple emails', () => {
      const content = 'Email admin@company.com or support@company.com';
      const result = piiRedactor.analyzePII(content);

      const emails = result.piiDetected.filter(p => p.type === 'EMAIL');
      expect(emails.length).toBeGreaterThan(0);
      expect(emails[0].count).toBeGreaterThanOrEqual(2);
    });

    test('should detect various email formats', () => {
      const testCases = [
        'simple@domain.com',
        'user.name@company.co.uk',
        'first+last@example.org',
        'test_email@domain.net'
      ];

      testCases.forEach(email => {
        const result = piiRedactor.analyzePII(email);
        expect(result.piiDetected.length).toBeGreaterThan(0);
        expect(result.piiDetected[0].type).toBe('EMAIL');
      });
    });
  });

  describe('analyzePII - Phone detection', () => {
    test('should detect phone numbers', () => {
      const content = 'Call us at 555-123-4567';
      const result = piiRedactor.analyzePII(content);

      expect(result.piiDetected.length).toBeGreaterThan(0);
      const phones = result.piiDetected.filter(p => p.type === 'PHONE');
      expect(phones.length).toBeGreaterThan(0);
    });

    test('should detect phone with different formats', () => {
      const testCases = [
        '555-123-4567',
        '(555)123-4567',
        '+1-555-123-4567'
      ];

      testCases.forEach(phone => {
        const result = piiRedactor.analyzePII(phone);
        const hasPhone = result.piiDetected.some(p => p.type === 'PHONE');
        expect(hasPhone).toBe(true);
      });
    });
  });

  describe('analyzePII - Credit card detection', () => {
    test('should detect credit card numbers', () => {
      const content = 'Card: 4111-1111-1111-1111';
      const result = piiRedactor.analyzePII(content);

      const hasCC = result.piiDetected.some(p => p.type === 'CREDIT_CARD');
      expect(hasCC).toBe(true);
      expect(result.summary.requiresRedaction).toBe(true);
    });

    test('should detect cards without dashes', () => {
      const content = '4111111111111111';
      const result = piiRedactor.analyzePII(content);

      const hasCC = result.piiDetected.some(p => p.type === 'CREDIT_CARD');
      expect(hasCC).toBe(true);
    });
  });

  describe('analyzePII - API key detection', () => {
    test('should detect API keys', () => {
      const content = 'api_key: sk_live_abc123def456ghi789jkl';
      const result = piiRedactor.analyzePII(content);

      const hasApiKey = result.piiDetected.some(p => p.type === 'API_KEY');
      expect(hasApiKey).toBe(true);
    });

    test('should detect various key formats', () => {
      const testCases = [
        'api-key: 12345678901234567890',
        'API_KEY: abcdefghijklmnopqrst'
      ];

      testCases.forEach(keyContent => {
        const result = piiRedactor.analyzePII(keyContent);
        const hasKey = result.piiDetected.some(p => p.type === 'API_KEY');
        expect(hasKey).toBe(true);
      });
    });
  });

  describe('analyzePII - Redaction', () => {
    test('should redact detected PII', () => {
      const content = 'Email: john@example.com, Phone: 555-123-4567';
      const result = piiRedactor.analyzePII(content);

      expect(result.redactedContent).toContain('[EMAIL_REDACTED]');
      expect(result.redactedContent).not.toContain('john@example.com');
      expect(result.redactedContent).toContain('[PHONE_REDACTED]');
      expect(result.redactedContent).not.toContain('555-123-4567');
    });

    test('should preserve non-PII content', () => {
      const content = 'This is a clean document about programming';
      const result = piiRedactor.analyzePII(content);

      expect(result.redactedContent).toBe(content);
      expect(result.summary.requiresRedaction).toBe(false);
    });

    test('should track redaction statistics', () => {
      const content = 'Email: john@example.com and jane@example.com';
      const result = piiRedactor.analyzePII(content);

      expect(result.redactedContent).toContain('[EMAIL_REDACTED]');
      expect(result.summary.requiresRedaction).toBe(true);
    });
  });

  describe('analyzePII - Complex scenarios', () => {
    test('should handle mixed PII types', () => {
      const content = `
        Customer: John Doe
        Email: john@example.com
        Phone: 555-123-4567
        Card: 4111-1111-1111-1111
        API Key: api_key: sk_live_12345678901234567890
      `;

      const result = piiRedactor.analyzePII(content);

      expect(result.piiDetected.length).toBeGreaterThanOrEqual(3);
      expect(result.summary.requiresRedaction).toBe(true);
    });

    test('should not flag legitimate URLs', () => {
      const content = 'Visit https://example.com/page';
      const result = piiRedactor.analyzePII(content);

      const hasEmail = result.piiDetected.some(p => p.type === 'EMAIL');
      expect(hasEmail).toBe(false);
    });

    test('should detect but not overly penalize IP addresses', () => {
      const content = 'Server running on 192.168.1.1:8080';
      const result = piiRedactor.analyzePII(content);

      const ips = result.piiDetected.filter(p => p.type === 'IP_ADDRESS');
      if (ips.length > 0) {
        expect(ips[0].severity).toBe('low');
      }
    });
  });

  describe('analyzePII - Summary generation', () => {
    test('should generate accurate summary', () => {
      const content = 'Contact: john@example.com or call 555-123-4567';
      const result = piiRedactor.analyzePII(content);

      expect(result.summary).toHaveProperty('requiresRedaction');
      expect(result.summary).toHaveProperty('totalIssues');
      expect(typeof result.summary.requiresRedaction).toBe('boolean');
    });
  });

  describe('analyzePII - Edge cases', () => {
    test('should handle empty string', () => {
      const result = piiRedactor.analyzePII('');

      expect(result.piiDetected).toBeDefined();
      expect(result.summary.requiresRedaction).toBe(false);
    });

    test('should handle very long content', () => {
      const content = 'email: ' + 'a'.repeat(1000) + '@example.com';
      const result = piiRedactor.analyzePII(content);

      expect(result.redactedContent).toBeDefined();
    });

    test('should be case-insensitive for keywords', () => {
      const testCases = [
        'PASSWORD: secret123',
        'Password: secret123',
        'password: secret123'
      ];

      testCases.forEach(content => {
        const result = piiRedactor.analyzePII(content);
        expect(result.piiDetected.length).toBeGreaterThan(0);
      });
    });
  });
});
