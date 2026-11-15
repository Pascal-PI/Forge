'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {runCoding}=require('../coding-platform.cjs');const {createCoach}=require('../coach.cjs');
(async()=>{
 assert.deepEqual(await runCoding({source:'const n: number = Number(input()); console.log(n * 2)',stdin:'4'}),{output:'8\n',error:''});
 assert.match((await runCoding({source:'while (true) {}'})).error,/limit/);
 assert.ok((await runCoding({source:'throw new Error("Oops")'})).error.includes('Oops'));
 assert.equal((await runCoding({source:'console.log(typeof process, typeof require, typeof fetch)'})).output.trim(),'undefined undefined undefined');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'forge-coding-'));const key=path.join(dir,'key.txt'),old=process.env.FORGE_AI_KEY_FILE;await fs.writeFile(key,'sk-'+'test'.repeat(8));process.env.FORGE_AI_KEY_FILE=key;
 const exercise={title:'Double',prompt:'Read a number and print twice it.',starter:'const n = Number(input());\n// Print twice n',reference:'const n = Number(input()); console.log(n * 2)',tests:[{input:'4',expected:'8'},{input:'-2',expected:'-4'}]};let responses=[exercise,{verdict:'pass',findings:'Correct'}];
 const coach=createCoach({app:{getPath:()=>dir},dialog:{},getWindow:()=>null,fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(responses.shift())}]}]})})});
 try{const out=await coach.codingAssignment({topic:'doubling'});assert.equal(out.title,'Double');assert.equal(out.reference,undefined);assert.equal(out.tests.length,2);
 responses=[{...exercise,tests:[{input:'4',expected:'9'},{input:'-2',expected:'-4'}]},exercise,{verdict:'pass',findings:'Correct'}];assert.equal((await coach.codingAssignment({topic:'doubling'})).tests[0].expected,'8');
 const remoteExercise={...exercise,starter:'n = int(input())',reference:'print(int(input()) * 2)'};let calls=[];responses=[remoteExercise,{verdict:'pass',findings:'Correct'}];
 const remoteCoach=createCoach({app:{getPath:()=>dir},dialog:{},getWindow:()=>null,fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(responses.shift())}]}]})}),runner:{run:async p=>{calls.push(p);return {status:'Accepted',stdout:p.stdin==='4'?'8':'-4'};}}});
 await assert.rejects(remoteCoach.codingAssignment({topic:'Python',language:'Python'}),/Consent/);assert.equal(calls.length,0);
 const remote=await remoteCoach.codingAssignment({topic:'Python',language:'Python',remoteConsent:true});assert.equal(remote.language,'Python');assert.equal(calls.length,2);assert.ok(calls.every(x=>x.remoteConsent&&x.language==='Python'));
 }finally{if(old===undefined)delete process.env.FORGE_AI_KEY_FILE;else process.env.FORGE_AI_KEY_FILE=old;await fs.rm(dir,{recursive:true,force:true});}
 console.log('Local JavaScript/TypeScript sandbox, limits, assignment validation and repair passed');
})().catch(e=>{console.error(e);process.exitCode=1});
