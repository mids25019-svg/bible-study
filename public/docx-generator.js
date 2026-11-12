/**
 * Generador de documentos Word (.docx) para estudios bíblicos
 * Produce un archivo OpenXML (.docx) 100% estándar y compatible con Microsoft Word.
 */
import { makeZip } from './zip.js';

function escapeXml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }[c]));
}

export function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

function p(text, { bold = false, italic = false, size = 22, color = '29201D', align = null, spaceBefore = 0, spaceAfter = 120 } = {}) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  return lines.map(line => {
    let pPr = '<w:pPr>';
    if (align) pPr += `<w:jc w:val="${align}"/>`;
    if (spaceBefore || spaceAfter) pPr += `<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/>`;
    pPr += '</w:pPr>';

    let rPr = '<w:rPr>';
    if (bold) rPr += '<w:b/><w:bCs/>';
    if (italic) rPr += '<w:i/><w:iCs/>';
    if (size) rPr += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
    if (color) rPr += `<w:color w:val="${color}"/>`;
    rPr += '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:rPr>';

    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
  }).join('\n');
}

function heading(text, level = 1) {
  const sizes = { 1: 36, 2: 28, 3: 24 };
  const colors = { 1: '743D45', 2: '743D45', 3: '4A3528' };
  const size = sizes[level] || 24;
  const color = colors[level] || '743D45';
  return p(text, { bold: true, size, color, spaceBefore: 240, spaceAfter: 120 });
}

