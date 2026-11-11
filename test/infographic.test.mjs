import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildInfographic,hasExplanations,wrapText} from '../public/infographic.js';
import {parsePlan} from '../lib.mjs';
import {inlineImage} from '../images.mjs';

const item={command:'scene',title:'La hospitalidad en Madián',explanation:'Reuel pregunta por el hombre que ayudó a sus hijas y pide que lo inviten a comer (paráfrasis).',prompt:'Escena en Madián sin texto.',sections:[{heading:'Qué sucede',body:'Al enterarse de la ayuda recibida, Reuel pregunta por qué dejaron allí al hombre.'},{heading:'Una invitación',body:'Pide llamarlo para que comparta el pan con la familia.'},{heading:'Para comprender',body:'La escena presenta una respuesta de hospitalidad hacia quien ha prestado ayuda.'}],takeaway:'Reconoce la ayuda que recibes y busca una forma concreta de agradecerla.'};
test('exige explicación, secciones y reflexión antes de aceptar el plan nuevo',()=>{
  assert(hasExplanations(item));assert(!hasExplanations({...item,sections:[]}));
  const raw=JSON.stringify({summary:'Paráfrasis',items:[item]});assert.equal(parsePlan(raw,['scene'],{requireExplanations:true}).items[0].sections.length,3);
  for(const field of ['explanation','sections','takeaway']){const incomplete={...item};delete incomplete[field];assert.throws(()=>parsePlan(JSON.stringify({items:[incomplete]}),['scene'],{requireExplanations:true}));}
});
test('lámina contiene la referencia y todo el texto y crece con el contenido',()=>{
  const short=buildInfographic({item,citation:'Éxodo 2:20',label:'Escena'});
  assert(short.svg.includes('ÉXODO 2:20'));assert(short.svg.includes('PARA LLEVAR A TU VIDA'));assert(short.height>1000);assert(!short.svg.includes('<foreignObject'));
  for(const section of item.sections)assert(short.svg.includes(section.heading));
  const long=buildInfographic({item:{...item,sections:item.sections.map(s=>({...s,body:s.body.repeat(5)}))},citation:'Éxodo 2:20'});assert(long.height>short.height);
  assert(!short.svg.includes('<image'));
});
test('escapa contenido y nunca inserta URLs externas o instrucciones HTML como SVG',()=>{
  const out=buildInfographic({item:{...item,title:'<script>alert("x")</script>',sections:[...item.sections,{heading:'<img>',body:'A & B'}]},citation:'Éxodo 2:20',imageSrc:'https://external.example/image.png'});
  assert(!out.svg.includes('<script>'));assert(out.svg.includes('&lt;script&gt;'));assert(!out.svg.includes('https://external.example'));assert(out.svg.includes('A &amp; B'));
});
test('envuelve incluso palabras largas y conserva todo el texto',()=>{
  const word='a'.repeat(200);const lines=wrapText(word,100,20);assert(lines.length>1);assert.equal(lines.join(''),word);
});
test('descarga ilustraciones remotas como datos y valida su formato para exportar sin CORS',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
  let request;const src=await inlineImage('https://cdn.example/image',undefined,async(url,options)=>{request={url,options};return new Response(png);});
  assert(src.startsWith('data:image/png;base64,'));assert.equal(request.options.headers,undefined);
  await assert.rejects(inlineImage('https://cdn.example/image',undefined,async()=>new Response('<html>not an image</html>')),/archivo PNG/);
  await assert.rejects(inlineImage('https://cdn.example/image',undefined,async()=>new Response(png,{headers:{'content-length':'999999999'}})),/20 MB/);
});
