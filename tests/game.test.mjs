import {EXTRA_REPAIRS} from '../lib/challenges.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,validateMission,leaderboard,activeElapsed} from '../lib/game.mjs';
export const solutions=[
 {'kvm.json':JSON.stringify({cpu:{virtualizationEnabled:true},accelerator:'kvm',disk:{bus:'virtio'}})},
 {'xen.json':JSON.stringify({managementDomain:'dom0',physicalDrivers:'dom0',guests:{domain:'domU',privileged:false,ioBackend:'dom0'}})},
 {'hyperv.json':JSON.stringify({physicalDriversOwner:'parent',syntheticDeviceBus:'vmbus',serviceVM:{generation:2,secureBoot:true}})},
 {'migration.json':JSON.stringify({source:'esx-01',target:'esx-03',mode:'live',storage:'shared-nothing',vm:{ramGB:8,vcpus:4}})}
];
solutions.forEach((files,i)=>{const name=Object.keys(files)[0];files[name]=JSON.stringify({...JSON.parse(files[name]),...EXTRA_REPAIRS[i]});});
test('Every broken deployment fails; every repair is accepted',()=>{MISSIONS.forEach((m,i)=>{assert.equal(validateMission(i,m.files).ok,false);assert.equal(validateMission(i,solutions[i]).ok,true);});});
test('Malformed or partial configs never pass or crash validation',()=>{for(let stage=0;stage<4;stage++){for(const text of ['{','null','[]','{}','true','"x"'])assert.equal(validateMission(stage,{[MISSIONS[stage].editable[0]]:text}).ok,false);}});
test('ESXi rejects cross-vendor, free, unavailable and unknown targets',()=>{for(const target of ['esx-02','esx-04','esx-05','unknown']){const d=JSON.parse(solutions[3]['migration.json']);d.target=target;assert.equal(validateMission(3,{'migration.json':JSON.stringify(d)}).ok,false);}});
test('Lowering VM resources cannot bypass the migration mission',()=>{const d=JSON.parse(solutions[3]['migration.json']);d.vm.ramGB=0;assert.equal(validateMission(3,{'migration.json':JSON.stringify(d)}).ok,false);});
test('Pause excludes paused time; finished players rank before incomplete players',()=>{const r={code:'ABCDEF',startedAt:1000,pausedAt:8000,pausedMs:2000};assert.equal(activeElapsed(r,20000),5000);const players=[{id:'a',name:'A',room:r.code,stage:4,finishedAt:7000,finishElapsed:4000},{id:'b',name:'B',room:r.code,stage:3,finishedAt:null},{id:'c',name:'C',room:r.code,stage:4,finishedAt:6000,finishElapsed:3000}];assert.deepEqual(leaderboard(r,players).map(p=>p.id),['c','a','b']);});
test('Simultaneous millisecond arrivals preserve server acceptance order',()=>{const r={code:'ABCDEF',startedAt:1000};const players=[{id:'a',name:'A',room:r.code,stage:4,finishedAt:7000,finishOrder:2},{id:'z',name:'Z',room:r.code,stage:4,finishedAt:7000,finishOrder:1}];assert.deepEqual(leaderboard(r,players).map(p=>p.id),['z','a']);});

test('Advanced incident constraints reject baseline-only repairs and each incorrect new field',()=>{for(let stage=0;stage<4;stage++){const name=MISSIONS[stage].editable[0],correct=JSON.parse(solutions[stage][name]);for(const key of Object.keys(EXTRA_REPAIRS[stage])){const changed=structuredClone(correct);delete changed[key];assert.equal(validateMission(stage,{[name]:JSON.stringify(changed)}).ok,false);}assert.ok(MISSIONS[stage].files['diagnostic.json']);assert.ok(MISSIONS[stage].files['network-map.json']);}});
