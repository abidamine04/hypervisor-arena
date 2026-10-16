import {testTeamNetwork,diagnoseStation} from './lib/network.mjs';
import {expireRoom,durationLimit} from './lib/timing.mjs';
import http from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {MISSIONS,workspace,validateMission,activeElapsed,leaderboard} from './lib/game.mjs';
import {joinTeam,teamState,teamRows,membersOf,editableStation,teamCreator} from './lib/teams.mjs';
import {validAvatar} from './public/shared.js';

const ROOT=dirname(fileURLToPath(import.meta.url));
const DATA=resolve(process.env.DATA_DIR||resolve(ROOT,'data'));mkdirSync(DATA,{recursive:true});
const DB=resolve(DATA,'arena.json');
let db=existsSync(DB)?JSON.parse(readFileSync(DB,'utf8')):{rooms:{},players:{}};
db.teams||={};
const persist=()=>{writeFileSync(DB+'.tmp',JSON.stringify(db),{mode:0o600});renameSync(DB+'.tmp',DB);};
const adminPassword=process.env.ADMIN_PASSWORD||randomBytes(12).toString('base64url');
const salt=randomBytes(16), passwordHash=scryptSync(adminPassword,salt,32);
const adminSessions=new Map(),attempts=new Map();
const hash=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const safe=s=>String(s||'').trim().replace(/[\u0000-\u001f]/g,'').slice(0,28);
const cookie=(req,key)=>{const match=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='));return match?.slice(key.length+1)||'';};
const setCookie=(name,value,ttl=43200)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${process.env.COOKIE_SECURE==='true'?'; Secure':''}`;
function json(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(obj));}
function requireAdmin(req){const t=cookie(req,'arena_admin');const expiry=adminSessions.get(t);if(!expiry||expiry<Date.now()){adminSessions.delete(t);throw Object.assign(Error('Accès administrateur requis.'),{status:401});}}
function getRoom(code){const r=db.rooms[String(code||'').toUpperCase()];if(!r)throw Object.assign(Error('Salle introuvable. Vérifie le code.'),{status:404});if(expireRoom(r))persist();return r;}
function getPlayer(req,code){const h=hash(cookie(req,'arena_player'));const p=Object.values(db.players).find(p=>p.tokenHash===h&&p.room===code&&!p.removed);if(!p)throw Object.assign(Error('Rejoins cette salle pour ouvrir ton poste.'),{status:401});return p;}
function rawState(room,player=null,station){if(expireRoom(room))persist();const base={serverNow:Date.now(),room:{code:room.code,title:room.title,hostName:room.hostName||'Hôte',hostAvatar:room.hostAvatar||'owl',mode:room.mode||'solo',teamSize:4,maxTeams:null,timeLimitMs:room.timeLimitMs||0,expired:!!room.expired,remainingMs:room.timeLimitMs?Math.max(0,room.timeLimitMs-activeElapsed(room)):null,status:room.status,startedAt:room.startedAt,pausedAt:room.pausedAt,elapsedMs:activeElapsed(room),createdAt:room.createdAt},leaderboard:room.mode==='teams'?teamRows(db,room):leaderboard(room,Object.values(db.players)),player:null,workspace:null};if(!player)return base;if(room.mode==='teams')return {...base,...teamState(db,room,player,station)};return {...base,player:{id:player.id,labId:player.id,name:player.name,avatar:player.avatar||'robot',stage:player.stage,serviceReady:!!player.serviceReady,attempts:player.attempts,finishedAt:player.finishedAt,elapsedMs:player.finishElapsed??activeElapsed(room),files:room.startedAt&&Date.now()>=room.startedAt?{...workspace(player.stage)?.files,...player.files}:{}},workspace:room.status!=='waiting'&&Date.now()>=room.startedAt&&!player.finishedAt?workspace(player.stage):null};}
function state(room,player=null,station){const s=rawState(room,player,station);if(s.player){s.player.diagnosed=!!player.diagnosedStages?.includes(s.player.stage);if(s.workspace&&!s.player.diagnosed){for(const name of s.workspace.editable){delete s.workspace.files[name];delete s.player.files[name];}delete s.workspace.files['brief-assistant.md'];delete s.player.files['brief-assistant.md'];}}return s;}
async function body(req){let bytes=0,chunks=[];for await(const c of req){bytes+=c.length;if(bytes>65536)throw Object.assign(Error('Requête trop volumineuse.'),{status:413});chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw Object.assign(Error('JSON de requête invalide.'),{status:400});}}
function rateLimit(key,max=100,window=60000){const now=Date.now();let a=attempts.get(key);if(!a||now-a.start>window){a={start:now,n:0};attempts.set(key,a);}a.n++;if(a.n>max)throw Object.assign(Error('Trop de tentatives. Patiente un instant.'),{status:429});if(attempts.size>10000){for(const [k,v]of attempts)if(now-v.start>window)attempts.delete(k);}}
function active(room){if(room.status!=='running'||Date.now()<room.startedAt)throw Object.assign(Error(room.status==='paused'?'Course en pause.':'La course n’est pas active.'),{status:409});}
function acceptedFiles(player,stage,files){if(!files||typeof files!=='object'||Array.isArray(files))throw Object.assign(Error('Fichiers manquants.'),{status:400});const out={...player.files};for(const key of MISSIONS[stage].editable){if(typeof files[key]!=='string'||files[key].length>16000)throw Object.assign(Error('Fichier invalide ou trop volumineux.'),{status:400});out[key]=files[key];}return out;}
setInterval(()=>{let changed=false;for(const room of Object.values(db.rooms))changed=expireRoom(room)||changed;if(changed)persist();},1000).unref();
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 try{
 const u=new URL(req.url,'http://localhost'); const path=u.pathname;
 if(req.method==='POST'){const origin=req.headers.origin;if(origin&&origin!==`${req.socket.encrypted?'https':'http'}://${req.headers.host}`&&origin!==process.env.PUBLIC_ORIGIN)throw Object.assign(Error('Origine refusée.'),{status:403});}
 if(path.startsWith('/api/')){
  rateLimit(req.socket.remoteAddress+':all',600);
  if(path==='/api/lobby'&&req.method==='GET'){const room=getRoom(u.searchParams.get('code'));return json(res,200,{mode:room.mode||'solo',teamSize:4,maxTeams:null,teams:Object.values(db.teams).filter(t=>t.room===room.code&&!t.removed).map(t=>({name:t.name,count:membersOf(db,t).length}))});}
  if(path==='/api/session'&&req.method==='GET'){let admin=false;try{requireAdmin(req);admin=true;}catch{}return json(res,200,{admin});}
  if(path==='/api/active-room'&&req.method==='GET'){const rooms=Object.values(db.rooms).reverse().sort((a,b)=>b.createdAt-a.createdAt);const room=rooms.find(r=>r.status!=='ended')||rooms[0];return json(res,200,room?state(room):{room:null,leaderboard:[]});}
  if(path==='/api/health'&&req.method==='GET')return json(res,200,{ok:true});
  if(path==='/api/admin/login'&&req.method==='POST'){rateLimit(req.socket.remoteAddress+':login',8);const b=await body(req);const attempt=typeof b.password==='string'&&b.password.length<=256?scryptSync(b.password,salt,32):Buffer.alloc(32);if(!timingSafeEqual(attempt,passwordHash))throw Object.assign(Error('Mot de passe incorrect.'),{status:401});const t=token();adminSessions.set(t,Date.now()+43200000);return json(res,200,{ok:true},{'Set-Cookie':setCookie('arena_admin',t)});}
  if(path.startsWith('/api/admin/')){
   requireAdmin(req);
   if(path==='/api/admin/logout'&&req.method==='POST'){adminSessions.delete(cookie(req,'arena_admin'));return json(res,200,{ok:true},{'Set-Cookie':setCookie('arena_admin','',0)});}
   if(path==='/api/admin/rooms'&&req.method==='GET')return json(res,200,{rooms:Object.values(db.rooms).map(r=>state(r))});
   if(path==='/api/admin/rooms'&&req.method==='POST'){const b=await body(req);let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(db.rooms[code]);const room={code,title:safe(b.title)||'Opération Campus',hostName:safe(b.hostName)||'Hôte',hostAvatar:validAvatar(b.hostAvatar)?b.hostAvatar:'owl',mode:b.mode==='teams'?'teams':'solo',timeLimitMs:durationLimit(b.timeLimitMinutes),status:'waiting',createdAt:Date.now(),startedAt:null,pausedAt:null,pausedMs:0};db.rooms[code]=room;persist();return json(res,201,state(room));}
   const match=path.match(/^\/api\/admin\/rooms\/([A-F0-9]{6})\/(start|pause|resume|stop|export|remove|delete)$/);
   if(match){const room=getRoom(match[1]),action=match[2];if(action==='export'&&req.method==='GET')return json(res,200,state(room),{'Content-Disposition':`attachment; filename="results-${room.code}.json"`});if(req.method!=='POST')throw Object.assign(Error('Méthode refusée.'),{status:405});const b=await body(req);
    if(action==='delete'){if(room.status!=='ended')throw Object.assign(Error('Termine la course avant de supprimer la session.'),{status:409});if(b.confirmCode!==room.code)throw Object.assign(Error('Confirmation de suppression manquante.'),{status:400});for(const [id,p]of Object.entries(db.players))if(p.room===room.code)delete db.players[id];for(const [id,t]of Object.entries(db.teams))if(t.room===room.code)delete db.teams[id];delete db.rooms[room.code];persist();return json(res,200,{ok:true,deletedCode:room.code});}
    if(action==='start'){if(room.status!=='waiting')throw Object.assign(Error('Crée une nouvelle salle pour rejouer.'),{status:409});if(!Object.values(db.players).some(p=>p.room===room.code&&!p.removed))throw Object.assign(Error('Attends au moins un joueur.'),{status:409});room.status='running';room.startedAt=Date.now()+5000;}
    if(action==='pause'){active(room);room.status='paused';room.pausedAt=Date.now();}
    if(action==='resume'){if(room.status!=='paused')throw Object.assign(Error('Course non suspendue.'),{status:409});room.pausedMs+=Date.now()-room.pausedAt;room.pausedAt=null;room.status='running';}
    if(action==='stop'){if(room.status==='waiting')throw Object.assign(Error('La course n’a pas commencé.'),{status:409});if(!room.pausedAt)room.pausedAt=Date.now();room.status='ended';}
    if(action==='remove'&&db.teams[b.playerId]?.room===room.code){db.teams[b.playerId].removed=true;for(const p of Object.values(db.players))if(p.teamId===b.playerId)p.removed=true;persist();return json(res,200,state(room));}
    if(action==='remove'){const p=db.players[b.playerId];if(!p||p.room!==room.code)throw Object.assign(Error('Joueur introuvable.'),{status:404});p.removed=true;}
    persist();return json(res,200,state(room));
   }
   throw Object.assign(Error('Route inconnue.'),{status:404});
  }
  if(path==='/api/join'&&req.method==='POST'){rateLimit(req.socket.remoteAddress+':join',200);const b=await body(req),r=getRoom(b.code);if(r.status!=='waiting')throw Object.assign(Error('Inscriptions fermées : la course a commencé.'),{status:409});const name=safe(b.name);if(!name)throw Object.assign(Error('Choisis un pseudo.'),{status:400});const existing=Object.values(db.players).find(p=>p.room===r.code&&p.tokenHash===hash(cookie(req,'arena_player'))&&!p.removed);if(existing)return json(res,200,state(r,existing));if(Object.values(db.players).some(p=>p.room===r.code&&!p.removed&&p.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Object.assign(Error('Ce pseudo est déjà pris.'),{status:409});const t=token(),p={id:randomBytes(12).toString('hex'),tokenHash:hash(t),room:r.code,name,avatar:validAvatar(b.avatar)?b.avatar:'robot',stage:0,files:{...MISSIONS[0].files},attempts:0,finishedAt:null,finishElapsed:null,removed:false};if(r.mode==='teams'){const team=joinTeam(db,r,b.teamName,p.avatar);p.teamId=team.id;if(!team.creatorId)team.creatorId=p.id;p.assignedStation=membersOf(db,team).length;delete p.files;}db.players[p.id]=p;persist();return json(res,201,state(r,p),{'Set-Cookie':setCookie('arena_player',t)});}
  if(path==='/api/state'&&req.method==='GET'){const room=getRoom(u.searchParams.get('code'));let p=null;try{p=getPlayer(req,room.code);}catch{}return json(res,200,state(room,p,u.searchParams.get('station')));}
  if(path==='/api/diagnose'&&req.method==='POST'){const b=await body(req),room=getRoom(b.code),p=getPlayer(req,room.code);active(room);const stage=room.mode==='teams'?b.stage:p.stage;if(!Number.isInteger(stage)||stage<0||stage>3)throw Object.assign(Error('Poste inconnu.'),{status:400});const lab=room.mode==='teams'?db.teams[p.teamId]?.stations[stage]:{files:p.files,ready:p.serviceReady};if(!lab)throw Object.assign(Error('Poste indisponible.'),{status:409});p.diagnosedStages||=[];if(!p.diagnosedStages.includes(stage))p.diagnosedStages.push(stage);persist();return json(res,200,{report:diagnoseStation(stage,lab.files,lab.ready),...state(room,p,stage)});}
  if(path==='/api/network'&&req.method==='POST'){
   const b=await body(req),room=getRoom(b.code),p=getPlayer(req,room.code);active(room);rateLimit(p.id+':network',100);const bad=message=>json(res,200,{ok:false,errors:[message],...state(room,p,b.stage)});
   if(room.mode==='teams'){
    const team=db.teams[p.teamId];if(!team||team.removed||team.finishedAt)throw Object.assign(Error('Équipe indisponible ou course terminée.'),{status:409});team.links||=[];
    if(b.action==='check'){
     if(teamCreator(db,team)!==p.id)throw Object.assign(Error('Seul le créateur peut effectuer le contrôle final du groupe.'),{status:403});
     const report=testTeamNetwork(team.stations);if(!report.ok)return json(res,200,{ok:false,report,errors:['Contrôle global refusé : réparer puis redémarrer les quatre services avant de tester leurs communications.'],...state(room,p,b.stage)});
     team.links=[0,1,2];for(const st of team.stations){st.done=true;st.solvedBy=p.name;}room.finishCount=(room.finishCount||0)+1;team.finishOrder=room.finishCount;team.finishedAt=Date.now();team.finishElapsed=activeElapsed(room,team.finishedAt);persist();return json(res,200,{ok:true,phase:'complete',report,...state(room,p,b.stage)});
    }
    const from=b.stage,to=MISSIONS.findIndex(m=>m.id===String(b.target).toLowerCase());if(b.action!=='ping'||!Number.isInteger(from)||from<0||from>3||to<0||Math.abs(from-to)!==1)return bad('Teste un serveur voisin : kvm ↔ xen ↔ hyperv ↔ esxi.');
    if(![from,to].every(index=>team.stations[index].ready&&validateMission(index,team.stations[index].files).ok))return bad('Communication impossible : les deux services voisins doivent être réparés et redémarrés.');
    const edge=Math.min(from,to);if(!team.links.includes(edge))team.links.push(edge);team.links.sort();for(const st of team.stations){st.done=team.links.includes(st.index)||team.links.includes(st.index-1);if(st.done)st.solvedBy=p.name;}persist();return json(res,200,{ok:true,phase:'network',...state(room,p,from)});
   }
   if(p.finishedAt||b.stage!==p.stage)throw Object.assign(Error('Poste indisponible.'),{status:409});if(b.action!=='ping'||b.target!=='gateway')return bad('En solo, vérifie la communication avec gateway.');if(!p.serviceReady||!validateMission(p.stage,p.files).ok)return bad('Le service doit être réparé puis redémarré avant de contacter gateway.');
   p.stage++;p.serviceReady=false;if(p.stage===MISSIONS.length){room.finishCount=(room.finishCount||0)+1;p.finishOrder=room.finishCount;p.finishedAt=Date.now();p.finishElapsed=activeElapsed(room,p.finishedAt);}else p.files={...MISSIONS[p.stage].files};persist();return json(res,200,{ok:true,phase:'network',...state(room,p)});
  }
  if((path==='/api/files'||path==='/api/validate')&&req.method==='POST'){const b=await body(req),room=getRoom(b.code),p=getPlayer(req,room.code);active(room);if(!p.diagnosedStages?.includes(b.stage))throw Object.assign(Error('Commence par un diagnostic : consulte l’état du service dans le terminal.'),{status:403});if(path==='/api/validate'&&(b.action!=='restart'||b.service!==MISSIONS[b.stage]?.service))throw Object.assign(Error('Redémarre le service du poste avec systemctl restart.'),{status:400});
   if(room.mode==='teams'){
    const {team,station}=editableStation(db,p,b);station.files=acceptedFiles(station,b.stage,b.files);station.version++;station.lastEditor=p.name;
    if(path==='/api/files'){station.ready=false;persist();return json(res,200,{ok:true,version:station.version});}
    rateLimit(team.id+':validate',160);team.attempts++;station.attempts++;const result=validateMission(b.stage,station.files);
    station.ready=result.ok;
    persist();const solved=MISSIONS[b.stage];return json(res,200,{...result,phase:'service',...(result.ok?{explanation:solved.explanation,source:solved.source}:{}),...state(room,p,b.stage)});
   }
   if(p.finishedAt)throw Object.assign(Error('Ta course est terminée.'),{status:409});if(b.stage!==p.stage)throw Object.assign(Error('La mission a changé. Actualise ton poste.'),{status:409});p.files=acceptedFiles(p,p.stage,b.files);
   if(path==='/api/files'){p.serviceReady=false;persist();return json(res,200,{ok:true});}
   rateLimit(p.id+':validate',60);p.attempts++;const result=validateMission(p.stage,p.files);p.serviceReady=result.ok;persist();return json(res,200,{...result,phase:'service',...state(room,p)});
  }
  throw Object.assign(Error('Route inconnue.'),{status:404});
 }
 if(req.method!=='GET'&&req.method!=='HEAD')throw Object.assign(Error('Méthode refusée.'),{status:405});
 const allowed={'/':'index.html','/admin':'index.html','/board':'index.html','/app.js':'app.js','/shared.js':'shared.js','/effects.js':'effects.js','/style.css':'style.css'};const file=allowed[path];if(!file)throw Object.assign(Error('Page introuvable.'),{status:404});const data=readFileSync(resolve(ROOT,'public',file));const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 }catch(e){json(res,e.status||500,{error:e.status?e.message:'Erreur serveur. Vérifie les journaux.'});if(!e.status)console.error(e);}
});
const PORT=Number(process.env.PORT||5173),HOST=process.env.HOST||'0.0.0.0';
server.listen(PORT,HOST,()=>{console.log('LISTENING_PORT='+server.address().port);console.log(`\n HYPERVISOR ARENA · datacenter rescue\n Joueurs : http://localhost:${PORT}\n Admin   : http://localhost:${PORT}/admin\n${process.env.ADMIN_PASSWORD?' Mot de passe admin : défini par ADMIN_PASSWORD':' Mot de passe admin généré : '+adminPassword}\n Les joueurs rejoignent http://VOTRE-IP:${PORT} sur le même réseau.\n`);});
