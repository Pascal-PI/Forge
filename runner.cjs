'use strict';

const fs=require('node:fs/promises');
const path=require('node:path');

const API='https://ce.judge0.com';
const PRIVACY_URL='https://github.com/judge0/judge0/blob/master/PRIVACY_POLICY.md';
const LANGUAGES=['Python','C++','C','C#','Go','Swift','Java','JavaScript','Pascal','Rust','Ruby','Assembly','Elixir','Racket','TypeScript'];
const PREVIEW_LANGUAGES=['HTML','CSS'];
const DAILY_LIMIT=20;
const SOURCE_LIMIT=32*1024;
const INPUT_LIMIT=12*1024;
const OUTPUT_LIMIT=24*1024;
const STATUS_FIELDS='status_id,status,stdout,stderr,compile_output,message,time,memory,language_id';

const PATTERNS={
  Python:/^Python \(/i,
  'C++':/^C\+\+ \(GCC /i,
  C:/^C \(GCC /i,
  'C#':/^C# \(/i,
  Go:/^Go \(/i,
  Swift:/^Swift \(/i,
  Java:/^Java \(JDK /i,
  JavaScript:/^JavaScript \(Node\.js /i,
  Pascal:/^Pascal \(/i,
  Rust:/^Rust \(/i,
  Ruby:/^Ruby \(/i,
  Assembly:/^Assembly \(NASM /i,
  Elixir:/^Elixir \(/i,
  Racket:/^Racket \(/i,
  TypeScript:/^TypeScript \(/i
};

function versionParts(name){
  const matches=String(name).match(/\d+(?:\.\d+)+/g);
  return (matches?.at(-1)||'0').split('.').map(x=>Number(x)||0);
}
function compareVersion(a,b){
  const x=versionParts(a),y=versionParts(b),n=Math.max(x.length,y.length);
  for(let i=0;i<n;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}
  return 0;
}
function bestLanguageIds(rows){
  if(!Array.isArray(rows)||rows.length>500)throw Error('The remote service returned an invalid language list.');
  const valid=rows.filter(x=>x&&Number.isInteger(x.id)&&x.id>0&&typeof x.name==='string'&&x.name.length<=120);
  const selected={};
  for(const name of LANGUAGES){
    const matches=valid.filter(x=>PATTERNS[name].test(x.name)).sort((a,b)=>compareVersion(b.name,a.name));
    if(matches.length)selected[name]={id:matches[0].id,label:matches[0].name};
  }
  return selected;
}
function versionAtLeast(version,minimum='1.13.1'){
  const parse=value=>String(value).split('.').map(part=>Number.parseInt(part,10));
  const a=parse(version),b=parse(minimum);
  if(a.length!==3||a.some(x=>!Number.isInteger(x)))return false;
  for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}
  return true;
}
function decodeOutput(value){
  if(typeof value!=='string'||!value)return '';
  const decoded=Buffer.from(value,'base64').toString('utf8');
  return decoded.length>OUTPUT_LIMIT?decoded.slice(0,OUTPUT_LIMIT)+'\n[Output truncated in FORGE.]':decoded;
}
function validateRun(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid run request.');
  if(payload.remoteConsent!==true)throw Error('Explicit consent is required before sending code.');
  if(typeof payload.language!=='string'||!LANGUAGES.includes(payload.language))throw Error('Choose a supported programming language.');
  if(typeof payload.sourceCode!=='string'||!payload.sourceCode.trim())throw Error('Write a solution before running it.');
  if(Buffer.byteLength(payload.sourceCode,'utf8')>SOURCE_LIMIT)throw Error('Code is too large. Keep a run under 32 KB.');
  const stdin=payload.stdin??'';
  if(typeof stdin!=='string'||Buffer.byteLength(stdin,'utf8')>INPUT_LIMIT)throw Error('Input is too large. Keep it under 12 KB.');
  return {language:payload.language,sourceCode:payload.sourceCode,stdin};
}

function createRunner({fetchImpl=globalThis.fetch,dataDir=process.cwd(),now=()=>Date.now(),sleep,metadataTtlMs=15*60*1000}={}){
  if(typeof fetchImpl!=='function')throw Error('A fetch implementation is required.');
  let metadataCache=null,metadataExpiresAt=0,activeController=null;
  const pause=sleep||((ms,signal)=>new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new Error('Run canceled while waiting.'));return;}
    const timer=setTimeout(done,ms);
    function done(){signal?.removeEventListener('abort',cancel);resolve();}
    function cancel(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new Error('Run canceled while waiting.'));}
    signal?.addEventListener('abort',cancel,{once:true});
  }));
  const usageFile=path.join(dataDir,'runner-usage.json');

  async function requestJson(url,init={},signal,maxBytes=2*1024*1024){
    const parsedUrl=new URL(url);
    if(parsedUrl.origin!==API)throw Error('The code runner is restricted to the official Judge0 Community Edition host.');
    let response;
    try{
      const timeout=AbortSignal.timeout(8000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
      response=await fetchImpl(url,{...init,redirect:'error',signal:combined,headers:{Accept:'application/json',...(init.headers||{})}});
    }catch(error){
      if(signal?.aborted)throw Error('Run canceled. The remote sandbox may continue briefly within its strict limits.');
      if(error?.name==='TimeoutError'||error?.name==='AbortError')throw Error('The remote code service took too long to respond.');
      throw Error('Could not reach the Judge0 Community Edition service. Check your connection and try again.');
    }
    if(response.url){try{if(new URL(response.url).origin!==API)throw Error('Unexpected response host.');}catch(error){if(error.message==='Unexpected response host.')throw error;throw Error('Invalid response from the remote code service.');}}
    const length=Number(response.headers?.get?.('content-length')||0);
    if(length>maxBytes)throw Error('The remote code service returned an oversized response.');
    let text;try{text=await response.text();}catch{throw Error('Could not read the response from the remote code service.');}
    if(Buffer.byteLength(text,'utf8')>maxBytes)throw Error('The remote code service returned an oversized response.');
    let body;try{body=JSON.parse(text);}catch{throw Error('The remote code service returned an invalid response.');}
    if(!response.ok){
      if(response.status===429)throw Error('Judge0 is rate-limiting requests. Try again later.');
      if(response.status===401||response.status===403)throw Error('Judge0 did not authorize this request.');
      throw Error(`Judge0 could not accept the request (HTTP ${response.status}).`);
    }
    return body;
  }

  async function providerSnapshot(force=false){
    if(!force&&metadataCache&&metadataExpiresAt>now())return metadataCache;
    const [about,config,languages]=await Promise.all([
      requestJson(API+'/about'),requestJson(API+'/config_info'),requestJson(API+'/languages')
    ]);
    const ids=bestLanguageIds(languages);
    const secure=versionAtLeast(about?.version)&&config?.maintenance_mode!==true&&config?.enable_network===false&&config?.allow_enable_network===false;
    metadataCache={version:String(about?.version||''),secure,maintenance:config?.maintenance_mode===true,networkEnabled:config?.enable_network!==false||config?.allow_enable_network!==false,submissionDeleteEnabled:config?.enable_submission_delete===true,languageIds:ids};
    metadataExpiresAt=now()+metadataTtlMs;
    return metadataCache;
  }
  async function readUsage(){
    let value;
    try{value=JSON.parse(await fs.readFile(usageFile,'utf8'));}catch{return {day:new Date(now()).toISOString().slice(0,10),count:0};}
    const day=new Date(now()).toISOString().slice(0,10);
    return value?.day===day&&Number.isInteger(value.count)&&value.count>=0&&value.count<=DAILY_LIMIT?value:{day,count:0};
  }
  async function consumeRun(){
    const usage=await readUsage();if(usage.count>=DAILY_LIMIT)throw Error(`Daily remote-run limit reached (${DAILY_LIMIT}). Try again tomorrow.`);
    const next={day:usage.day,count:usage.count+1};
    try{await fs.mkdir(dataDir,{recursive:true});const temp=usageFile+'.tmp';await fs.writeFile(temp,JSON.stringify(next),'utf8');await fs.rename(temp,usageFile);}
    catch{throw Error('FORGE could not save its local run limit, so it did not send the code.');}
    return next;
  }
  async function status(force=false){
    const [snapshot,usage]=await Promise.all([providerSnapshot(force),readUsage()]);
    return {provider:'Judge0 Community Edition',version:snapshot.version,ready:snapshot.secure&&!snapshot.maintenance,maintenance:snapshot.maintenance,networkDisabled:!snapshot.networkEnabled,submissionDeleteEnabled:snapshot.submissionDeleteEnabled,availableLanguages:LANGUAGES.filter(name=>snapshot.languageIds[name]),unavailableLanguages:LANGUAGES.filter(name=>!snapshot.languageIds[name]),previewLanguages:PREVIEW_LANGUAGES,remainingRuns:Math.max(0,DAILY_LIMIT-usage.count),dailyLimit:DAILY_LIMIT,privacyUrl:PRIVACY_URL};
  }
  async function run(payload){
    const input=validateRun(payload);
    if(activeController)throw Error('A code run is already in progress.');
    const controller=new AbortController();activeController=controller;
    try{
      const snapshot=await providerSnapshot();
      if(snapshot.maintenance)throw Error('The remote code service is in maintenance mode. No code was sent.');
      if(!snapshot.secure)throw Error('The remote code service did not pass FORGE security checks. No code was sent.');
      const language=snapshot.languageIds[input.language];
      if(!language)throw Error(`${input.language} is not currently available from the remote service. No code was sent.`);
      await consumeRun();
      const created=await requestJson(API+'/submissions?base64_encoded=true&wait=false',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          language_id:language.id,
          source_code:Buffer.from(input.sourceCode,'utf8').toString('base64'),
          stdin:Buffer.from(input.stdin,'utf8').toString('base64'),
          cpu_time_limit:5,
          cpu_extra_time:0.5,
          wall_time_limit:10,
          memory_limit:128000,
          stack_limit:64000,
          max_processes_and_or_threads:20,
          enable_network:false
        })
      },controller.signal);
      if(typeof created?.token!=='string'||created.token.length<20||created.token.length>200||!/^[A-Za-z0-9-]+$/.test(created.token))throw Error('Judge0 returned an invalid submission token.');
      const token=created.token,deadline=now()+25000;
      while(now()<deadline){
        await pause(800,controller.signal);
        const result=await requestJson(`${API}/submissions/${encodeURIComponent(token)}?base64_encoded=true&fields=${STATUS_FIELDS}`,{},controller.signal,6*1024*1024);
        if(!Number.isInteger(result?.status_id))throw Error('Judge0 returned an invalid run status.');
        if(result.status_id<=2)continue;
        return {
          status:String(result.status?.description||`Status ${result.status_id}`).slice(0,100),
          stdout:decodeOutput(result.stdout),stderr:decodeOutput(result.stderr),
          compileOutput:decodeOutput(result.compile_output),message:decodeOutput(result.message),
          time:typeof result.time==='string'?result.time.slice(0,30):null,
          memoryKb:Number.isFinite(result.memory)?Math.max(0,Math.floor(result.memory)):null,
          language:language.label,providerVersion:snapshot.version,
          notice:'The provider stores submissions. FORGE does not save the submitted code or result in your progress.'
        };
      }
      throw Error('The run is still queued. FORGE stopped waiting; the service will enforce its time and memory limits.');
    }finally{activeController=null;}
  }
  function cancel(){if(!activeController)return false;activeController.abort();return true;}
  return {status,run,cancel,privacyUrl:PRIVACY_URL};
}

module.exports={API,PRIVACY_URL,LANGUAGES,PREVIEW_LANGUAGES,DAILY_LIMIT,SOURCE_LIMIT,INPUT_LIMIT,OUTPUT_LIMIT,bestLanguageIds,versionAtLeast,validateRun,createRunner};
