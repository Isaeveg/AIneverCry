function sanitizeSvg(content) {
  let sanitized = content;

  sanitized = sanitized.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');

  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');

  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');

  const styleTagRegex = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;
  sanitized = sanitized.replace(styleTagRegex, (match) => {
    const content = match.replace(/<\/?style[^>]*>/gi, '');
    if (content.includes('javascript:') || content.includes('expression(')) {
      return '';
    }
    return match;
  });

  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

  return sanitized.trim();
}

function validateSvgSecurity(content) {
  const threats = [];

  if (/<metadata[\s\S]*?<\/metadata>/i.test(content)) {
    threats.push('Metadata detected');
  }

  if (/<script[\s>]/i.test(content)) {
    threats.push('Script tags detected');
  }

  if (/on\w+\s*=/i.test(content)) {
    threats.push('Event handlers detected');
  }

  if (/<iframe/i.test(content)) {
    threats.push('iFrame detected');
  }

  if (/javascript:/i.test(content)) {
    threats.push('JavaScript protocol detected');
  }

  if (/<object|<embed/i.test(content)) {
    threats.push('Embedded objects detected');
  }

  return {
    isSafe: threats.length === 0,
    threats: threats,
  };
}

module.exports = {
  sanitizeSvg,
  validateSvgSecurity,
};
