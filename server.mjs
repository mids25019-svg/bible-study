import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {commands,parseCitation,rankModels,isImageModel,delegatesImageRouting} from './lib.mjs';
import {completePlan,planMessages} from './planner.mjs';
import {inlineImage} from './images.mjs';
import {publicAssets} from './public-assets.mjs';
import {completeDepth} from './depth.mjs';

const config={baseUrl:process.env.AI_BASE_URL||'https://freellmapi-hrfi.onrender.com/v1',key:process.env.AI_API_KEY||'',textModel:'auto',imageModel:'auto',imageBaseUrl:process.env.IMAGE_BASE_URL||'',imageKey:process.env.IMAGE_API_KEY||''};
let catalog=[];
let imageCatalog=[];
const publicDir=new URL('./public/',import.meta.url);
const port=Number(process.env.PORT||3000);
const hosted=process.env.RENDER==='true'||process.env.HOST==='0.0.0.0';
const publicOrigin=process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||'';
if(hosted&&!publicOrigin)throw new Error('Configura PUBLIC_ORIGIN o RENDER_EXTERNAL_URL.');
const allowedOrigins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`,...(publicOrigin?[new URL(publicOrigin).origin]:[])]);
const allowedHosts=new Set([...allowedOrigins].map(value=>new URL(value).host));
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(value.length>100000)throw new Error('Solicitud demasiado grande.');}return JSON.parse(value||'{}');}
async function upstream(path,payload,signal,type='text'){
  const separate=type==='image'&&config.imageBaseUrl&&config.imageBaseUrl!==config.baseUrl;
  const baseUrl=separate?config.imageBaseUrl:config.baseUrl;
  const key=separate?config.imageKey:config.key;
  if(!key)throw new Error(separate?'Añade la API key del proveedor de imágenes en Conexión de IA.':'Añade tu API key en Conexión para continuar.');
  let response;
  try{response=await fetch(baseUrl+path,{method:payload?'POST':'GET',headers:{Authorization:`Bearer ${key}`,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000)});}catch(e){throw new Error(e.name==='TimeoutError'?'El servidor tardó demasiado. Vuelve a intentarlo.':'No se pudo conectar con el servidor de IA.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(`El proveedor devolvió HTTP ${response.status}. ${response.status===401?'Revisa tu API key.':response.status===429?'Cuota o límite temporal alcanzado.':type==='image'&&[400,404,422].includes(response.status)?'El proveedor rechazó la generación de imágenes con este modelo o formato. Conecta un proveedor que admita /images/generations. Tus prompts se conservan.':'Revisa los modelos y la compatibilidad del endpoint.'}`);e.status=response.status;throw e;}
  return data;
}
async function models(signal,type='text'){const data=await upstream('/models',undefined,signal,type);const list=(data.data||data.models||[]).map(m=>typeof m==='string'?{id:m}:m).filter(m=>m&&typeof m.id==='string');if(!list.length)throw new Error('El servidor no devolvió modelos en /models.');if(type==='image')imageCatalog=list;else catalog=list;return list;}
async function withModel(type,fn,signal){
  const separate=type==='image'&&config.imageBaseUrl&&config.imageBaseUrl!==config.baseUrl;
  if(type==='image'&&delegatesImageRouting(separate?config.imageBaseUrl:config.baseUrl,config.imageModel))return {data:await fn('auto'),model:'auto (servidor)'};
  let list=separate?imageCatalog:catalog;
  if(!list.length)list=await models(signal,separate?'image':'text');
  const chosen=type==='text'?config.textModel:config.imageModel;
  const chosenModel=list.find(m=>m.id===chosen);
  if(type==='image'&&chosen!=='auto'&&(!chosenModel||!isImageModel(chosenModel)))throw new Error(`El modelo «${chosen}» no está anunciado para generar imágenes. Elige un modelo de imágenes compatible o conecta otro proveedor en Conexión de IA. Tus prompts se conservan.`);
  const candidates=chosen==='auto'?rankModels(list,type).slice(0,4):[{id:chosen}];
  if(!candidates.length)throw new Error(type==='image'?'Este proveedor no anuncia modelos de generación de imágenes. Añade un proveedor de imágenes en Conexión de IA. Tus prompts se conservan.':'No se encontró un modelo de texto compatible.');
  let last;for(const model of candidates){try{return {data:await fn(model.id),model:model.id};}catch(e){last=e;if(signal?.aborted||![...(type==='image'?[400,422]:[]),404,429,500,502,503,504].includes(e.status))throw e;}}throw last;
}
const server=http.createServer(async(req,res)=>{
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const url=new URL(req.url,'http://localhost');
  try{
    if(!allowedHosts.has(req.headers.host||''))return send(res,403,{error:'Host no permitido.'});
    if(req.method==='POST'&&req.headers.origin&&!allowedOrigins.has(req.headers.origin))return send(res,403,{error:'Origen no permitido.'});
    if(url.pathname==='/health'&&req.method==='GET')return send(res,200,{status:'ok',app:'Bible study'});
    if(url.pathname==='/api/config'&&req.method==='GET')return send(res,200,{baseUrl:config.baseUrl,hasKey:!!config.key,textModel:config.textModel,imageModel:config.imageModel,imageBaseUrl:config.imageBaseUrl,imageHasKey:!!config.imageKey,commands});
    if(url.pathname==='/api/config'&&req.method==='POST'){
      const input=await body(req);const base=new URL(input.baseUrl);if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw new Error('URL base inválida.');
      let imageBase='';if(input.imageBaseUrl){const url=new URL(input.imageBaseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('URL de imágenes inválida.');imageBase=url.href.replace(/\/$/,'');}
      if(imageBase!==config.imageBaseUrl)config.imageKey='';config.imageBaseUrl=imageBase;
      if(input.imageKey)config.imageKey=String(input.imageKey).trim();if(input.clearImageKey)config.imageKey='';
      const nextBase=base.href.replace(/\/$/,'');if(nextBase!==config.baseUrl)config.key='';config.baseUrl=nextBase;if(input.key)config.key=String(input.key).trim();if(input.clearKey)config.key='';
      config.textModel=String(input.textModel||'auto');config.imageModel=String(input.imageModel||'auto');catalog=[];imageCatalog=[];
      return send(res,200,{ok:true,hasKey:!!config.key,imageHasKey:!!config.imageKey});
    }
    if(url.pathname==='/api/models'&&req.method==='GET'){const list=await models(controller.signal);return send(res,200,{models:list.map(m=>({id:m.id})),textCandidates:rankModels(list,'text').map(m=>m.id),imageCandidates:rankModels(list,'image').map(m=>m.id)});}
    if(url.pathname==='/api/image-models'&&req.method==='GET'){const list=await models(controller.signal,'image');return send(res,200,{imageCandidates:rankModels(list,'image').map(m=>m.id)});}
    if(url.pathname==='/api/plan'&&req.method==='POST'){
      const input=await body(req),citation=parseCitation(input.citation);
      const selected=[...new Set(input.commands||commands.map(c=>c.id))];if(!selected.length||selected.some(id=>!commands.some(c=>c.id===id)))throw new Error('Selecciona al menos un comando válido.');
      const result=await withModel('text',model=>completePlan({model,selected,signal:controller.signal,request:payload=>upstream('/chat/completions',payload,controller.signal),messages:planMessages(citation,selected,input.style)}),controller.signal);
      return send(res,200,{...result.data,citation,model:result.model});
    }
    if(url.pathname==='/api/depth'&&req.method==='POST'){
      const input=await body(req),citation=parseCitation(input.citation),levels=Number(input.levels||3);
      if(![2,3].includes(levels))throw new Error('Selecciona dos o tres niveles de conexiones.');
      const result=await withModel('text',model=>completeDepth({model,citation,levels,request:payload=>upstream('/chat/completions',payload,controller.signal),signal:controller.signal}),controller.signal);
      return send(res,200,{...result.data,model:result.model});
    }
    if(url.pathname==='/api/image'&&req.method==='POST'){
      const input=await body(req);if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>10000)throw new Error('Prompt inválido.');
      const result=await withModel('image',model=>upstream('/images/generations',{model,prompt:input.prompt,n:1,size:'1024x1024'},controller.signal,'image'),controller.signal);
      const item=result.data.data?.[0];let src=item?.b64_json?`data:image/png;base64,${item.b64_json}`:item?.url;
      if(typeof src!=='string'||!(/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(src)))throw new Error('El endpoint no devolvió una imagen compatible.');
      src=await inlineImage(src,controller.signal);
      return send(res,200,{src,model:typeof result.data.model==='string'?result.data.model:result.model});
    }
    if(req.method==='GET'&&Object.hasOwn(publicAssets,url.pathname)){
      const asset=publicAssets[url.pathname];const content=await readFile(new URL(asset.file,publicDir));res.writeHead(200,{'Content-Type':asset.type,'Cache-Control':'no-cache',...(url.pathname==='/sw.js'?{'Service-Worker-Allowed':'/'}:{}),'Content-Security-Policy':"default-src 'self'; img-src 'self' data: https: http:; style-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'"});return res.end(content);
    }
    send(res,404,{error:'No encontrado.'});
  }catch(e){if(!res.destroyed)send(res,400,{error:e.message.replaceAll(config.key||'__no_key__','[oculta]').replaceAll(config.imageKey||'__no_image_key__','[oculta]')});}
});
server.listen(port,hosted?'0.0.0.0':'127.0.0.1',()=>console.log(`Bible study: ${publicOrigin||`http://localhost:${port}`}`));
process.on('SIGTERM',()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),25000).unref();});
