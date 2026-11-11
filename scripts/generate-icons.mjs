import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
// The checked-in icons need no runtime dependency. Pass an installed Sharp directory to regenerate.
const sharp=require(process.argv[2]||'sharp');
const dir=new URL('../public/icons/',import.meta.url);await mkdir(dir,{recursive:true});
const svg=await readFile(new URL('logo.svg',dir),'utf8');
for(const size of [192,512])await sharp(Buffer.from(svg)).resize(size,size).png().toFile(fileURLToPath(new URL(`icon-${size}.png`,dir)));
const maskable=svg.replace('<rect width="512" height="512" rx="108" fill="#743d45"/>','<rect width="512" height="512" fill="#743d45"/><g transform="translate(36 36) scale(.859375)">').replace('</svg>','</g></svg>');
await sharp(Buffer.from(maskable)).png().toFile(fileURLToPath(new URL('icon-maskable-512.png',dir)));
await sharp(Buffer.from(svg)).resize(180,180).png().toFile(fileURLToPath(new URL('apple-touch-icon.png',dir)));
await sharp(Buffer.from(svg)).resize(32,32).png().toFile(fileURLToPath(new URL('favicon-32.png',dir)));
console.log('Iconos de Bible study generados.');
