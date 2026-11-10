'use strict';

const API='https://codeforces.com/api/contest.list?gym=false';
const CACHE_MS=5*60*1000;
const STALE_MS=24*60*60*1000;
const MAX_RESPONSE_BYTES=5*1024*1024;

function createCodeforces({fetchImpl=fetch,now=()=>Date.now()}={}){
  let cache=null,inFlight=null,lastRequestAt=0;
  async function getUpcoming(){
    const current=now();
    if(cache&&current-cache.fetchedAt<CACHE_MS)return {...cache,cached:true,stale:false};
    if(inFlight)return inFlight;
    if(current-lastRequestAt<2000){
      if(cache&&current-cache.fetchedAt<STALE_MS)return {...cache,cached:true,stale:true};
      throw Error('Wait a moment before refreshing the Codeforces schedule.');
    }
    lastRequestAt=current;
    inFlight=(async()=>{
      try{
        const response=await fetchImpl(API,{method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw Error('Codeforces schedule request failed.');
        const declared=Number(response.headers.get('content-length'));
        if(declared>MAX_RESPONSE_BYTES)throw Error('Codeforces schedule response was too large.');
        const text=await response.text();
        if(Buffer.byteLength(text,'utf8')>MAX_RESPONSE_BYTES)throw Error('Codeforces schedule response was too large.');
        const payload=JSON.parse(text);
        if(payload?.status!=='OK'||!Array.isArray(payload.result))throw Error('Codeforces returned an unavailable schedule.');
        const second=Math.floor(now()/1000);
        const contests=payload.result.filter(item=>item&&item.phase==='BEFORE'&&Number.isSafeInteger(item.id)&&item.id>0&&typeof item.name==='string'&&item.name.trim()&&Number.isSafeInteger(item.startTimeSeconds)&&item.startTimeSeconds>second&&Number.isSafeInteger(item.durationSeconds)&&item.durationSeconds>0&&item.durationSeconds<=7*24*60*60)
          .sort((a,b)=>a.startTimeSeconds-b.startTimeSeconds)
          .slice(0,20)
          .map(item=>({id:item.id,name:item.name.trim().slice(0,180),startTimeSeconds:item.startTimeSeconds,durationSeconds:item.durationSeconds,url:`https://codeforces.com/contests/${item.id}`}));
        cache={contests,fetchedAt:now()};
        return {...cache,cached:false,stale:false};
      }catch(error){
        if(cache&&now()-cache.fetchedAt<STALE_MS)return {...cache,cached:true,stale:true};
        if(error.name==='TimeoutError'||error.name==='TypeError')throw Error('Could not reach Codeforces. Check your internet connection and retry.');
        throw Error('Could not load the public Codeforces schedule. Try again later.');
      }finally{inFlight=null;}
    })();
    return inFlight;
  }
  return {getUpcoming};
}

module.exports={createCodeforces,API,CACHE_MS,STALE_MS};
