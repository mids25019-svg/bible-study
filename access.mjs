import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export function createAccess({password='',secret=randomBytes(32).toString('hex'),secure=false,now=()=>Date.now()}={}){
  const attempts=new Map(),lifetime=7*24*60*60;
  const signature=payload=>createHmac('sha256',secret).update(payload).digest('base64url');
  const cookie=value=>`bible_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value?lifetime:0}${secure?'; Secure':''}`;
  return {
    required:!!password,
    authenticated(req){if(!password)return true;const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bible_session='))?.slice(14);if(!raw)return false;const [expires,nonce,mac]=raw.split('.');const payload=expires+'.'+nonce;return !!mac&&Number(expires)>now()&&Number(expires)<=now()+lifetime*1000&&equal(mac,signature(payload));},
    login(value,address){const current=attempts.get(address);if(current&&current.count>=8&&current.until>now())throw new Error('Demasiados intentos. Espera quince minutos.');if(typeof value!=='string'||!equal(value,password)){const entry=current&&current.until>now()?current:{count:0,until:now()+900000};entry.count++;attempts.set(address,entry);if(attempts.size>1000)for(const [key,item]of attempts)if(item.until<now())attempts.delete(key);throw new Error('Contraseña incorrecta.');}attempts.delete(address);const payload=`${now()+lifetime*1000}.${randomBytes(18).toString('base64url')}`;return cookie(payload+'.'+signature(payload));},
    logout:()=>cookie('')
  };
}