export async function generateWordDocument(study, options = {}) {
  const { includeImages = true, useDeepMode = false, coverPage = false } = options;

  const titleText = study.title || study.citation || 'Estudio Bíblico';
  const citationText = study.citation || '';
  const passageText = study.passage || '';
  const explanationText = study.explanation || study.summary || '';
  const contextText = study.context || '';
  const applicationText = study.application || study.takeaway || '';
  const keyIdeas = study.keyIdeas || [];
  const questions = study.questions || [];
  const nodes = study.nodes || [];

  // Decodificar imagen si está presente
  let imageBytes = null;
  let imageExt = 'png';
  if (includeImages && study.artSrc && typeof study.artSrc === 'string') {
    const match = study.artSrc.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (match) {
      try {
        imageExt = match[1] === 'jpg' ? 'jpeg' : match[1];
        const b64 = match[2];
        if (typeof atob === 'function') {
          const bin = atob(b64);
          imageBytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) imageBytes[i] = bin.charCodeAt(i);
        } else if (typeof Buffer !== 'undefined') {
          imageBytes = new Uint8Array(Buffer.from(b64, 'base64'));
        }
      } catch {
        imageBytes = null;
      }
    }
  }

  // Ensamblar párrafos
  const paragraphs = [];

  // Portada o encabezado principal
  if (coverPage) {
    paragraphs.push(p('BIBLE STUDY', { bold: true, size: 48, color: '743D45', align: 'center', spaceBefore: 400, spaceAfter: 100 }));
    paragraphs.push(p('LA PALABRA EN IMÁGENES', { size: 18, color: '8A7568', align: 'center', spaceAfter: 600 }));
    paragraphs.push(p(titleText, { bold: true, size: 36, color: '29201D', align: 'center', spaceAfter: 200 }));
    if (citationText && citationText !== titleText) {
      paragraphs.push(p(citationText, { italic: true, size: 24, color: '743D45', align: 'center', spaceAfter: 400 }));
    }
  } else {
    paragraphs.push(heading(titleText, 1));
    if (citationText && citationText !== titleText) {
      paragraphs.push(p(citationText, { italic: true, size: 24, color: '743D45', spaceAfter: 200 }));
    }
  }

  // Texto bíblico
  if (passageText) {
    paragraphs.push(heading('Texto Bíblico', 2));
    paragraphs.push(p(passageText, { italic: true, size: 22, color: '4A3528', spaceBefore: 60, spaceAfter: 200 }));
  }

  // Imagen DrawingML
  if (imageBytes) {
    paragraphs.push(`<w:p>
  <w:pPr><w:jc w:val="center"/><w:spacing w:before="200" w:after="240"/></w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="5029200" cy="5029200"/>
        <wp:docPr id="1" name="Ilustracion"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/graphic" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/graphic">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="imagen.${imageExt}"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="rIdImg1"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="5029200" cy="5029200"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`);
  }

  // Explicación / Resumen
  if (explanationText) {
    paragraphs.push(heading('Explicación y Perspectiva', 2));
    paragraphs.push(p(explanationText, { size: 22, spaceAfter: 180 }));
  }

  // Secciones detalladas de las láminas
  if (Array.isArray(study.sections) && study.sections.length > 0) {
    for (const section of study.sections) {
      if (section?.heading) paragraphs.push(heading(section.heading, 3));
      if (section?.body) paragraphs.push(p(section.body, { size: 22, spaceAfter: 160 }));
    }
  }

  // Contexto histórico si es estudio profundo
  if (useDeepMode && contextText) {
    paragraphs.push(heading('Contexto Histórico y Cultural', 2));
    paragraphs.push(p(contextText, { size: 22, spaceAfter: 180 }));
  }

  // Ideas principales
  if (useDeepMode && keyIdeas.length > 0) {
    paragraphs.push(heading('Ideas Clave del Pasaje', 2));
    for (const item of keyIdeas) {
      if (item.title) paragraphs.push(p(`• ${item.title}`, { bold: true, size: 22, color: '743D45', spaceBefore: 60, spaceAfter: 40 }));
      if (item.explanation) paragraphs.push(p(item.explanation, { size: 22, spaceAfter: 120 }));
    }
  }

  // Preguntas de reflexión
  if (useDeepMode && questions.length > 0) {
    paragraphs.push(heading('Preguntas para la Reflexión', 2));
    for (const q of questions) {
      paragraphs.push(p(`¿ ${q.replace(/^[¿?]+|[¿?]+$/g, '').trim()} ?`, { italic: true, size: 22, color: '4A3528', spaceBefore: 40, spaceAfter: 80 }));
    }
  }

  // Conexiones bíblicas
  if (useDeepMode && nodes.length > 0) {
    paragraphs.push(heading('Conexiones Bíblicas Profundas', 2));
    for (const node of nodes) {
      paragraphs.push(p(`${node.reference}: ${node.title}`, { bold: true, size: 22, color: '743D45', spaceBefore: 100, spaceAfter: 40 }));
      if (node.explanation) paragraphs.push(p(node.explanation, { size: 22, spaceAfter: 80 }));
      if (node.application) paragraphs.push(p(`Aplicación: ${node.application}`, { italic: true, size: 20, color: '5A4538', spaceAfter: 120 }));
    }
  }

  // Aplicación práctica y conclusión
  if (applicationText) {
    paragraphs.push(heading('Aplicación Espiritual', 2));
    paragraphs.push(p(applicationText, { size: 22, spaceAfter: 200 }));
  }

  // Armar document.xml
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/graphic"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
${paragraphs.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  // Relaciones del documento
  let docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  if (imageBytes) {
    docRelsXml += `\n  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.${imageExt}"/>`;
  }
  docRelsXml += `\n</Relationships>`;

  // Content_Types
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>`;
  if (imageBytes) {
    contentTypesXml += `\n  <Default Extension="${imageExt}" ContentType="image/${imageExt === 'jpg' ? 'jpeg' : imageExt}"/>`;
  }
  contentTypesXml += `\n  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  // Relaciones raíz
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const files = [
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/_rels/document.xml.rels', data: docRelsXml }
  ];

  if (imageBytes) {
    files.push({ name: `word/media/image1.${imageExt}`, data: imageBytes });
  }

  return await makeZip(files);
}
