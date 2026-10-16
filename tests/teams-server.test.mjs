import {EXTRA_REPAIRS} from '../lib/challenges.mjs';
import {MISSIONS} from '../lib/game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
const answers=[{cpu:{virtualizationEnabled:true},accelerator:'kvm',disk:{bus:'virtio'}},{managementDomain:'dom0',physicalDrivers:'dom0',guests:{domain:'domU',privileged:false,ioBackend:'dom0'}},{physicalDriversOwner:'parent',syntheticDeviceBus:'vmbus',serviceVM:{generation:2,secureBoot:true}},{source:'esx-01',target:'esx-03',mode:'live',storage:'shared-nothing',vm:{ramGB:8,vcpus:4}}];
answers.forEach((a,i)=>Object.assign(a,EXTRA_REPAIRS[i]));
const filenames=['kvm.json','xen.json','hyperv.json','migration.json'];
test('Team race: pairs, trios, four-member cap, parallel stations, isolation and atomic finish',{timeout:25000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'arena-teams-'));const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',ADMIN_PASSWORD:'test-password',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let output='',port;
 try{
  await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{output+=b;const m=output.match(/LISTENING_PORT=(\d+)/);if(m){port=m[1];resolve();}});child.once('error',reject);child.once('exit',()=>reject(Error(output)));});
  async function call(path,data,cookie=''){if(path==='/api/validate')data={...data,action:'restart',service:MISSIONS[data.stage]?.service};const r=await fetch('http://127.0.0.1:'+port+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  const admin=(await call('/api/admin/login',{password:'test-password'})).cookie;
  const created=await call('/api/admin/rooms',{title:'Co-op',mode:'teams'},admin);const code=created.body.room.code;assert.equal(created.body.room.mode,'teams');assert.equal(created.body.room.maxTeams,null);
  assert.equal((await call('/api/join',{code,name:'No team'})).status,400);
  const a1=await call('/api/join',{code,name:'A1',teamName:'Pair',avatar:'fox'}),a2=await call('/api/join',{code,name:'A2',teamName:'Pair',avatar:'cat'});
  assert.equal(a1.body.player.teamId,a2.body.player.teamId);assert.equal(a1.body.player.stage,0);assert.equal(a2.body.player.stage,1);
  const b=[];for(let i=0;i<3;i++)b.push(await call('/api/join',{code,name:'B'+i,teamName:'Trio'}));
  for(let i=0;i<4;i++)assert.equal((await call('/api/join',{code,name:'C'+i,teamName:'Four'})).status,201);
  assert.equal((await call('/api/join',{code,name:'C4',teamName:'Four'})).status,409);
  for(let i=0;i<7;i++)assert.equal((await call('/api/join',{code,name:'Extra'+i,teamName:'Extra'+i})).status,201);
  const lobby=(await call('/api/lobby?code='+code)).body;assert.equal(lobby.teams.length,10);assert.equal(lobby.teams.find(t=>t.name==='Pair').count,2);assert.equal(lobby.teams.find(t=>t.name==='Trio').count,3);
  assert.deepEqual(a1.body.player.files,{});
  const started=await call('/api/admin/rooms/'+code+'/start',{},admin);await new Promise(r=>setTimeout(r,Math.max(0,started.body.room.startedAt-Date.now()+20)));
  const early=await call('/api/state?code='+code+'&station=3',undefined,a1.cookie);assert.equal(early.body.workspace.id,'esxi');assert.equal(early.body.player.completedCount,0);
  for(const player of [a1,a2,b[0],b[1]])for(let stage=0;stage<4;stage++)assert.equal((await call('/api/diagnose',{code,stage},player.cookie)).status,200);
  const files={'kvm.json':JSON.stringify(answers[0])};
  const simultaneous=await Promise.all([a1,a2].map(p=>call('/api/files',{code,stage:0,version:0,files},p.cookie)));
  assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
  const shared=await call('/api/state?code='+code+'&station=0',undefined,a2.cookie);assert.equal(shared.body.player.version,1);assert.equal(JSON.parse(shared.body.player.files['kvm.json']).accelerator,'kvm');
  const isolated=await call('/api/state?code='+code+'&station=0',undefined,b[0].cookie);assert.equal(isolated.body.player.version,0);assert.equal(JSON.parse(isolated.body.player.files['kvm.json']).accelerator,'tcg');
  assert.equal(a1.body.player.canFinalize,true);assert.equal(a2.body.player.canFinalize,false);
  const failedPing=await call('/api/network',{code,stage:0,action:'ping',target:'xen'},a2.cookie);assert.equal(failedPing.body.ok,false);
  assert.equal((await call('/api/network',{code,stage:0,action:'check'},a2.cookie)).status,403);
  const esxi=await call('/api/validate',{code,stage:3,version:0,files:{'migration.json':JSON.stringify(answers[3])}},a2.cookie);assert.equal(esxi.body.ok,true);assert.equal(esxi.body.player.completedCount,0);assert.equal(esxi.body.player.serviceReady,true);assert.equal(esxi.body.player.finishedAt,null);
  assert.equal((await call('/api/network',{code,stage:0,action:'check'},a1.cookie)).body.ok,false);
  const solved=await Promise.all([0,1,2].map(stage=>call('/api/validate',{code,stage,version:stage===0?1:0,files:{[filenames[stage]]:JSON.stringify(answers[stage])}},a2.cookie)));
  assert.ok(solved.every(r=>r.status===200&&r.body.ok));assert.ok(solved.every(r=>r.body.player.completedCount===0));
  const before=(await call('/api/state?code='+code,undefined,a1.cookie)).body;assert.equal(before.player.completedCount,0);
  for(const [stage,target]of [[0,'xen'],[1,'hyperv'],[2,'esxi']]){const link=await call('/api/network',{code,stage,action:'ping',target},a2.cookie);assert.equal(link.body.ok,true);}
  let finished=await call('/api/state?code='+code,undefined,a2.cookie);assert.equal(finished.body.player.completedCount,4);assert.equal(finished.body.player.finishedAt,null);
  assert.equal((await call('/api/network',{code,stage:0,action:'check'},a2.cookie)).status,403);
  const finals=await Promise.all([0,1].map(()=>call('/api/network',{code,stage:0,action:'check'},a1.cookie)));assert.deepEqual(finals.map(r=>r.status).sort(),[200,409]);finished=finals.find(r=>r.status===200);
  assert.ok(finished.body.player.finishedAt);assert.equal(finished.body.leaderboard[0].name,'Pair');assert.equal(finished.body.leaderboard[0].members.length,2);assert.equal(finished.body.leaderboard[0].finishOrder,1);
  const bState=await call('/api/state?code='+code,undefined,b[1].cookie);assert.equal(bState.body.player.completedCount,0);assert.equal(bState.body.player.finishedAt,null);
  assert.equal((await call('/api/validate',{code,stage:0,version:2,files},a1.cookie)).status,409);
  for(let stage=0;stage<4;stage++){const ready=await call('/api/validate',{code,stage,version:0,files:{[filenames[stage]]:JSON.stringify(answers[stage])}},b[1].cookie);assert.equal(ready.body.ok,true);assert.equal(ready.body.player.completedCount,0);}
  const groupCheck=await call('/api/network',{code,stage:0,action:'check'},b[0].cookie);assert.equal(groupCheck.body.ok,true);assert.equal(groupCheck.body.player.completedCount,4);assert.deepEqual(groupCheck.body.player.verifiedLinks,[0,1,2]);assert.ok(groupCheck.body.player.finishedAt);assert.equal(groupCheck.body.leaderboard[0].name,'Pair');
  const persisted=JSON.parse(readFileSync(join(dir,'arena.json'),'utf8'));assert.equal(persisted.teams[a1.body.player.teamId].stations.every(s=>s.done),true);
  await call('/api/admin/rooms/'+code+'/stop',{},admin);await call('/api/admin/rooms/'+code+'/delete',{confirmCode:code},admin);
  const after=JSON.parse(readFileSync(join(dir,'arena.json'),'utf8'));assert.equal(Object.values(after.teams).some(t=>t.room===code),false);assert.equal(Object.values(after.players).some(p=>p.room===code),false);
 }finally{child.kill('SIGTERM');await once(child,'exit');}
});
