import {randomBytes} from 'node:crypto';
import {MISSIONS,workspace,activeElapsed,leaderboard} from './game.mjs';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
export function teamCreator(db,team){return team.creatorId||Object.values(db.players).find(p=>p.teamId===team.id&&!p.removed)?.id;}
export function teamFor(db,player){const team=db.teams[player.teamId];if(!team||team.room!==player.room||team.removed)fail('Cette équipe n’est plus disponible.',401);return team;}
export function membersOf(db,team){return Object.values(db.players).filter(p=>p.teamId===team.id&&!p.removed).map(p=>({id:p.id,name:p.name,avatar:p.avatar||'robot',assignedStation:p.assignedStation,activeStation:p.activeStation??p.assignedStation,online:!!p.lastSeen&&Date.now()-p.lastSeen<10000}));}
export function joinTeam(db,room,teamName,avatar){
 const name=String(teamName||'').trim().replace(/[\u0000-\u001f]/g,'').slice(0,28);if(!name)fail('Choisis ou crée une équipe en saisissant son nom.',400);
 let team=Object.values(db.teams).find(t=>t.room===room.code&&!t.removed&&t.name.toLocaleLowerCase()===name.toLocaleLowerCase());
 if(team){if(membersOf(db,team).length>=4)fail('Cette équipe compte déjà 4 membres. Choisis une autre équipe.');}
 else {team={id:randomBytes(12).toString('hex'),room:room.code,name,avatar,stations:MISSIONS.map((m,index)=>({index,files:{...m.files},version:0,done:false,attempts:0,solvedBy:null,lastEditor:null})),attempts:0,finishedAt:null,finishElapsed:null,removed:false};db.teams[team.id]=team;}
 return team;
}
export function teamRows(db,room){return leaderboard(room,Object.values(db.teams).filter(t=>t.room===room.code&&!t.removed&&membersOf(db,t).length).map(t=>({...t,stage:t.stations.filter(s=>s.done).length,completedStages:t.stations.filter(s=>s.done).map(s=>s.index),members:membersOf(db,t)})));}
export function teamState(db,room,player,requestedStation){
 const team=teamFor(db,player);const index=requestedStation===undefined||requestedStation===null?player.assignedStation:Number(requestedStation);if(!Number.isInteger(index)||index<0||index>=4)fail('Poste inconnu.',400);
 player.activeStation=index;player.lastSeen=Date.now();const station=team.stations[index];const opened=room.startedAt&&Date.now()>=room.startedAt;const w=workspace(index);
 return {player:{id:player.id,labId:team.id,name:player.name,avatar:player.avatar||'robot',teamId:team.id,teamName:team.name,creatorId:teamCreator(db,team),canRestart:true,canFinalize:teamCreator(db,team)===player.id,verifiedLinks:team.links||[],serviceReady:!!station.ready,members:membersOf(db,team),stage:index,completedCount:team.stations.filter(s=>s.done).length,completedStages:team.stations.filter(s=>s.done).map(s=>s.index),stationDone:station.done,version:station.version,lastEditor:station.lastEditor,attempts:team.attempts,finishedAt:team.finishedAt,elapsedMs:team.finishElapsed??activeElapsed(room),files:opened?{...w.files,...station.files}:{}},workspace:opened&&room.status!=='waiting'&&!team.finishedAt?w:null,stations:team.stations.map(s=>({index:s.index,done:s.done,version:s.version,solvedBy:s.solvedBy,lastEditor:s.lastEditor}))};
}
export function editableStation(db,player,body){
 const team=teamFor(db,player);if(team.finishedAt)fail('Votre équipe a terminé la course.');
 if(!Number.isInteger(body.stage)||body.stage<0||body.stage>=4)fail('Poste inconnu.',400);
 const station=team.stations[body.stage];if(station.done)fail('Ce poste est déjà rétabli. Choisis un autre serveur.');
 if(!Number.isInteger(body.version)||body.version!==station.version)fail('Un coéquipier a modifié ce fichier. Recharge la version partagée avant de continuer.');
 return {team,station};
}
