'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=path.dirname(require.resolve('pdfjs-dist/package.json'));
const target=path.join(__dirname,'../renderer/vendor');
fs.mkdirSync(target,{recursive:true});
for(const file of ['pdf.mjs','pdf.worker.mjs'])fs.copyFileSync(path.join(source,'build',file),path.join(target,file));
for(const dir of ['standard_fonts','cmaps','wasm','iccs']){
  if(fs.existsSync(path.join(source,dir)))fs.cpSync(path.join(source,dir),path.join(target,dir),{recursive:true});
}
fs.copyFileSync(path.join(source,'LICENSE'),path.join(target,'PDFJS-LICENSE.txt'));
