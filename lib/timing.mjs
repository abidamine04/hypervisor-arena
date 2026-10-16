import {activeElapsed} from './game.mjs';
export function expireRoom(room,now=Date.now()){
 if(room.status!=='running'||!room.timeLimitMs||!room.startedAt||activeElapsed(room,now)<room.timeLimitMs)return false;
 room.status='ended';room.expired=true;room.pausedAt=room.startedAt+(room.pausedMs||0)+room.timeLimitMs;return true;
}
export function durationLimit(value){const minutes=value===undefined?20:Number(value);if(!Number.isFinite(minutes)||minutes<0||minutes>240||!Number.isInteger(minutes))throw Object.assign(Error('Durée : un nombre entier de 0 à 240 minutes (0 = sans limite).'),{status:400});return minutes*60000;}
