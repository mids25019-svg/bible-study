export const publicAssets={
  '/':{file:'index.html',type:'text/html; charset=utf-8'},
  '/style.css':{file:'style.css',type:'text/css; charset=utf-8'},
  ...Object.fromEntries(['app','pwa','commands','infographic','image-store','sw','zip','depth-report'].map(name=>['/'+name+'.js',{file:name+'.js',type:'text/javascript; charset=utf-8'}])),
  '/manifest.webmanifest':{file:'manifest.webmanifest',type:'application/manifest+json; charset=utf-8'},
  '/icons/logo.svg':{file:'icons/logo.svg',type:'image/svg+xml'},
  ...Object.fromEntries(['icon-192','icon-512','icon-maskable-512','apple-touch-icon','favicon-32'].map(name=>['/icons/'+name+'.png',{file:'icons/'+name+'.png',type:'image/png'}]))
};
