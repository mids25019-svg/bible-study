import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePlan} from '../lib.mjs';
import {completePlan} from '../planner.mjs';

const plan={summary:'Paráfrasis',items:[{command:'scene',title:'Escena',explanation:'Contexto',prompt:'Un texto con coma, } y comillas "internas".',sections:[{heading:'Qué sucede',body:'Una invitación a compartir el pan.'},{heading:'El escenario',body:'Madián es el escenario del encuentro.'},{heading:'Su significado',body:'La hospitalidad reconoce el bien recibido.'}],takeaway:'Reconoce la ayuda que recibes y responde con gratitud.'}]};
const response=(content,finish_reason='stop')=>({choices:[{message:{content},finish_reason}]});
const base={model:'test',messages:[{role:'user',content:'Éxodo 2:20'}],selected:['scene']};

test('tolera comas finales y texto alrededor sin alterar el prompt',()=>{
  const malformed='Aquí está:\n```json\n'+JSON.stringify(plan).replace('}]','},]')+'\n```';
  assert.equal(parsePlan(malformed,['scene']).items[0].prompt,plan.items[0].prompt);
  const finalComma=JSON.stringify(plan).replace(/}$/,',}');
  assert.equal(parsePlan(finalComma,['scene']).summary,'Paráfrasis');
});
test('repara una respuesta con propiedades sin comillas mediante un segundo intento',async()=>{
  const seen=[];
  const actual=await completePlan({...base,request:async payload=>{seen.push(payload);return response(seen.length===1?'{summary: "Paráfrasis", items: []}':JSON.stringify(plan));}});
  assert.deepEqual(actual,plan);assert.equal(seen.length,2);assert.equal(seen[0].response_format.type,'json_object');assert.equal(seen[1].messages.at(-2).role,'assistant');
});
test('mantiene compatibilidad si el proxy rechaza response_format',async()=>{
  let calls=0;
  const actual=await completePlan({...base,request:async payload=>{calls++;if(payload.response_format){const e=new Error('unsupported');e.status=400;throw e;}return response(JSON.stringify(plan));}});
  assert.equal(calls,2);assert.deepEqual(actual,plan);
});
test('respuesta truncada o incompleta exige regeneración completa',async()=>{
  for(const bad of [response(JSON.stringify(plan),'length'),response('{"summary":"texto","items":[]}')]){
    let calls=0;await completePlan({...base,request:async()=>++calls===1?bad:response(JSON.stringify(plan))});assert.equal(calls,2);
  }
});
test('fallos repetidos tienen mensaje comprensible y permiten cambiar de modelo',async()=>{
  let calls=0;await assert.rejects(completePlan({...base,request:async()=>{calls++;return response('invalid JSON');}}),e=>e.status===502&&!e.message.includes('position')&&/menos comandos/.test(e.message));assert.equal(calls,2);
});
test('un error de autenticación no dispara intentos de reparación',async()=>{
  let calls=0;await assert.rejects(completePlan({...base,request:async()=>{calls++;const e=new Error('Auth');e.status=401;throw e;}}),e=>e.status===401);assert.equal(calls,1);
});
