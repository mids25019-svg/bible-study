import {buildInfographic,svgDataUrl,hasExplanations} from './infographic.js';
import {downloadBlob} from './zip.js';
import {connectionPath} from './depth-report.js';
import {storeArt,restoreArt,deleteArt,deleteStudyArt} from './image-store.js';
import {commands as offlineCommands} from './commands.js';
import {generateWordDocument,slug} from './docx-generator.js';

const $=s=>document.querySelector(s);
let config={baseUrl:'https://freellmapi-hrfi.onrender.com/v1',hasKey:false,textModel:'auto',imageModel:'auto',imageBaseUrl:'',imageHasKey:false},
  commands=offlineCommands,
  selected=new Set(offlineCommands.map(c=>c.id)),
  active=null,
  busy=false,
  aborter=null;

let history=[];
try{history=JSON.parse(localStorage.getItem('biblia-studies')||'[]');if(!Array.isArray(history))history=[];}catch{}

const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
function notice(text){$('#notice').textContent=text;}

async function api(path,body,signal){
  if(!navigator.onLine)throw new Error('Sin conexión. Puedes consultar tu biblioteca; generar contenido necesita Internet.');
  let response;
  try{
    response=await fetch('/api/'+path,{
      method:body?'POST':'GET',
      headers:body?{'Content-Type':'application/json'}:{},
      body:body?JSON.stringify(body):undefined,
      signal
    });
  }catch(e){
    if(e.name==='AbortError')throw e;
    throw new Error('No se pudo conectar con el servidor. Tu biblioteca local sigue disponible.');
  }
  const data=await response.json();
  if(!response.ok){
    const error=new Error(data.error||'No se pudo completar la solicitud.');
    error.status=response.status;
    error.retryable = response.status === 502 || response.status === 503 || response.status === 504;
    throw error;
  }
  return data;
}

function renderCommands(){
  const grid=$('#commandGrid');
  grid.replaceChildren();
  commands.forEach(c=>{
    const b=node('button',undefined,'command'+(selected.has(c.id)?' active':''));
    b.type='button';
    b.title=c.description;
    b.setAttribute('aria-pressed',selected.has(c.id));
    b.append(
      node('span',c.icon,'icon'),
      node('strong',c.label),
      node('small','/'+c.id),
      node('span',selected.has(c.id)?'✓':'','check')
    );
    b.onclick=()=>{
      selected.has(c.id)?selected.delete(c.id):selected.add(c.id);
      renderCommands();
    };
    grid.append(b);
  });
  $('#selectedCount').textContent=`✦ ${selected.size} comandos seleccionados`;
  $('#toggleAll').textContent=selected.size===commands.length?'Deseleccionar todas':'Seleccionar todas';
}

function save(){
  if(!active)return;
  const stored={
    ...active,
    items:active.items.map(({src,artSrc,...item})=>({
      ...item,
      src:src?.startsWith('http')?src:undefined
    }))
  };
  history=[stored,...history.filter(s=>s.id!==stored.id)];
  try{localStorage.setItem('biblia-studies',JSON.stringify(history));}
  catch{notice('El navegador no pudo guardar el estudio. Puedes exportarlo.');}
  renderHistory();
}

function renderHistory(){
  for(const nav of [$('#history'),$('#libraryList')].filter(Boolean)){
    nav.replaceChildren();
    if(!history.length){
      nav.append(node('small','Tus estudios aparecerán aquí.','history-empty'));
    }
    for(const item of history){
      const row=node('div',undefined,'history-row');
      const b=node('button',item.citation,'history-entry requires-idle');
      b.disabled=busy;
      b.append(node('small',`${item.items?.length||0} láminas · ${new Date(item.date).toLocaleDateString('es')}`));
      b.onclick=async()=>{
        if(busy)return;
        $('#libraryDialog').close();
        setBusy(true);
        try{
          active=await restoreArt(structuredClone(item));
          renderStudy();
          notice('Estudio recuperado. Puedes ver, descargar o eliminar sus láminas.');
        }finally{setBusy(false);}
      };
      const remove=node('button','×','delete-study requires-idle');
      remove.disabled=busy;
      remove.title='Eliminar estudio';
      remove.setAttribute('aria-label','Eliminar estudio '+item.citation);
      remove.onclick=()=>removeStudy(item);
      row.append(b,remove);
      nav.append(row);
    }
  }
  $('#export').disabled=busy||(!active&&!history.length);
}

