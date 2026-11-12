/**
 * Generador de documentos Word (.docx) para estudios bíblicos
 * Implementa el formato DOCX como ZIP con XML
 */

const TEXT_ENCODER = new TextEncoder();

// Escape XML characters
function escapeXml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// CRC32 calculation for ZIP
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Create ZIP file from array of {name, data} objects
function createZip(files) {
  const chunks = [];
  let offset = 0;
  const directory = [];
  let dirSize = 0;

  for (const file of files) {
    const nameBytes = TEXT_ENCODER.encode(file.name);
    let dataBytes;

    if (file.data instanceof Blob) {
      // Para blobs grandes, los convertimos
      dataBytes = new Uint8Array(file.data);
    } else if (typeof file.data === 'string') {
      dataBytes = TEXT_ENCODER.encode(file.data);
    } else if (file.data instanceof Uint8Array) {
      dataBytes = file.data;
    } else {
      dataBytes = TEXT_ENCODER.encode(String(file.data));
    }

    const crc = crc32(dataBytes);
    const header = new Uint8Array(30 + nameBytes.length);
    const h = new DataView(header.buffer);

    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x800, true);
    h.setUint16(8, 0, true);
    h.setUint16(12, 33, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, dataBytes.length, true);
    h.setUint32(22, dataBytes.length, true);
    h.setUint16(26, nameBytes.length, true);
    h.setUint16(28, 0, true);
    header.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const c = new DataView(central.buffer);

    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, dataBytes.length, true);
    c.setUint32(24, dataBytes.length, true);
    c.setUint16(28, nameBytes.length, true);
    c.setUint16(30, 0, true);
    c.setUint16(32, 0, true);
    c.setUint32(34, offset, true);
    c.setUint16(38, 0, true);
    c.setUint32(42, crc, true);
    central.set(nameBytes, 46);

    chunks.push(header, dataBytes);
    directory.push(central);
    offset += header.length + dataBytes.length;
    dirSize += central.length;
  }

  // End of central directory
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, dirSize, true);
  view.setUint32(16, offset, true);

  return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
}

// Slug for filenames
function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

/**
 * Generate a Word document from study data
 */
