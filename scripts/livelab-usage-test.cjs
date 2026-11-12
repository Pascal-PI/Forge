'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createSimulatedLedger}=require('../livelab-usage.cjs');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'forge-usage-test-')),file=path.join(dir,'usage.json');
  try{
    const a=createSimulatedLedger(file),b=createSimulatedLedger(file),base={account:'learner1',period:'2026-11',limit:1};
    const concurrent=await Promise.allSettled([a.reserve({...base,id:'r1',lab:'lab1',kind:'new'}),b.reserve({...base,id:'r2',lab:'lab2',kind:'new'})]);
    assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
    const winner=concurrent.find(x=>x.status==='fulfilled').value;
    assert.deepEqual(await a.summary('learner1','2026-11'),{committed:0,reserved:1});
    await a.commit(winner.id);await b.commit(winner.id);
    assert.deepEqual(await b.summary('learner1','2026-11'),{committed:1,reserved:0});
    await assert.rejects(a.reserve({...base,id:winner.id,lab:'different',kind:'new'}),/different request/);
    assert.equal((await a.reserve({...base,id:'open',lab:winner.lab,kind:'reopen'})).amount,0);await a.commit('open');
    assert.equal((await b.reserve({...base,id:'again',lab:winner.lab,kind:'unlock'})).amount,0);await b.commit('again');
    assert.equal((await a.reserve({...base,id:'interact',lab:winner.lab,kind:'interaction'})).amount,0);await a.commit('interact');
    await a.reserve({...base,id:'minor1',lab:winner.lab,kind:'minor'});await b.reserve({...base,id:'minor2',lab:winner.lab,kind:'minor'});
    await assert.rejects(a.reserve({...base,id:'minor3',lab:winner.lab,kind:'minor'}),/two included/);
    await a.release('minor2');await b.reserve({...base,id:'minor3',lab:winner.lab,kind:'minor'});await a.commit('minor1');await a.commit('minor3');
    await assert.rejects(a.reserve({...base,id:'major1',lab:winner.lab,kind:'major'}),/consent/);
    await assert.rejects(a.reserve({...base,id:'major1',lab:winner.lab,kind:'major',consent:true}),/exhausted/);
    assert.equal((await a.reserve({...base,limit:2,id:'major1',lab:winner.lab,kind:'major',consent:true})).amount,1);await a.commit('major1');
    assert.deepEqual(await a.summary('learner1','2026-11'),{committed:2,reserved:0});
    await a.reserve({...base,account:'learner2',id:'other-user',lab:winner.lab,kind:'unlock'});await a.commit('other-user');
    assert.deepEqual(await a.summary('learner2','2026-11'),{committed:1,reserved:0});
    await a.reserve({...base,period:'2026-12',id:'new-month',lab:'lab3',kind:'new'});
    const restarted=createSimulatedLedger(file);assert.deepEqual(await restarted.summary('learner1','2026-12'),{committed:0,reserved:1});
    await restarted.release('new-month');await restarted.release('new-month');
    assert.deepEqual(await restarted.summary('learner1','2026-12'),{committed:0,reserved:0});
    const records=JSON.parse(await fs.readFile(file,'utf8'));assert(!JSON.stringify(records).includes('prompt'));
    await fs.writeFile(file,'broken');await assert.rejects(restarted.reserve({...base,id:'bad',lab:'bad',kind:'new'}));
    assert.equal(await fs.readFile(file,'utf8'),'broken');
    console.log('Simulated usage reservations, concurrency, revisions, consent and recovery passed');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