async function confirmDeletion(title,description){
  const dialog=node('dialog',undefined,'delete-dialog');
  const heading=node('h2',title);
  const text=node('p',description);
  const actions=node('div',undefined,'dialog-actions');
  const cancel=node('button','Cancelar');
  const confirm=node('button','Eliminar','primary');
  actions.append(cancel,confirm);
  dialog.append(heading,text,actions);
  document.body.append(dialog);
  return new Promise(resolve=>{
    const finish=value=>{
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    cancel.onclick=()=>finish(false);
    confirm.onclick=()=>finish(true);
    dialog.oncancel=e=>{
      e.preventDefault();
      finish(false);
    };
    dialog.showModal();
    cancel.focus();
  });
}

function resetStudy(){
  active=null;
  $('#welcome').hidden=false;
  $('#conversation').hidden=true;
  const title=$('#currentTitle');if(title)title.textContent='Nuevo estudio';
  $('#export').disabled=busy||!history.length;
  $('#citation').value='';
  $('#messages').replaceChildren();
  $('#results').replaceChildren();
  $('#depthResults').replaceChildren();
  if(document.getElementById('currentRef')) {
    document.getElementById('currentRef').textContent='';
  }
}

async function removeStudy(study){
  if(busy)return;
  const libraryOpen=$('#libraryDialog').open;
  if(libraryOpen)$('#libraryDialog').close();
  const confirmed=await confirmDeletion('Eliminar estudio',`Se eliminarán «${study.citation}» y sus ${study.items.length} láminas de este navegador. Los archivos que descargaste no se borran.`);
  if(!confirmed){
    if(libraryOpen)$('#libraryDialog').showModal();
    return;
  }
  setBusy(true);
  try{
    await deleteStudyArt(study.id);
    const next=history.filter(s=>s.id!==study.id);
    localStorage.setItem('biblia-studies',JSON.stringify(next));
    history=next;
    if(active?.id===study.id)resetStudy();
    renderHistory();
    notice('Estudio eliminado de este navegador.');
  }catch(e){notice('No se pudo completar la eliminación: '+e.message);}
  finally{setBusy(false);if(libraryOpen)$('#libraryDialog').showModal();}
}

async function removeSheet(item){
  if(busy||!active)return;
  const study=active;
  if(!await confirmDeletion('Eliminar lámina',`Se eliminará «${item.title}» del estudio ${study.citation}, junto con su ilustración y explicaciones guardadas en este navegador.`))return;
  setBusy(true);
  try{
    await deleteArt(study.id,item.command);
    study.items=study.items.filter(i=>i!==item);
    if(study.items.length){
      save();
      renderStudy();
    }else{
      const next=history.filter(s=>s.id!==study.id);
      localStorage.setItem('biblia-studies',JSON.stringify(next));
      history=next;
      resetStudy();
      renderHistory();
    }
    notice('Lámina eliminada de este navegador.');
  }catch(e){notice('No se pudo completar la eliminación: '+e.message);}
  finally{setBusy(false);}
}

function renderStudy(){
  $('#welcome').hidden=true;
  $('#conversation').hidden=false;
  $('#export').disabled=busy;
  const title=$('#currentTitle');if(title)title.textContent=active.citation;

  // Actualizar referencia en header
  if(document.getElementById('currentRef')) {
    document.getElementById('currentRef').textContent=active.citation;
  }

  const wrap=$('#messages');
  wrap.replaceChildren(node('div',active.citation,'user-message'));
  const message=node('div',undefined,'assistant-message');
  const text=node('div');
  message.append(node('span','✦','avatar'),text);
  text.append(
    node('h2',`Una mirada a ${active.citation}`),
    node('p',active.summary||'Preparando tu estudio y los prompts de las imágenes…'),
    node('small',active.model?`Texto: ${active.model}`:'Selección automática de modelo','model-meta')
  );
  wrap.append(message);
  $('#results').replaceChildren();
  active.items.forEach((item,index)=>renderCard(item,index));
  renderDepth();
}

function renderDepth(){
  const section=$('#depthResults');
  section.replaceChildren();
  if(!active?.depth)return;

  const depth=active.depth;
  section.append(
    node('h2',depth.title),
    node('p',depth.overview),
    node('p',depth.context)
  );

  for(const item of depth.nodes){
    const box=node('details');
    const summary=node('summary',connectionPath(depth,item));
    box.append(summary,node('p',item.summary));
    if(item.source?.text){
      box.append(
        node('blockquote',item.source.text),
        node('small','Texto consultado · Reina Valera 1909')
      );
    }else{
      box.append(node('small','Texto no consultado en la fuente: revisa esta referencia en tu Biblia.'));
    }
    box.append(node('p',item.explanation));
    if(item.parentId)box.append(node('p',(item.kind==='explicit'?'Conexión explícita propuesta: ':'Conexión temática propuesta: ')+item.connection));
    box.append(node('p',item.application));
    section.append(box);
  }
  section.append(node('p','Las conexiones son propuestas interpretativas. Consultar el texto no verifica por sí solo su interpretación.'));
}

function renderCard(item,index){
  const c=commands.find(x=>x.id===item.command);
  const card=node('article',undefined,'result-card');
  card.id='card-'+index;

  if(!item.artSrc&&item.src?.startsWith('data:image/')&&!item.src.startsWith('data:image/svg'))item.artSrc=item.src;

  const slot=node('div',undefined,'image-slot infographic-slot');
  const preview=buildInfographic({item,citation:active.citation,label:c.label,imageSrc:item.artSrc});
  const img=node('img');
  img.src=svgDataUrl(preview.svg);
  img.alt=`${item.title}: lámina con explicación y secciones de estudio`;
  img.loading='lazy';
  slot.append(img);

  if(item.status)slot.append(node('div',item.status,'infographic-status'));

  const content=node('div',undefined,'card-content');
  content.append(
    node('span','/'+item.command,'command-label'),
    node('h3',item.title),
    node('p',item.explanation)
  );

  const details=node('details');
  const summary=node('summary','Ver prompt de imagen');
  details.append(summary,node('p',item.prompt));
  content.append(details);

  const actions=node('div',undefined,'card-actions');

  const copy=node('button','Copiar prompt');
  copy.onclick=async()=>{
    try{
      await navigator.clipboard.writeText(item.prompt);
      copy.textContent='Copiado ✓';
    }catch{notice('No se pudo copiar. Abre el prompt y selecciona el texto.');
    }
  };

  const retry=node('button',item.artSrc?'Regenerar ilustración':'Generar ilustración','requires-idle');
  retry.disabled=busy;
  retry.onclick=async()=>{
    if(busy)return;
    if(!config.hasKey){openSettings();return;}
    setBusy(true);
    aborter=new AbortController();
    try{
      await generateImage(item,index,aborter.signal);
      save();
    }catch(e){
      notice(e.name==='AbortError'?'Generación detenida.':e.message);
    }
    finally{setBusy(false);renderStudy();}
  };
  actions.append(copy,retry);

  if(!hasExplanations(item)){
    const enrich=node('button','Completar explicaciones','requires-idle');
    enrich.disabled=busy;
    enrich.onclick=async()=>{
      if(busy)return;
      if(!config.hasKey){openSettings();return;}
      setBusy(true);
      aborter=new AbortController();
      try{
        await ensureExplanations(item,aborter.signal);
        if(item.artSrc)await storeArt(active.id,item.command,item.artSrc);
        save();
        notice('Explicaciones añadidas a la lámina. Ya puedes descargarla con todo su contenido.');
      }catch(e){
        notice(e.name==='AbortError'?'Operación detenida.':e.message);
      }
      finally{setBusy(false);renderStudy();}
    };
    actions.append(enrich);
    content.append(node('p','Estudio anterior: completa las explicaciones para descargar la lámina educativa.'));
  }

  const remove=node('button','Eliminar lámina','requires-idle');
  remove.disabled=busy;
  remove.onclick=()=>removeSheet(item);
  actions.append(remove);

  content.append(actions);
  if(item.imageModel)content.append(node('small',item.imageModel,'model-meta'));
  card.append(slot,content);

  const old=$('#card-'+index);
  old?old.replaceWith(card):$('#results').append(card);
}

function setBusy(value){
  busy=value;
  document.body.classList.toggle('busy',value);
  $('#send').hidden=value;
  $('#stop').hidden=!value;
  $('#citation').disabled=value;
  $('#newChat').disabled=value;
  $('#settingsButton').disabled=value;
  $('#mobileNew').disabled=value;
  $('#mobileSettings').disabled=value;
  $('#export').disabled=(!active&&!history.length)||value;
  document.querySelectorAll('.requires-idle').forEach(b=>b.disabled=value);
}

async function ensureExplanations(item,signal){
  if(hasExplanations(item))return;
  notice('Completando las explicaciones del estudio…');
  const plan=await api('plan',{citation:active.citation,commands:[item.command],style:$('#style').value},signal);
  const rich=plan.items.find(i=>i.command===item.command);
  if(!hasExplanations(rich))throw new Error('El modelo no completó todas las explicaciones. Vuelve a intentarlo.');
  Object.assign(item,rich);
}

async function generateImage(item,index,signal){
  try{
    await ensureExplanations(item,signal);
    item.status='Generando ilustración para la lámina explicada…';
    renderCard(item,index);
    const image=await api('image',{prompt:item.prompt},signal);
    item.artSrc=image.src;
    delete item.src;
    item.imageModel=image.model;
    try{await storeArt(active.id,item.command,item.artSrc);}
    catch{notice('La lámina está lista, pero no se pudo guardar la ilustración en este navegador. Descárgala para conservarla.');}
    delete item.status;
    renderCard(item,index);
  }catch(e){
    item.status=e.name==='AbortError'?'Generación detenida. Puedes volver a intentarlo.':e.message;
    renderCard(item,index);
    throw e;
  }
}

async function start(citation){
  if(busy)return;
  if(!selected.size){
    notice('Selecciona al menos un comando.');
    return;
  }
  if(!config.hasKey){
    notice('Añade tu API key para generar el estudio.');
    openSettings();
    return;
  }
  setBusy(true);
  aborter=new AbortController();
  notice('Consultando el pasaje y preparando las perspectivas…');
  active={id:crypto.randomUUID(),date:new Date().toISOString(),citation,items:[]};
  renderStudy();
  try{
    const plan=await api('plan',{citation,commands:[...selected],style:$('#style').value},aborter.signal);
    Object.assign(active,plan);
    renderStudy();
    save();

    let imageFailed=false;
    for(let i=0;i<active.items.length;i++){
      notice(`Generando imagen ${i+1} de ${active.items.length} · ${commands.find(c=>c.id===active.items[i].command).label}`);
      try{
        await generateImage(active.items[i],i,aborter.signal);
      }catch(e){
        if(e.name==='AbortError')throw e;
        imageFailed=true;
        for(const pending of active.items)if(!pending.artSrc)pending.status='Ilustración pendiente. El estudio escrito sigue disponible.';
        break;
      }
      save();
    }

    const count=active.items.filter(x=>x.artSrc).length;
    if(imageFailed){
      notice('La generación de imágenes se detuvo. Preparando el estudio profundo y sus conexiones…');
      try{await depthFor(active,aborter.signal);}catch(e){if(e.name==='AbortError')throw e;notice('Estudio escrito guardado. Las conexiones profundas se prepararán al descargar: '+e.message);}
    }
    if(!imageFailed)notice(`${active.items.length} láminas explicadas y ${count} ilustraciones generadas. La descarga profunda incluye las conexiones entre versículos.`);
    save();
  }catch(e){
    notice(e.name==='AbortError'?'Generación detenida. Se conserva lo completado.':e.message);
    if(active.items.length)save();
  }
  finally{setBusy(false);renderStudy();}
}

// Menu lateral móvil y colapso de escritorio
function initMobileMenu(){
  const toggleBtn=$('#mobileMenu');
  const toggleIcon=$('#mobileMenuToggle');
  const sidebar=$('#sidebar');
  const overlay=$('#mobileOverlay');

  function openMobileSidebar(){
    sidebar.classList.add('open');
    if(overlay){
      overlay.classList.add('show');
      overlay.hidden=false;
    }
  }

  function closeMobileSidebar(){
    sidebar.classList.remove('open');
    if(overlay){
      overlay.classList.remove('show');
      overlay.hidden=true;
    }
  }

  function toggleMenu(){
    if(window.innerWidth<=700){
      if(sidebar.classList.contains('open')){
        closeMobileSidebar();
      }else{
        openMobileSidebar();
      }
    }else{
      document.body.classList.toggle('sidebar-closed');
    }
  }

  if(toggleBtn) toggleBtn.onclick=toggleMenu;
  if(toggleIcon) toggleIcon.onclick=()=>{
    if(window.innerWidth<=700) closeMobileSidebar();
    else document.body.classList.toggle('sidebar-closed');
  };
  if(overlay) overlay.onclick=closeMobileSidebar;

  // Cerrar menú al hacer clic en opciones en móvil
  document.querySelectorAll('#menuNav .menu-item').forEach(item=>{
    item.addEventListener('click',()=>{
      if(window.innerWidth<=700) closeMobileSidebar();
    });
  });
}

async function depthFor(study,signal){
  const levels=Number($('#depthLevels')?.value || 2);
  if(study.depth&&study.depth.levels>=levels)return study.depth;
  if(!config.hasKey){
    openSettings();
    throw new Error('Configura tu conexión de IA para crear las conexiones profundas. Los estudios ya guardados pueden leerse sin conexión.');
  }
  notice('Explorando conexiones de '+study.citation+'…');
  study.depth=await api('depth',{citation:study.citation,levels},signal);
  const stored={...study,items:study.items.map(({artSrc,src,...item})=>item)};
  history=[stored,...history.filter(s=>s.id!==study.id)];
  localStorage.setItem('biblia-studies',JSON.stringify(history));
  if(active?.id===study.id){
    active.depth=study.depth;
    renderDepth();
  }
  renderHistory();
  return study.depth;
}

async function exportWordDeep(study,signal){
  const depth=await depthFor(study,signal);
  const root=depth.nodes.find(n=>n.parentId===null);
  const docxBlob=await generateWordDocument({
    title: depth.title,
    citation: study.citation,
    passage: root?.source?.text ? `${root.source.text} — Reina Valera 1909` : '',
    overview: depth.overview,
    explanation: study.summary,
    items: study.items || [],
    application: depth.application,
    context: depth.context,
    keyIdeas: depth.keyIdeas,
    questions: depth.questions,
    nodes: depth.nodes.map(n=>({...n,path:connectionPath(depth,n)}))
  }, {useDeepMode:true,coverPage:true,includeImages:false});

  downloadBlob(docxBlob, `bible-study-${slug(study.citation)}-profundo.docx`);
}

async function exportStudies(){
  if(busy)return;
  setBusy(true);
  aborter=new AbortController();
  try{
    const study=active || history[0];
    if(!study)throw new Error('No hay un estudio para descargar.');
    notice('Preparando el documento profundo con texto y conexiones bíblicas…');
    await exportWordDeep(study,aborter.signal);
    notice('Descarga profunda lista.');
  }catch(e){
    notice(e.name==='AbortError'?'Exportación detenida. Los estudios completados se conservan.':e.message);
  }
  finally{
    setBusy(false);
    renderHistory();
  }
}

function openSettings(){
  const form=$('#settingsForm');
  form.elements.baseUrl.value=config.baseUrl;
  form.elements.imageBaseUrl.value=config.imageBaseUrl||'';
  form.elements.key.placeholder=config.hasKey?'Clave configurada · dejar vacío para conservar':'Introduce tu API key';
  form.elements.imageKey.placeholder=config.imageHasKey?'Clave configurada · dejar vacío para conservar':'Clave del proveedor de imágenes';

  for(const field of ['textModel','imageModel']){
    const value=config[field]||'auto';
    const select=form.elements[field];
    if(value!=='auto'&&![...select.options].some(o=>o.value===value)&&field==='textModel')select.add(new Option(value,value));
    select.value=[...select.options].some(o=>o.value===value)?value:'auto';
  }

  $('#settings').showModal();
}

// Botones de navegación y apertura de diálogos
$('#newChat').onclick=()=>{
  if(busy)return;
  resetStudy();
  notice('');
  $('#citation').focus();
};
$('#mobileNew').onclick=()=>$('#newChat').click();

function openLibrary(){
  renderHistory();
  $('#libraryDialog').showModal();
}
$('#libraryButton').onclick=openLibrary;
if($('#libraryButtonDetailed')) $('#libraryButtonDetailed').onclick=openLibrary;
if($('#libraryButtonHeader')) $('#libraryButtonHeader').onclick=openLibrary;
$('#closeLibrary').onclick=()=>$('#libraryDialog').close();

$('#settingsButton').onclick=openSettings;
$('#closeSettings').onclick=()=>$('#settings').close();
$('#mobileSettings').onclick=openSettings;
if($('#mobileSettingsHeader')) $('#mobileSettingsHeader').onclick=openSettings;

// Formulario de cita y controles de entrada
$('#composer').onsubmit=e=>{
  e.preventDefault();
  const value=$('#citation').value.trim();
  if(value)start(value);
};
$('#stop').onclick=()=>aborter?.abort();

document.querySelectorAll('[data-citation]').forEach(b=>{
  b.onclick=()=>{
    $('#citation').value=b.dataset.citation;
    $('#citation').focus();
  };
});

$('#toggleAll').onclick=()=>{
  selected=selected.size===commands.length?new Set():new Set(commands.map(c=>c.id));
  renderCommands();
};

async function saveSettings(){
  const form=$('#settingsForm');
  const values={
    baseUrl:form.elements.baseUrl.value,
    key:form.elements.key.value,
    textModel:form.elements.textModel.value,
    imageModel:form.elements.imageModel.value,
    imageBaseUrl:form.elements.imageBaseUrl.value,
    imageKey:form.elements.imageKey.value
  };
  const result=await api('config',values);
  config={
    ...config,
    baseUrl:values.baseUrl,
    hasKey:result.hasKey,
    textModel:values.textModel,
    imageModel:values.imageModel,
    imageBaseUrl:values.imageBaseUrl,
    imageHasKey:result.imageHasKey
  };
  form.elements.key.value='';
  form.elements.imageKey.value='';
  if($('#connectionStatus')) $('#connectionStatus').textContent=result.hasKey?'API key configurada':'Configura tu API key';
  $('.status-dot')?.classList.toggle('connected',result.hasKey);
}

$('#settingsForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    await saveSettings();
    $('#settings').close();
    notice('Conexión guardada. Ya puedes escribir tu cita bíblica.');
  }catch(e){$('#settingsStatus').textContent=e.message;}
};

