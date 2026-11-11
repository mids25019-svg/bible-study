import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {publicAssets} from '../public-assets.mjs';

const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(){
  const listeners={},stores=new Map();let disconnected=false;
  const cache={addAll:async paths=>{for(const path of paths)stores.set(path,new Response('cached '+path));},match:async key=>stores.get(key)?.clone(),put:async(key,value)=>stores.set(key,value)};
  const deleted=[];
  const context={URL,Response,self:{location:{origin:'https://bible.example'},clients:{claim:async()=>{}},skipWaiting(){},addEventListener:(type,fn)=>listeners[type]=fn},caches:{open:async()=>cache,keys:async()=>['unrelated-cache','bible-study-shell-old','bible-study-shell-v1'],delete:async key=>deleted.push(key)},fetch:async()=>{if(disconnected)throw new Error('offline');return {ok:true,type:'basic',clone:()=>new Response('fresh')};}};
  vm.runInNewContext(source,context);
  return {listeners,stores,deleted,offline:()=>disconnected=true};
}
test('manifest y PNG de instalación tienen nombre, tamaños e iconos válidos',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.name,'Bible study');assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');
  assert(manifest.icons.some(i=>i.sizes==='192x192'));assert(manifest.icons.some(i=>i.purpose==='maskable'));
  for(const icon of manifest.icons){assert(publicAssets[icon.src]);const bytes=await readFile(new URL('../public'+icon.src,import.meta.url));const [w,h]=icon.sizes.split('x').map(Number);assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h);}
});
test('precache incluye solo archivos públicos existentes, no configuración ni claves',async()=>{
  const w=worker();let ready;w.listeners.install({waitUntil:p=>ready=p});await ready;
  assert(w.stores.has('/'));assert(w.stores.has('/commands.js'));assert(w.stores.has('/image-store.js'));
  for(const path of w.stores.keys()){assert(!path.startsWith('/api/'));assert(publicAssets[path]);await readFile(new URL('../public/'+publicAssets[path].file,import.meta.url));}
});
test('sin servidor se recuperan la página y módulos desde la caché',async()=>{
  const w=worker();let ready;w.listeners.install({waitUntil:p=>ready=p});await ready;w.offline();
  for(const path of ['/','/app.js','/commands.js']){let result;w.listeners.fetch({request:{url:'https://bible.example'+path,method:'GET'},respondWith:p=>result=p});const response=await result;assert.equal(response.status,200);assert.match(await response.text(),/^cached/);}
});
test('service worker no intercepta solicitudes de IA, POST ni otros dominios',()=>{
  const w=worker();for(const request of [{url:'https://bible.example/api/config',method:'GET'},{url:'https://bible.example/api/plan',method:'POST'},{url:'https://other.example/app.js',method:'GET'}]){
    let intercepted=false;w.listeners.fetch({request,respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  }
});
test('actualizar limpia solo la caché de la aplicación y conserva otros datos',async()=>{
  const w=worker();let ready;w.listeners.activate({waitUntil:p=>ready=p});await ready;assert.deepEqual(w.deleted,['bible-study-shell-old','bible-study-shell-v1']);
});
