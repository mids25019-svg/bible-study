const encoder=new TextEncoder();
const table=Uint32Array.from({length:256},(_,value)=>{let n=value;for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export async function makeZip(files){
  if(!files.length)throw new Error('No hay imágenes disponibles para exportar.');
  if(files.length>65535)throw new Error('Exporta la biblioteca en grupos más pequeños.');
  const chunks=[],directory=[];let offset=0,dirSize=0;
  for(const file of files){
    if(!file.name||file.name.startsWith('/')||file.name.split('/').includes('..'))throw new Error('Nombre de archivo inválido.');
    const name=encoder.encode(file.name),bytes=file.data instanceof Blob?new Uint8Array(await file.data.arrayBuffer()):typeof file.data==='string'?encoder.encode(file.data):file.data;
    if(!(bytes instanceof Uint8Array))throw new Error('Archivo inválido.');
    if(offset+bytes.length>0xffffffff)throw new Error('El archivo es demasiado grande. Exporta menos estudios.');
    const crc=crc32(bytes),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);header.set(name,30);
    const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
    chunks.push(header,bytes);directory.push(central);offset+=header.length+bytes.length;dirSize+=central.length;
  }
  const end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,dirSize,true);view.setUint32(16,offset,true);
  return new Blob([...chunks,...directory,end],{type:'application/zip'});
}
export function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
