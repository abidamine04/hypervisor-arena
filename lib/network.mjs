import {MISSIONS,validateMission} from './game.mjs';
export function runtimeChecks(stage,station={}){
 const m=MISSIONS[stage];let d;try{d=JSON.parse(station.files?.[m.editable[0]]);}catch{d={};}
 const boot=[()=>d.cpu?.virtualizationEnabled===true&&d.accelerator==='kvm'&&d.capacity?.guestRamGB===8&&d.capacity?.hostReserveGB===4,()=>d.guests?.domain==='domU'&&d.guests?.privileged===false,()=>d.serviceVM?.generation===2&&d.serviceVM?.secureBoot===true,()=>d.source==='esx-01'&&d.target==='esx-03'&&d.mode==='live'&&d.vm?.ramGB===8&&d.vm?.vcpus===4][stage]();
 const storage=[()=>d.disk?.bus==='virtio',()=>d.backend?.device==='vg-campus/api'&&d.backend?.mode==='read-write'&&d.guests?.ioBackend==='dom0',()=>d.recovery?.checkpoint==='production',()=>d.storage==='shared-nothing'][stage]();
 const network=[()=>d.network?.bridge==='br-campus'&&d.network?.vlan===120,()=>d.network?.bridge==='xenbr-campus'&&d.network?.vlan===120,()=>d.network?.switch==='Campus-Internal'&&d.network?.vlan===120,()=>d.migrationNetwork?.interface==='vmk2'&&d.migrationNetwork?.vlan===220&&d.limits?.bandwidthMbps===4000&&d.limits?.maxDowntimeMs===500][stage]();
 const checks=[{id:'vm-boot',label:'VM démarrée / état opérationnel',ok:boot},{id:'storage',label:'Accès stockage / profil de données',ok:storage},{id:'network',label:'Interface, VLAN et chemin réseau',ok:network},{id:'service',label:'Service redémarré avec configuration valide',ok:!!station.ready&&validateMission(stage,station.files||{}).ok}];
 return {id:m.id,ok:checks.every(c=>c.ok),checks};
}
export function diagnoseStation(stage,files,ready=false){const result=runtimeChecks(stage,{files,ready});return {simulation:true,server:result.id,checks:result.checks,summary:result.ok?'Le poste paraît sain. Vérifier ensuite le parcours applicatif complet.':'Incident détecté : '+result.checks.filter(c=>!c.ok).map(c=>c.label).join(' ; ')};}
export function testTeamNetwork(stations){
 const nodes=MISSIONS.map((m,i)=>runtimeChecks(i,stations[i]));
 const links=[0,1,2].map(i=>({from:nodes[i].id,to:nodes[i+1].id,protocol:['storage-rpc','integration-channel','migration-control'][i],ok:nodes[i].ok&&nodes[i+1].ok}));
 const healthy=nodes.every(n=>n.ok)&&links.every(l=>l.ok),application={name:'campus-api',request:'GET /health + transaction lecture/écriture',status:healthy?200:503,dataRoundTrip:healthy,ok:healthy};
 return {ok:healthy,nodes,links,application,simulation:true};
}
