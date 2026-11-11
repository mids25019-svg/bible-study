const names=['Génesis|Genesis|GEN','Éxodo|Exodo|EXO','Levítico|Levitico|LEV','Números|Numeros|NUM','Deuteronomio|DEU','Josué|Josue|JOS','Jueces|JDG','Rut|RUT','1 Samuel|1SA','2 Samuel|2SA','1 Reyes|1KI','2 Reyes|2KI','1 Crónicas|1 Cronicas|1CH','2 Crónicas|2 Cronicas|2CH','Esdras|EZR','Nehemías|Nehemias|NEH','Ester|EST','Job|JOB','Salmos|Salmo|PSA','Proverbios|PRO','Eclesiastés|Eclesiastes|ECC','Cantares|Cantar de los Cantares|SNG','Isaías|Isaias|ISA','Jeremías|Jeremias|JER','Lamentaciones|LAM','Ezequiel|EZK','Daniel|DAN','Oseas|HOS','Joel|JOL','Amós|Amos|AMO','Abdías|Abdias|OBA','Jonás|Jonas|JON','Miqueas|MIC','Nahúm|Nahum|NAM','Habacuc|HAB','Sofonías|Sofonias|ZEP','Hageo|HAG','Zacarías|Zacarias|ZEC','Malaquías|Malaquias|MAL','Mateo|MAT','Marcos|MRK','Lucas|LUK','Juan|JHN','Hechos|ACT','Romanos|ROM','1 Corintios|1CO','2 Corintios|2CO','Gálatas|Galatas|GAL','Efesios|EPH','Filipenses|PHP','Colosenses|COL','1 Tesalonicenses|1TH','2 Tesalonicenses|2TH','1 Timoteo|1TI','2 Timoteo|2TI','Tito|TIT','Filemón|Filemon|PHM','Hebreos|HEB','Santiago|JAS','1 Pedro|1PE','2 Pedro|2PE','1 Juan|1JN','2 Juan|2JN','3 Juan|3JN','Judas|JUD','Apocalipsis|REV'];
const normal=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
export function scriptureRef(value){
  const match=String(value).trim().match(/^(.+?)\s+(\d{1,3})(?::(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/);
  if(!match)throw new Error('Referencia bíblica inválida.');
  const book=names.map(x=>x.split('|')).find(parts=>parts.some(p=>normal(p)===normal(match[1])));
  const chapter=Number(match[2]),start=Number(match[3]||1),end=Number(match[4]||match[3]||5);
  if(!book||chapter<1||start<1||end<start||end-start>9)throw new Error('Usa referencias de hasta diez versículos para las conexiones.');
  return {book:book.at(-1),chapter,start,end,key:`${book.at(-1)}:${chapter}:${start}-${end}`};
}
const chapterCache=new Map();
export async function sourcePassage(reference,signal,fetcher=fetch){
  const ref=scriptureRef(reference),key=ref.book+':'+ref.chapter;
  let verses=chapterCache.get(key);
  const url=`https://bible-api.com/data/rv1909/${ref.book}/${ref.chapter}`;
  try{
    if(!verses){const response=await fetcher(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});if(response.status===404)return {status:'not_found',text:'',url};if(!response.ok)throw new Error('source unavailable');const data=await response.json();verses=data.verses;if(!Array.isArray(verses))throw new Error('invalid source');if(chapterCache.size>100)chapterCache.delete(chapterCache.keys().next().value);chapterCache.set(key,verses);}
    const selected=verses.filter(v=>v.verse>=ref.start&&v.verse<=ref.end);
    if(!selected.length||selected[0].verse!==ref.start||(reference.includes(':')&&selected.at(-1).verse!==ref.end))return {status:'not_found',text:'',url};
    return {status:'verified',translation:'Reina Valera 1909',text:selected.map(v=>`${v.verse}. ${v.text.trim()}`).join('\n'),url};
  }catch(e){if(signal?.aborted)throw e;return {status:'unavailable',text:'',url};}
}
