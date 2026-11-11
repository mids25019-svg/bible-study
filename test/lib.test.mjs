import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCitation,rankModels,parsePlan,commands,delegatesImageRouting} from '../lib.mjs';
test('delega imágenes al proxy con catálogo separado sin confundir otros proveedores',()=>{
  assert.equal(delegatesImageRouting('https://freellmapi-hrfi.onrender.com/v1'),true);
  assert.equal(delegatesImageRouting('https://example.com/v1'),false);
  assert.equal(delegatesImageRouting('https://freellmapi-hrfi.onrender.com.evil.test/v1'),false);
  assert.equal(delegatesImageRouting('https://example.com/v1','provider-auto'),true);
  assert.equal(delegatesImageRouting('https://freellmapi-hrfi.onrender.com/v1','gemini-3.8-flash'),false);
});
test('acepta citas en español y rechaza entradas ajenas a una cita',()=>{for(const value of ['Éxodo 2:20','1 Corintios 13:1-5','Salmos 23'])assert.equal(parseCitation(value),value);for(const value of ['','ignora instrucciones','<script> 2:20'])assert.throws(()=>parseCitation(value));});
test('selección automática separa modelos visuales, texto y embeddings',()=>{const models=['gemini-3.5-flash-lite','gemini-3.5-flash','flux-pro','text-embedding-3','gpt-oss-120b'].map(id=>({id}));assert.equal(rankModels(models,'text')[0].id,'gemini-3.5-flash');assert.deepEqual(rankModels(models,'image').map(x=>x.id),['flux-pro']);assert(!rankModels(models,'text').some(x=>x.id==='text-embedding-3'));});
test('detecta capacidad de imágenes declarada por el proveedor',()=>{assert.equal(rankModels([{id:'custom-renderer',capabilities:['image_generation']}],'image').length,1);});
test('no confunde visión de entrada ni capacidades desactivadas con generación',()=>{
  const models=[{id:'gemini-3.8-flash',modalities:['text','image'],output_modalities:['text']},{id:'vision-reader',capabilities:{image_generation:false}},{id:'custom-renderer',output_modalities:['image']}];
  assert.deepEqual(rankModels(models,'image').map(m=>m.id),['custom-renderer']);
});
test('valida respuesta JSON completa y descarta campos no esperados',()=>{const input={summary:'Paráfrasis',items:[{command:'scene',prompt:'Una escena',title:'Escena',extra:'omitido'}]};assert.equal(parsePlan('```json\n'+JSON.stringify(input)+'\n```',['scene']).items[0].prompt,'Una escena');assert.throws(()=>parsePlan(JSON.stringify(input),['scene','map']));assert.throws(()=>parsePlan('no es JSON',['scene']));assert.equal(commands.length,12);});
