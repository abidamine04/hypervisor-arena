export const AVATARS = [
 {id:'robot',emoji:'🤖',label:'Robot'},{id:'fox',emoji:'🦊',label:'Renard'},
 {id:'cat',emoji:'🐱',label:'Chat'},{id:'panda',emoji:'🐼',label:'Panda'},
 {id:'owl',emoji:'🦉',label:'Hibou'},{id:'dragon',emoji:'🐉',label:'Dragon'},
 {id:'astronaut',emoji:'🧑‍🚀',label:'Astronaute'},{id:'octopus',emoji:'🐙',label:'Pieuvre'},
 {id:'frog',emoji:'🐸',label:'Grenouille'},{id:'unicorn',emoji:'🦄',label:'Licorne'},
 {id:'penguin',emoji:'🐧',label:'Pingouin'},{id:'tiger',emoji:'🐯',label:'Tigre'}
];
export function avatarFor(id){return AVATARS.find(a=>a.id===id)||AVATARS[0];}
export function validAvatar(id){return AVATARS.some(a=>a.id===id);}
export function leaders(rows){
 const finishers=rows.filter(p=>p.finishedAt).sort((a,b)=>(a.finishOrder??a.finishedAt)-(b.finishOrder??b.finishedAt));
 if(finishers.length)return {kind:'winner',players:[finishers[0]],stage:4};
 const stage=Math.max(0,...rows.map(p=>p.stage));
 return {kind:stage===0?'start':'leading',players:rows.filter(p=>p.stage===stage),stage};
}
export function resolveBoardCode(explicit,remembered,available){return explicit||remembered||available?.room?.code||'';}
export function parseCommand(raw,{files={},selected='',editable=[]}={}){
 const text=raw.trim();if(!text)return {ok:true,kind:'empty'};
 const [name,...args]=text.split(/\s+/);const kind=name.toLowerCase();
 const simple=['help','ls','status','validate','reset','clear'];
 if(simple.includes(kind)){
  if(args.length)return {ok:false,message:`${kind} s’utilise sans argument.`};
  if(kind==='reset'&&!editable.includes(selected))return {ok:false,message:'Ouvre le fichier JSON modifiable pour le restaurer.'};
  return {ok:true,kind};
 }
 if(['nano','gedit'].includes(kind)){const file=args[0]||selected;return args.length<=1&&Object.hasOwn(files,file)?{ok:true,kind,file}:{ok:false,message:kind+' suivi du nom d’un fichier existant. Tape ls pour la liste.'};}
 if(kind==='cat')return args.length===1&&Object.hasOwn(files,args[0])?{ok:true,kind,file:args[0]}:{ok:false,message:'Choisis un fichier existant : cat suivi de son nom. Tape ls pour la liste.'};
 if(kind==='diagnose')return args.length?{ok:false,message:'diagnose s’utilise sans argument.'}:{ok:true,kind};
 if(kind==='ping')return args.length===1?{ok:true,kind,target:args[0].toLowerCase()}:{ok:false,message:'ping suivi du nom du serveur voisin.'};
 if(kind==='check')return args.length===1&&args[0]==='network'?{ok:true,kind,action:'check'}:{ok:false,message:'Le contrôle final utilise check network.'};
 if(kind==='systemctl'){if(args[0]==='status'&&args.length<=2)return {ok:true,kind,action:'status',service:args[1]};if(args[0]==='restart'&&args.length===2)return {ok:true,kind,action:'restart',service:args[1]};return {ok:false,message:'systemctl attend status ou restart suivi du service indiqué dans incident.log.'};}
 if(kind==='set'){
  if(!editable.includes(selected))return {ok:false,message:'Ouvre le fichier JSON modifiable avant de saisir set.'};
  const match=text.match(/^set\s+(\S+)\s+([\s\S]+)$/i);
  if(!match)return {ok:false,message:'Format attendu : set chemin valeurJSON. Consulte le diagnostic pour choisir la valeur.'};
  try{
   const keys=match[1].split('.');if(keys.some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error();
   const value=JSON.parse(match[2]),obj=JSON.parse(files[selected]);let ptr=obj;
   for(const k of keys.slice(0,-1)){if(ptr===null||typeof ptr!=='object'||!Object.hasOwn(ptr,k))throw Error();ptr=ptr[k];}
   if(ptr===null||typeof ptr!=='object'||!Object.hasOwn(ptr,keys.at(-1)))return {ok:false,message:'Ce chemin n’existe pas dans le fichier sélectionné.'};
   ptr[keys.at(-1)]=value;return {ok:true,kind,content:JSON.stringify(obj,null,2)};
  }catch{return {ok:false,message:'Vérifie le chemin et la valeur JSON. Les textes demandent des guillemets doubles.'};}
 }
 return {ok:false,message:'Commande à corriger. Tape help pour voir les commandes disponibles.'};
}
