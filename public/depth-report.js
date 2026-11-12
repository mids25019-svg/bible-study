import {buildInfographic,svgToPng} from './infographic.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function connectionPath(depth,node){
  const parts=[];
  let cursor=node;
  for(let i=0;cursor&&i<10;i++){
    parts.unshift(cursor.reference);
    cursor=depth.nodes.find(n=>n.id===cursor.parentId);
  }
  return parts.join(' → ');
}

export function depthPageItems(depth){
  return depth.nodes.map(node=>({
    command:'depth',
    title:node.title||'Conexiones bíblicas del pasaje',
    explanation:node.summary,
    sections:[
      {
        heading:'Texto del pasaje',
        body:node.source?.text?node.source.text+' — Reina Valera 1909':node.source?.status==='not_found'?'No se encontró esta referencia en la fuente consultada. No la trates como verificada.':'Texto no consultado en la fuente. Revisa esta referencia en tu Biblia.'
      },
      {
        heading:node.parentId?'Por qué se relacionan':'Contexto del pasaje',
        body:node.parentId?node.connection:depth.context
      },
      {
        heading:'Explicación y alcance',
        body:node.explanation
      },
      {
        heading:'Ruta de lectura',
        body:connectionPath(depth,node)
      },
      {
        heading:'Tipo de conexión',
        body:node.parentId?(node.kind==='explicit'?'Referencia explícita propuesta. Comprueba la relación en ambos contextos.':'Conexión temática propuesta; es una interpretación, no una cita explícita.')
          :'Punto de partida del estudio.'
      }
    ],
    takeaway:node.application||depth.application
  }));
}

export async function depthPngFiles(depth,prefix){
  const items=depthPageItems(depth),files=[];
  for(let i=0;i<items.length;i++)files.push({
    name:`${prefix}/conexiones/${String(i+1).padStart(2,'0')}.png`,
    data:await svgToPng(buildInfographic({
      item:items[i],
      citation:depth.nodes[i].reference,
      label:'Estudio profundo',
      textOnly:true
    }))
  });
  return files;
}

export function depthHtml(depth){
  const escapeXml = str => String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  const esc = escapeXml;

  return `<!doctype html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(depth.title)}</title>
<style>
  body{font:18px/1.7 Georgia,serif;max-width:900px;margin:40px auto;padding:0 24px;color:#382d29;background:#fbf6e9}
  h1,h2,h3{color:#743d45}
  article{border-top:1px solid #ccb89a;margin-top:35px;padding-top:20px}
  blockquote{white-space:pre-wrap;padding:20px;background:#eee4d4;border-radius:8px;font-size:13px}
  small{color:#806f5d;font-size:13px}
  footer{margin-top:40px;padding-top:20px;border-top:1px solid #d8cbb7;font-size:14px;font-style:italic}
  @media print{body{background:white}article{break-inside:avoid}}
</style>
<h1>${esc(depth.title)}</h1>
<p>${esc(depth.overview)}</p>
<h2>Contexto</h2>
<p>${esc(depth.context)}</p>
<h2>Ideas principales</h2>
${depth.keyIdeas.map(x=>`<h3>${esc(x.title)}</h3><p>${esc(x.explanation)}</p>`).join('')}
${depth.nodes.map(n=>`
<article>
  <small>${esc(connectionPath(depth,n))}</small>
  <h2>${esc(n.reference)} · ${esc(n.title)}</h2>
  <p>${esc(n.summary)}</p>
  ${n.source?.text?
    `<blockquote>${esc(n.source.text)}</blockquote><small>Reina Valera 1909 · texto consultado en bible-api.com.</small>`:
    `<p>Texto no verificado en la fuente: revisa esta referencia en tu Biblia.</p>`
  }
  <h3>Explicación</h3>
  <p>${esc(n.explanation)}</p>
  ${n.parentId?
    `<h3>Conexión ${n.kind==='explicit'?'explícita propuesta':'temática propuesta'}</h3><p>${esc(n.connection)}</p>`:
    ''
  }
  <p>${esc(n.application)}</p>
</article>`).join('')}
<h2>Aplicación</h2>
<p>${esc(depth.application)}</p>
<h2>Preguntas para estudiar</h2>
<ol>
  ${depth.questions.map(q=>`<li>${esc(q)}</li>`).join('')}
</ol>
<footer>Bible Study</footer>
</html>`;
}