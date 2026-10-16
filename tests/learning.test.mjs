import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,workspace,validateMission} from '../lib/game.mjs';
import {parseCommand} from '../public/shared.js';

test('Every guided command sequence repairs its mission through the actual parser',()=>{
 for(let stage=0;stage<MISSIONS.length;stage++){
  const w=workspace(stage),files={...w.files},selected=w.editable[0];
  for(const step of w.guide.steps){const r=parseCommand(step.command,{files,selected,editable:w.editable});assert.equal(r.ok,true,step.command);files[selected]=r.content;}
  assert.equal(validateMission(stage,files).ok,true,w.id);
 }
});
test('AI briefs identify the file, value types, selection behaviour and allowed commands',()=>{
 for(let stage=0;stage<4;stage++){
  const w=workspace(stage),brief=w.files['brief-assistant.md'];
  assert.ok(brief.includes(w.editable[0]));assert.match(brief,/Une commande par ligne/);assert.match(brief,/true\/false sans guillemets/);assert.match(brief,/cat NOM ouvre ET sélectionne/);
  for(const step of w.guide.steps)assert.ok(brief.includes(step.path));
  assert.equal(w.editable.includes('brief-assistant.md'),false);
 }
});
test('Learning workspaces are separate copies and cannot modify mission definitions',()=>{
 const w=workspace(0);w.guide.steps[0].value='wrong';w.files['kvm.json']='changed';
 assert.equal(workspace(0).guide.steps[0].value,true);
 assert.notEqual(MISSIONS[0].files['kvm.json'],'changed');
});
