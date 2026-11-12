'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const Scene=require('./renderer/livelab-scene.js');

// Private, exact-match reuse. Bump this version when validation semantics change.
const VERSION=2;
function fingerprint(request,context){return crypto.createHash('sha256').update(JSON.stringify({version:VERSION,request,context})).digest('hex');}
function artifact(value){
  if(!value || value.kind!=='creative' || typeof value.source!=='string' || !value.source.trim() || Buffer.byteLength(value.source,'utf8')>32768 || !['description','assumptions','question','review'].every(k=>typeof value[k]==='string'&&value[k].length<=1500))throw Error('Invalid reusable activity');
  Scene.validate(value.snapshot);
  return {kind:'creative',source:value.source,description:value.description,assumptions:value.assumptions,question:value.question,review:value.review,snapshot:value.snapshot};
}
function createReuse(dataDir){
  const keyPath=path.join(dataDir,'livelab-reuse.key');
  async function key(create){
    try{const bytes=await fs.readFile(keyPath);if(bytes.length===32)return bytes;return null;}catch(e){if(e.code!=='ENOENT'||!create)return null;}
    await fs.mkdir(dataDir,{recursive:true});
    try{await fs.writeFile(keyPath,crypto.randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')return null;}
    try{const bytes=await fs.readFile(keyPath);return bytes.length===32?bytes:null;}catch{return null;}
  }
  const sign=(secret,fp,lab)=>crypto.createHmac('sha256',secret).update(JSON.stringify({version:VERSION,fingerprint:fp,artifact:lab})).digest('hex');
  async function seal(request,context,result){
    try{const secret=await key(true);if(!secret)return null;const clean=artifact(result),fp=fingerprint(request,context);return {fingerprint:fp,seal:sign(secret,fp,clean),snapshot:clean.snapshot};}catch{return null;}
  }
  async function lookup(request,context,candidate){
    try{
      const secret=await key(false),fp=fingerprint(request,context);
      if(!secret || !candidate || candidate.fingerprint!==fp || typeof candidate.seal!=='string' || !/^[a-f0-9]{64}$/.test(candidate.seal))return null;
      const clean=artifact(candidate.artifact),expected=Buffer.from(sign(secret,fp,clean),'hex'),supplied=Buffer.from(candidate.seal,'hex');
      if(!crypto.timingSafeEqual(expected,supplied))return null;
      return clean;
    }catch{return null;}
  }
  return {seal,lookup};
}
module.exports={createReuse,fingerprint,VERSION};