$('#testConnection').onclick=async()=>{
  const btn=$('#testConnection');
  btn.disabled=true;
  $('#settingsStatus').textContent='Consultando /models… El servidor puede tardar si está iniciando.';
  try{
    await saveSettings();
    const data=await api('models');
    const imageData=config.imageBaseUrl?await api('image-models'):data;

    for(const field of ['textModel','imageModel']){
      const select=$('#settingsForm').elements[field];
      const previous=select.value;
      const ids=field==='imageModel'?imageData.imageCandidates:data.models.map(m=>m.id);
      select.replaceChildren(new Option('Automático · selección y alternativas','auto'));
      if(field==='imageModel')select.add(new Option('Automático del proveedor · catálogo separado','provider-auto'));
      ids.filter(id=>id!=='auto').forEach(id=>select.add(new Option(id,id)));
      if(ids.includes(previous)||previous==='provider-auto')select.value=previous;
    }

    const imageBase=config.imageBaseUrl||config.baseUrl;
    const delegated=new URL(imageBase).hostname==='freellmapi-hrfi.onrender.com'||$('#settingsForm').elements.imageModel.value==='provider-auto';

    $('#settingsStatus').textContent=`${data.models.length} modelos de texto/catálogo encontrados.\nTexto automático: ${data.textCandidates[0]||'ninguno'}.\nImágenes: ${delegated?'se solicitarán al modo automático del servidor. En FreeLLMAPI, revisa que Cloudflare tenga Account ID y token, y que un modelo de imágenes esté habilitado. La detección de texto no verifica la generación de imágenes.':imageData.imageCandidates.length?imageData.imageCandidates.join(', '):'no se anunciaron modelos en /models. Si tu proveedor usa un catálogo separado, selecciona Automático del proveedor.'}`;
  }catch(e){$('#settingsStatus').textContent=e.message;}
  finally{btn.disabled=false;}
};

$('#export').onclick=exportStudies;

// Inicializar
initMobileMenu();
renderCommands();
renderHistory();

try{
  config=await api('config');
  commands=config.commands||offlineCommands;
  selected=new Set(commands.map(c=>c.id));
  renderCommands();
  if($('#connectionStatus')) $('#connectionStatus').textContent=config.hasKey?'API key configurada':'Configura tu API key';
  $('.status-dot')?.classList.toggle('connected',config.hasKey);
}
catch(e){
  if($('#connectionStatus')) $('#connectionStatus').textContent='Biblioteca local disponible';
  notice(e.message);
}

// Manejo de PWA
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js')
    .then(reg=>console.log('SW registrado:',reg.scope))
    .catch(err=>console.log('Error SW:',err));
}
