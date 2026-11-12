import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeZip,crc32} from '../public/zip.js';
import {parseDepth,completeDepth} from '../depth.mjs';
import {scriptureRef,sourcePassage} from '../bible-source.mjs';
import {depthHtml,connectionPath} from '../public/depth-report.js';
import {generateWordDocument} from '../public/docx-generator.js';
// import {createAccess} from '../access.mjs';

const node=(id,reference,parentId)=>({id,reference,parentId,title:'Creación y Palabra',summary:'Una lectura del pasaje en su contexto.',explanation:'La relación es temática y debe contrastarse con el contexto de ambos textos.',application:'Lee el pasaje completo.',kind:'thematic',connection:'Ambos textos tratan la creación y el papel de la Palabra.'});
const depth={title:'El principio y la Palabra',overview:'Estudio de la creación.',context:'El relato presenta a Dios como creador.',keyIdeas:[{title:'El principio',explanation:'Presenta el origen de la creación.'},{title:'La Palabra',explanation:'Es un tema de comparación entre pasajes.'}],application:'Lee ambos contextos.',questions:['¿Qué afirma el texto?','¿Qué conexión es interpretativa?'],nodes:[node('root','Génesis 1:1',null),node('john','Juan 1:1-3','root'),node('col','Colosenses 1:16-17','john')]};
test('ZIP contiene todos los archivos originales sin alterar los bytes',async()=>{
  const payload=new TextEncoder().encode('imagen uno');const zip=new Uint8Array(await(await makeZip([{name:'estudio/escena.png',data:payload},{name:'estudio/personas.png',data:new Blob(['imagen dos'])}])).arrayBuffer());
  const view=new DataView(zip.buffer);assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(14,true),crc32(payload));const nameLength=view.getUint16(26,true);assert.deepEqual(zip.slice(30+nameLength,30+nameLength+payload.length),payload);
  const end=zip.length-22;assert.equal(view.getUint32(end,true),0x06054b50);assert.equal(view.getUint16(end+10,true),2);assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  await assert.rejects(makeZip([]));await assert.rejects(makeZip([{name:'../escape',data:payload}]));
});
test('Word profundo conserva pasaje, perspectivas y conexiones sin caracteres XML inválidos',async()=>{
  const blob=await generateWordDocument({title:'Éxodo 2:20',citation:'Éxodo 2:20',passage:'Texto consultado',overview:'Síntesis',items:[{title:'Escena',explanation:'Invitación',sections:[{heading:'Contexto',body:'Madián'}],takeaway:'Hospitalidad'}],nodes:[{reference:'Éxodo 2:20',title:'Inicio',path:'Éxodo 2:20',source:{text:'Pasaje fuente'},summary:'Resumen',explanation:'Lectura'},{reference:'Hebreos 13:2',title:'Hospitalidad',parentId:'root',kind:'thematic',connection:'A & B < C',explanation:'Conexión\u0001 interpretativa'}]}, {useDeepMode:true,coverPage:true,includeImages:false});
  assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const bytes=new Uint8Array(await blob.arrayBuffer()),decoder=new TextDecoder();let xml='';
  for(let offset=0;offset<bytes.length;){
    const view=new DataView(bytes.buffer,offset);
    if(view.getUint32(0,true)!==0x04034b50)break;
    const length=view.getUint32(18,true),nameLength=view.getUint16(26,true),extraLength=view.getUint16(28,true);
    const name=decoder.decode(bytes.slice(offset+30,offset+30+nameLength));
    if(name==='word/document.xml')xml=decoder.decode(bytes.slice(offset+30+nameLength+extraLength,offset+30+nameLength+extraLength+length));
    offset+=30+nameLength+extraLength+length;
  }
  for(const phrase of ['Texto consultado','Invitación','Madián','Pasaje fuente','Hebreos 13:2','Ruta de lectura','Conexión temática propuesta'])assert(xml.includes(phrase));
  assert(xml.includes('A &amp; B &lt; C'));assert(!xml.includes('\u0001'));
});
test('conexiones profundas forman cadenas acotadas, sin ciclos ni referencias repetidas',()=>{
  const parsed=parseDepth(JSON.stringify(depth),'Génesis 1:1',3);assert.equal(connectionPath(parsed,parsed.nodes[2]),'Génesis 1:1 → Juan 1:1-3 → Colosenses 1:16-17');
  const cycle=structuredClone(depth);cycle.nodes[1].parentId='col';assert.throws(()=>parseDepth(JSON.stringify(cycle),'Génesis 1:1',3));
  const invalid=structuredClone(depth);invalid.nodes[2].reference='Génesis 1:1';assert.throws(()=>parseDepth(JSON.stringify(invalid),'Génesis 1:1',3));
  const wrong=structuredClone(depth);wrong.nodes[0].reference='Proverbios 3:1';assert.throws(()=>parseDepth(JSON.stringify(wrong),'Génesis 1:1',3));
});
test('referencias normalizan acentos y rechazan rangos ilimitados',()=>{
  assert.equal(scriptureRef('Éxodo 2:20').book,'EXO');assert.equal(scriptureRef('Genesis 1:1').key,scriptureRef('Génesis 1:1').key);assert.throws(()=>scriptureRef('Génesis 0:1'));assert.throws(()=>scriptureRef('Juan 1:1-99'));
});
test('texto consultado se distingue de una referencia no encontrada o fuente caída',async()=>{
  const actual=await sourcePassage('Proverbios 3:1',undefined,async()=>new Response(JSON.stringify({verses:[{verse:1,text:'Texto de prueba'}]})));assert.equal(actual.status,'verified');assert.match(actual.text,/Texto de prueba/);
  const missing=await sourcePassage('Levítico 99:99',undefined,async()=>new Response('{}',{status:404}));assert.equal(missing.status,'not_found');
  const unavailable=await sourcePassage('Números 99:99',undefined,async()=>{throw new Error('offline');});assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.text,'');
});
test('profundización usa la fuente externa sin convertir interpretaciones en texto bíblico',async()=>{
  const calls=[];const result=await completeDepth({model:'test',citation:'Génesis 1:1',levels:3,request:async()=>({choices:[{message:{content:JSON.stringify(depth)}}]}),source:async ref=>{calls.push(ref);return {status:'verified',text:'Texto de prueba '+ref};}});
  assert.equal(calls.length,3);assert.equal(result.nodes[1].kind,'thematic');const html=depthHtml(result);assert(html.includes('Conexión temática propuesta'));assert(html.includes('Texto de prueba'));assert(!html.includes('<script>'));
});
// test('contraseña protege la API con sesión firmada, expira y limita intentos',()=>{
//   let time=1000000;const access=createAccess({password:'a-strong-test-password',secret:'session-secret-test',secure:true,now:()=>time});
//   assert(!access.authenticated({headers:{}}));const cookie=access.login('a-strong-test-password','local');assert(cookie.includes('HttpOnly'));assert(cookie.includes('Secure'));const request={headers:{cookie:cookie.split(';')[0]}};assert(access.authenticated(request));
//   assert(!access.authenticated({headers:{cookie:request.headers.cookie+'x'}}));time+=8*24*3600000;assert(!access.authenticated(request));
//   for(let i=0;i<8;i++)assert.throws(()=>access.login('wrong','attempts'));assert.throws(()=>access.login('a-strong-test-password','attempts'),/Demasiados/);
// });
