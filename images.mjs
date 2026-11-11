export async function inlineImage(src,signal,fetcher=fetch){
  if(/^data:image\/(png|jpeg|webp);base64,/.test(src))return src;
  const url=new URL(src);if(!['https:','http:'].includes(url.protocol))throw new Error('La ilustración no tiene un formato compatible.');
  let response;try{response=await fetcher(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000),redirect:'follow'});}catch(e){if(signal?.aborted)throw e;throw new Error('No se pudo descargar la ilustración del proveedor. Vuelve a generar la imagen.');}
  if(!response.ok)throw new Error('El proveedor no permitió descargar la ilustración para la lámina.');
  const limit=20*1024*1024;
  if(Number(response.headers.get('content-length'))>limit)throw new Error('La ilustración excede el tamaño máximo de 20 MB.');
  const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>limit)throw new Error('La ilustración excede el tamaño máximo de 20 MB.');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  let mime;if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
  else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
  else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')mime='image/webp';
  else throw new Error('El proveedor no devolvió un archivo PNG, JPEG o WebP válido.');
  return `data:${mime};base64,${bytes.toString('base64')}`;
}
