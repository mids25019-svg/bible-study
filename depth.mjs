import {scriptureRef,sourcePassage} from './bible-source.mjs';
export function parseDepth(raw,citation,levels){
  const clean=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');let data;try{data=JSON.parse(clean);}catch{throw new Error('El estudio profundo llegó con formato inválido.');}
  const required=(value,max=2500)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('El estudio profundo está incompleto.');return value.trim();};
  const result={title:required(data.title,200),overview:required(data.overview),context:required(data.context),application:required(data.application),keyIdeas:[],questions:[],nodes:[]};
  if(!Array.isArray(data.keyIdeas)||data.keyIdeas.length<2||data.keyIdeas.length>5||!Array.isArray(data.questions)||data.questions.length<2||data.questions.length>5||!Array.isArray(data.nodes)||data.nodes.length<3||data.nodes.length>7)throw new Error('Faltan ideas, preguntas o conexiones bíblicas.');
  result.keyIdeas=data.keyIdeas.map(i=>({title:required(i.title,150),explanation:required(i.explanation)}));result.questions=data.questions.map(q=>required(q,500));
  const ids=new Map(),refs=new Set();
  for(const node of data.nodes){
    const ref=scriptureRef(required(node.reference,100)),id=required(node.id,40);if(ids.has(id)||refs.has(ref.key))throw new Error('El estudio repite una referencia o identificador.');
    const normalized={id,reference:node.reference.trim(),parentId:node.parentId===null?null:required(node.parentId,40),title:required(node.title,180),summary:required(node.summary),explanation:required(node.explanation),application:required(node.application,700),kind:node.kind==='explicit'?'explicit':'thematic',connection:node.parentId===null?'Punto de partida.':required(node.connection)};
    refs.add(ref.key);ids.set(id,normalized);result.nodes.push(normalized);
  }
  const roots=result.nodes.filter(n=>n.parentId===null);if(roots.length!==1||scriptureRef(roots[0].reference).key!==scriptureRef(citation).key)throw new Error('El estudio debe comenzar en la cita solicitada.');
  let maxDepth=0;
  for(const node of result.nodes){let current=node,depth=0;const seen=new Set();while(current.parentId!==null){if(seen.has(current.id))throw new Error('La cadena de referencias forma un ciclo.');seen.add(current.id);current=ids.get(current.parentId);if(!current)throw new Error('Falta el pasaje anterior en una conexión.');if(++depth>levels)throw new Error('La cadena excede la profundidad seleccionada.');}maxDepth=Math.max(maxDepth,depth);}
  if(maxDepth<2)throw new Error('El estudio debe conectar al menos un pasaje relacionado con otro pasaje adicional.');
  result.nodes.sort((a,b)=>a.parentId===null?-1:b.parentId===null?1:0);result.levels=levels;result.generatedAt=new Date().toISOString();return result;
}
export async function completeDepth({model,citation,levels,request,signal,source=sourcePassage}){
  const messages=[{role:'system',content:`Eres un asistente de estudio bíblico en español. Construye un estudio profundo con cadenas justificadas de referencias; no fuerces conexiones por palabras o números parecidos. Distingue relaciones temáticas (interpretación) y referencias explícitas: usa kind=explicit solo si el texto realmente cita o remite al otro pasaje. No inventes citas textuales ni atribuyas autorías o fechas debatidas como certezas. Devuelve SOLO JSON válido con title, overview, context, keyIdeas:[{title,explanation}] (2 a 4), application, questions:[preguntas] (2 a 4) y nodes (3 a 7). Cada node tiene id, reference (nombre canónico español y máximo diez versículos), parentId (null solo para la raíz), title, summary, explanation, application, kind (thematic o explicit), connection (explica POR QUÉ conecta con el pasaje padre, respetando ambos contextos). La raíz debe ser exactamente la cita del usuario. Debe existir al menos una cadena raíz → otro pasaje → un tercer pasaje, sin ciclos ni referencias repetidas. Profundidad máxima: ${levels} conexiones desde la raíz. Máximo siete nodos en total. La profundidad es acotada: no afirmes ofrecer todas las interpretaciones o referencias de la Biblia. Cada campo de texto máximo 100 palabras; cada explicación de nodo máximo 120 palabras. No devuelvas versículos literales: una fuente independiente añadirá el texto. Las afirmaciones interpretativas son propuestas que el lector debe contrastar.`},{role:'user',content:JSON.stringify({citation})}];
  let structured=true;
  const call=async()=>{const body={model,messages,temperature:0.3,...(structured?{response_format:{type:'json_object'}}:{})};try{return await request(body);}catch(e){if(!structured||![400,422].includes(e.status))throw e;structured=false;delete body.response_format;return request(body);}};
  let parsed;
  for(let attempt=0;attempt<2;attempt++){
    const response=await call(),content=response.choices?.[0]?.message?.content;
    try{if(response.choices?.[0]?.finish_reason==='length')throw new Error('truncated');parsed=parseDepth(content,citation,levels);break;}catch(e){if(attempt===1){const error=new Error('No se pudo completar un estudio profundo coherente. Prueba de nuevo o elige otro modelo de texto.');error.status=502;throw error;}messages.push({role:'user',content:'La respuesta no fue válida: '+e.message+' Regenera todo el JSON completo, con cadenas justificadas y todos los campos requeridos.'});}
  }
  // Sequential source requests stay below the public source's published burst limit for one study.
  for(const node of parsed.nodes){if(signal?.aborted)throw new DOMException('Operación cancelada','AbortError');node.source=await source(node.reference,signal);}
  return parsed;
}