export async function generateWordDocument(study, options = {}) {
  const { includeImages = true, useDeepMode = false, coverPage = false } = options;

  const title = escapeXml(study.title || study.citation);
  const citation = escapeXml(study.citation || '');
  const passage = escapeXml(study.passage || '');
  const explanation = escapeXml(study.explanation || study.summary || '');
  const context = escapeXml(study.context || '');
  const application = escapeXml(study.application || '');
  const keyIdeas = study.keyIdeas || [];
  const questions = study.questions || [];
  const nodes = study.nodes || [];

  // Image handling
  let imageRel = '';
  let imagePart = '';
  let imageBytes = null;

  if (includeImages && study.artSrc) {
    const rId = 'rIdImg1';
    const match = study.artSrc.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);

    if (match) {
      try {
        imageBytes = new Uint8Array(Buffer.from(match[2], 'base64'));
        imageRel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>`;
        imagePart = `<Override PartName="/word/media/image1.png" ContentType="image/png"/>`;
      } catch (e) {
        // Continue without image if conversion fails
      }
    }
  }

  // Build content sections
  let sectionsXml = '';

  if (explanation) {
    sectionsXml += `    <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>Resumen del pasaje</w:t></w:r></w:p>\n`;
    sectionsXml += `    <w:p><w:r><w:t>${explanation}</w:t></w:r></w:p>\n`;
  }

  if (context && useDeepMode) {
    sectionsXml += `    <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>Contexto histórico y cultural</w:t></w:r></w:p>\n`;
    sectionsXml += `    <w:p><w:r><w:t>${context}</w:t></w:r></w:p>\n`;
  }

  if (study.sections && study.sections.length > 0) {
    for (const section of study.sections) {
      if (section.heading && section.body) {
        sectionsXml += `    <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(section.heading)}</w:t></w:r></w:p>\n`;
        sectionsXml += `    <w:p><w:r><w:t>${escapeXml(section.body)}</w:t></w:r></w:p>\n`;
      }
    }
  }

  if (study.takeaway) {
    sectionsXml += `    <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>Aplicación</w:t></w:r></w:p>\n`;
    sectionsXml += `    <w:p><w:r><w:t>${escapeXml(study.takeaway)}</w:t></w:r></w:p>\n`;
  }

  // Add key ideas for deep mode
  if (useDeepMode && keyIdeas.length > 0) {
    sectionsXml += `    <w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Ideas principales</w:t></w:r></w:p>\n`;
    for (const ki of keyIdeas) {
      sectionsXml += `    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(ki.title || 'Sin título')}</w:t></w:r></w:p>\n`;
      sectionsXml += `    <w:p><w:r><w:t>${escapeXml(ki.explanation || '')}</w:t></w:r></w:p>\n`;
    }
  }

  // Add questions for deep mode
  if (useDeepMode && questions.length > 0) {
    sectionsXml += `    <w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Preguntas para reflexionar</w:t></w:r></w:p>\n`;
    sectionsXml += `    <w:p><w:r><w:t>• ${questions.map(q => escapeXml(q)).join('\n• ')}</w:t></w:r></w:p>\n`;
  }

  // Add nodes for deep mode
  if (useDeepMode && nodes.length > 0) {
    sectionsXml += `    <w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Conexiones bíblicas</w:t></w:r></w:p>\n`;
    for (const node of nodes) {
      sectionsXml += `    <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(node.reference || 'Sin referencia')}: ${escapeXml(node.title || 'Sin título')}</w:t></w:r></w:p>\n`;
      sectionsXml += `    <w:p><w:r><w:t>${escapeXml(node.explanation || '')}</w:t></w:r></w:p>\n`;
      if (node.application) {
        sectionsXml += `    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>${escapeXml(node.application)}</w:t></w:r></w:p>\n`;
      }
    }
  }

  // Image insertion XML
  let imageXml = '';
  if (imageBytes) {
    imageXml = `<w:p><w:r><w:drawing>
  <wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="4572000" cy="4572000"/>
    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/graphic">
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <p:pic xmlns:p="http://schemas.openxmlformats.org/packaging/2006/picture">
          <p:nvPicPr><p:cNvPr id="1" name="image1.png"/><p:cNvPicPr/></p:nvPicPr>
          <p:blipFill><a:blip r:embed="${rId}/a:blipFill></p:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing></w:r></w:p>`;
  }

  // Build complete document
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/graphic"
            xmlns:p="http://schemas.openxmlformats.org/packaging/2006/picture">
  <w:body>
${coverPage ? `    <!-- Portada -->
    <w:p><w:r><w:t textWrap="soft"></w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="44"/></w:rPr><w:t>BIBLE STUDY</w:t></w:r></w:p>
    <w:p><w:r><w:t textWrap="soft"></w:t></w:r></w:p>
` : ''}
    ${title ? `    <!-- Título -->
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${title}</w:t></w:r></w:p>
    <w:p><w:r><w:t textWrap="soft"></w:t></w:r></w:p>
` : ''}
    ${citation ? `    <w:p><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>${citation}</w:t></w:r></w:p>
` : ''}
    ${passage ? `    <!-- Texto del pasaje -->
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Texto del pasaje</w:t></w:r></w:p>
    <w:p><w:r><w:t>${passage}</w:t></w:r></w:p>
` : ''}
${imageXml}
    <!-- Secciones -->
${sectionsXml}
    <!-- Pie de página -->
    <w:p><w:r><w:t>Bible Study</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800"/></w:sectPr>
  </w:body>
</w:document>`;

  // Build ZIP files
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
${imagePart}
</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>` },
    { name: 'word/document.xml', data: docXml },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${imageRel}
</Relationships>` }
  ];

  // Add image if we have it
  if (imageBytes) {
    files.push({ name: 'word/media/image1.png', data: imageBytes });
  }

  return createZip(files);
}

export { slug };