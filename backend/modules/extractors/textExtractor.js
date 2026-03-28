const fs = require('fs');

function extractFromTxt(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      success: true,
      type: 'TXT',
      rawContent: content,
      lines: content.split('\n').length,
      characters: content.length,
      preview: content.substring(0, 500),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractFromMarkdown(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headings = lines.filter(l => l.match(/^#+\s/)).map(h => h.trim());

    return {
      success: true,
      type: 'MD',
      rawContent: content,
      lines: lines.length,
      characters: content.length,
      headings: headings,
      preview: content.substring(0, 500),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractFromCsv(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      return { success: false, error: 'CSV file is empty' };
    }

    const rows = lines.map(line => {
      return line.split(',').map(field => field.trim().replace(/^["']|["']$/g, ''));
    });

    const headers = rows[0];
    const data = rows.slice(1);

    return {
      success: true,
      type: 'CSV',
      headers: headers,
      rowCount: data.length,
      columnCount: headers.length,
      data: data.slice(0, 10),
      preview: `${headers.length} columns, ${data.length} rows`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractFromPdf(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('binary');
    const textMatches = text.match(/BT([\s\S]*?)ET/g);
    let extractedText = '';

    if (textMatches) {
      extractedText = textMatches
        .join(' ')
        .replace(/\(([^)]*)\)/g, '$1')
        .replace(/[<>]/g, '')
        .trim();
    }

    if (!extractedText) {
      extractedText = buffer
        .toString()
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();
    }

    const preview = extractedText.substring(0, 500);
    const lines = extractedText.split('\n').length;

    return {
      success: true,
      type: 'PDF',
      rawContent: extractedText,
      lines: lines,
      characters: extractedText.length,
      preview: preview,
      note: 'Basic text extraction - production should use pdf-parse library',
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractFromSvg(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const svgMatch = content.match(/<svg[^>]*>/);
    const widthMatch = content.match(/width=["']([^"']*)/);
    const heightMatch = content.match(/height=["']([^"']*)/);

    const shapes = {
      circles: (content.match(/<circle/g) || []).length,
      rects: (content.match(/<rect/g) || []).length,
      paths: (content.match(/<path/g) || []).length,
      lines: (content.match(/<line/g) || []).length,
      text: (content.match(/<text/g) || []).length,
    };

    return {
      success: true,
      type: 'SVG',
      rawContent: content,
      width: widthMatch ? widthMatch[1] : 'not specified',
      height: heightMatch ? heightMatch[1] : 'not specified',
      shapes: shapes,
      preview: content.substring(0, 500),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractContent(filePath, fileType, originalFilename) {
  const ext = fileType?.toUpperCase() || originalFilename.split('.').pop().toUpperCase();

  switch (ext) {
    case 'TXT':
      return extractFromTxt(filePath);
    case 'MD':
      return extractFromMarkdown(filePath);
    case 'CSV':
      return extractFromCsv(filePath);
    case 'PDF':
      return extractFromPdf(filePath);
    case 'SVG':
      return extractFromSvg(filePath);
    default:
      return { success: false, error: `Unsupported file type: ${ext}` };
  }
}

module.exports = {
  extractContent,
  extractFromTxt,
  extractFromMarkdown,
  extractFromCsv,
  extractFromPdf,
  extractFromSvg,
};
