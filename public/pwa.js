let installPrompt,registration,updateRequested=false;
const install=document.querySelector('#installApp'),update=document.querySelector('#updateApp'),status=document.querySelector('#pwaStatus');
const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const setInstalled=()=>{if(installed()){install.textContent='Instalada';install.disabled=true;}};
setInstalled();
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;install.textContent='Instalar aplicación';});
window.addEventListener('appinstalled',()=>{installPrompt=null;install.textContent='Instalada';install.disabled=true;});
install.addEventListener('click',async()=>{
  if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')status.textContent='Instalación solicitada.';return;}
  const dialog=document.createElement('dialog');
  const title=document.createElement('h2');title.textContent='Instalar Bible study';
  const text=document.createElement('p');text.textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)?'En Safari, abre Compartir y selecciona Añadir a pantalla de inicio.':'Abre el menú del navegador y busca Instalar Bible study o Instalar aplicación. Si no aparece, espera a que termine de prepararse la aplicación y vuelve a abrirla en Chrome, Edge o un navegador compatible.';
  const close=document.createElement('button');close.textContent='Entendido';close.addEventListener('click',()=>{dialog.close();dialog.remove();});dialog.addEventListener('cancel',()=>dialog.remove());dialog.append(title,text,close);document.body.append(dialog);dialog.showModal();
});
function connectionStatus(){status.textContent=!navigator.onLine?'Sin conexión · biblioteca disponible':navigator.serviceWorker?.controller?'Lista para consultar sin conexión':'Preparando uso sin conexión…';}
window.addEventListener('offline',connectionStatus);window.addEventListener('online',connectionStatus);
if('serviceWorker' in navigator&&window.isSecureContext){
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(async reg=>{
    registration=reg;
    const showUpdate=()=>{if(reg.waiting)update.hidden=false;};showUpdate();
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate();});});
    await navigator.serviceWorker.ready;connectionStatus();
  }).catch(()=>{status.textContent='No se pudo preparar el uso sin conexión. Recarga con Internet.';});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{connectionStatus();if(updateRequested)location.reload();});
}else status.textContent='La instalación necesita HTTPS o localhost y un navegador compatible.';
update.addEventListener('click',()=>{
  if(document.body.classList.contains('busy')){status.textContent='Espera a que termine la generación antes de actualizar.';return;}
  if(registration?.waiting){updateRequested=true;registration.waiting.postMessage({type:'SKIP_WAITING'});}
});
