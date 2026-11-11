const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
export function hasExplanations(item){return !!item?.explanation?.trim()&&Array.isArray(item.sections)&&item.sections.length>=3&&item.sections.every(s=>s?.heading?.trim()&&s?.body?.trim())&&!!item.takeaway?.trim();}

export function wrapText(text,width,fontSize,measure){
  const lines=[];
  const size=measure||((s,font)=>[...s].reduce((n,c)=>n+(/[il.,:;'!|]/.test(c)?.25:/[MWÁÓ]/.test(c)?.85:c===' '?.29:.53)*font,0));
  for(const paragraph of String(text??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').split('\n')){
    let line='';
    for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
      const candidate=line?line+' '+word:word;
      if(line&&size(candidate,fontSize)>width){lines.push(line);line='';}
      // Split an exceptionally long unbroken word so it cannot escape the page.
      if(size(word,fontSize)>width){for(const char of word){if(size(line+char,fontSize)>width){lines.push(line);line='';}line+=char;}}
      else line=line?line+' '+word:word;
    }
    if(line)lines.push(line);
  }
  return lines.length?lines:[''];
}

export function buildInfographic({item,citation,label,imageSrc,measure,textOnly=false}){
  const width=1080,margin=64,content=width-2*margin;
  const out=[];let y=0;
  const rect=(x,top,w,h,fill,rx=0)=>out.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`);
  const text=(value,x,top,size,color='#392f29',maxWidth=content,serif=false,weight=400)=>{
    const lines=wrapText(value,maxWidth,size,measure),lineHeight=size*1.36;
    out.push(`<text x="${x}" y="${top+size}" font-family="${serif?'Georgia, serif':'Arial, sans-serif'}" font-size="${size}" font-weight="${weight}" fill="${color}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?lineHeight:0}">${esc(line)}</tspan>`).join('')}</text>`);
    return lines.length*lineHeight;
  };
  rect(0,0,width,12,'#825047');
  y=47;text('BIBLE STUDY  /  '+(label||item.command).toLocaleUpperCase('es'),margin,y,20,'#946f55',content,false,600);
  y+=55;y+=text(citation.toLocaleUpperCase('es'),margin,y,57,'#773d45',content,true,600)+14;
  y+=text(item.title,margin,y,39,'#392f29',content,true)+30;
  if(!textOnly){
  const heroHeight=520,heroY=y;
  const hasArt=typeof imageSrc==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(imageSrc);
  if(hasArt){
    out.push(`<defs><clipPath id="art"><rect x="${margin}" y="${heroY}" width="${content}" height="${heroHeight}" rx="18"/></clipPath></defs><image href="${esc(imageSrc)}" x="${margin}" y="${heroY}" width="${content}" height="${heroHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#art)"/>`);
  }else{
    rect(margin,heroY,content,260,'#eae0cf',18);text('La Palabra, en perspectiva',margin+42,heroY+75,42,'#8b6b4c',content-84,true);
    text('Ilustración pendiente · el estudio escrito está disponible',margin+42,heroY+145,22,'#8b6b4c',content-84);
  }
  y+=hasArt?heroHeight+18:278;
  y+=text('RECONSTRUCCIÓN ARTÍSTICA · ESTUDIO Y PARÁFRASIS',margin,y,16,'#998373')+23;
  }
  const explanationLines=wrapText(item.explanation||'Completa las explicaciones para desarrollar este estudio.',content-64,28,measure);
  const explanationHeight=explanationLines.length*28*1.36+96;
  rect(margin,y,content,explanationHeight,'#773d45',16);
  text('EL PASAJE EN PALABRAS',margin+32,y+23,18,'#e9cfa7',content-64,false,600);
  text(item.explanation||'Completa las explicaciones para desarrollar este estudio.',margin+32,y+62,28,'#fff9ed',content-64);
  y+=explanationHeight+38;
  const sections=hasExplanations(item)?item.sections:[];
  const gap=22,colWidth=(content-gap)/2;
  for(let i=0;i<sections.length;i+=2){
    const row=sections.slice(i,i+2);
    const heights=row.map(s=>wrapText(s.heading,colWidth-48,29,measure).length*29*1.36+wrapText(s.body,colWidth-48,26,measure).length*26*1.45+95);
    const rowHeight=Math.max(...heights);
    row.forEach((s,j)=>{const x=margin+j*(colWidth+gap);rect(x,y,colWidth,rowHeight,'#f0e8d9',14);text(String(i+j+1).padStart(2,'0'),x+24,y+19,17,'#a2794d',colWidth-48,false,600);const headingHeight=text(s.heading,x+24,y+48,29,'#773d45',colWidth-48,true,600);text(s.body,x+24,y+headingHeight+62,26,'#54463a',colWidth-48);});
    y+=rowHeight+gap;
  }
  if(item.takeaway){
    y+=12;rect(margin,y,5,wrapText(item.takeaway,content-42,29,measure).length*29*1.36+66,'#b28b4c');
    text('PARA LLEVAR A TU VIDA',margin+27,y,17,'#99753f',content-42,false,600);
    y+=36;y+=text(item.takeaway,margin+27,y,29,'#54463a',content-42,true)+33;
  }
  y+=28;rect(margin,y,content,1,'#d6c9b5');y+=21;
  y+=text('Interpretación y paráfrasis · Contrasta el contenido con tu Biblia.',margin,y,18,'#95826c')+23;
  text('BIBLE STUDY',margin,y,16,'#99753f',content,false,600);y+=58;
  const height=Math.ceil(y);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(citation+' · '+item.title)}"><rect width="100%" height="100%" fill="#fbf6e9"/>${out.join('')}</svg>`;
  return {svg,width,height};
}

export function svgDataUrl(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}

export async function infographicBlob(item,citation,label){
  return svgToPng(buildInfographic({item,citation,label,imageSrc:item.artSrc}));
}
export async function svgToPng({svg,width,height}){
  const image=new Image();image.src=svgDataUrl(svg);await image.decode();
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la descarga.');
  context.drawImage(image,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('No se pudo convertir la lámina a PNG.');
  return blob;
}
export async function illustrationBlob(item){
  const src=item.artSrc||item.src;if(!/^data:image\/(png|jpeg|webp);base64,/.test(src||''))throw new Error('Esta ilustración no está guardada en el navegador. Vuelve a generarla.');
  const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('No se pudo preparar la imagen.');return blob;
}
export async function downloadInfographic(item,citation,label){
  const blob=await infographicBlob(item,citation,label);const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${citation}-${item.command}-explicado.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
