import {commands} from './public/commands.js';
export {commands};


export function parseCitation(input) {
  const cleaned = String(input || '').trim().normalize('NFC');
  if (!/^(?:[1-3]\s*)?[\p{L}][\p{L}\s.]+\s+\d{1,3}(?::\d{1,3}(?:\s*[-–]\s*\d{1,3})?)?$/u.test(cleaned)) throw new Error('Escribe una cita como Éxodo 2:20, Juan 3:16 o Salmos 23.');
  return cleaned;
}
export function isImageModel(model) {
  // Input/vision support does not imply that the model can produce images.
  const output=model.output_modalities||model.architecture?.output_modalities||[];
  const capabilities=model.capabilities;
  const declared=Array.isArray(capabilities)?capabilities.some(c=>/^(image_generation|text_to_image|image-generation)$/.test(c)):
    capabilities&&typeof capabilities==='object'&&(capabilities.image_generation===true||capabilities.text_to_image===true);
  return !!declared||output.includes('image')||/image|imagen|flux|dall-e|stable.diffusion|recraft|ideogram|sdxl/i.test(model.id);
}
export function delegatesImageRouting(baseUrl, selection='auto') {
  if(selection==='provider-auto')return true;
  if(selection!=='auto')return false;
  // FreeLLMAPI publishes its media catalog separately from its chat /v1/models list.
  try{return new URL(baseUrl).hostname==='freellmapi-hrfi.onrender.com';}catch{return false;}
}
export function rankModels(models, type) {
  return models.filter(m=>type==='image'?isImageModel(m):!isImageModel(m)&&!/embed|rerank|whisper|tts|safeguard|moderation|robotics|translate/i.test(m.id))
    .sort((a,b)=>score(b.id,type)-score(a.id,type)||a.id.localeCompare(b.id));
}
function score(id,type) {
  const s=id.toLowerCase();
  if(type==='image') return /gpt-image/.test(s)?100:/imagen.*4|flux.*pro/.test(s)?90:/imagen|flux/.test(s)?80:50;
  let n=/gemini.*pro|gpt-5|claude.*opus|claude.*sonnet/.test(s)?100:/gemini.*flash/.test(s)?80:/qwen|gpt-oss.*120|command.*reason/.test(s)?70:50;
  if(/(?:^|[-_\s])(lite|mini|nano)(?:$|[-_\s])/.test(s)) n-=20;
  const version=s.match(/gemini[-\s]?(\d+(?:\.\d+)?)/); if(version)n+=Number(version[1]);
  return n;
}
export function parsePlan(raw,selected,{requireExplanations=false}={}) {
  if(typeof raw!=='string')throw new Error('La IA no devolvió un estudio de texto válido.');
  let cleaned=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');
  if(start>=0&&end>=start)cleaned=cleaned.slice(start,end+1);
  // Remove trailing commas only outside JSON strings. Preserve prompt punctuation verbatim.
  let normalized='',inString=false,escaped=false;
  for(let i=0;i<cleaned.length;i++){
    const char=cleaned[i];
    if(!inString&&char===','&&/^\s*[}\]]/.test(cleaned.slice(i+1)))continue;
    normalized+=char;
    if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;}
    else if(char==='"')inString=true;
  }
  let plan;
  try{plan=JSON.parse(normalized);}catch{throw new Error('La IA devolvió un estudio con formato inválido. No se pudo interpretar la respuesta.');}
  if(!plan||!Array.isArray(plan.items)) throw new Error('El modelo no devolvió una lista de imágenes válida.');
  plan.items=selected.map(id=>{
    const item=plan.items.find(x=>x&&x.command===id);
    if(!item||typeof item.prompt!=='string'||!item.prompt.trim()||item.prompt.length>10000) throw new Error('La respuesta del modelo está incompleta. Vuelve a intentarlo.');
    const sections=Array.isArray(item.sections)?item.sections.map(section=>({heading:typeof section?.heading==='string'?section.heading.trim():'',body:typeof section?.body==='string'?section.body.trim():''})):[];
    const explanation=typeof item.explanation==='string'?item.explanation.trim():'';
    const takeaway=typeof item.takeaway==='string'?item.takeaway.trim():'';
    if(requireExplanations&&(!explanation||explanation.length>1800||sections.length<3||sections.length>5||sections.some(s=>!s.heading||s.heading.length>120||!s.body||s.body.length>1000)||!takeaway||takeaway.length>700))throw new Error('El estudio debe incluir la explicación, entre tres y cinco secciones y una reflexión final.');
    const result={command:id,title:String(item.title||commands.find(c=>c.id===id).label),explanation,prompt:item.prompt};
    if(sections.length)result.sections=sections;
    if(takeaway)result.takeaway=takeaway;
    return result;
  });
  return {summary:String(plan.summary||''),items:plan.items};
}
