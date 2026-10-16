import test from 'node:test';
import assert from 'node:assert/strict';
import {expireRoom,durationLimit} from '../lib/timing.mjs';
test('Time limit expires exactly at the active-time boundary and freezes the clock',()=>{const r={status:'running',startedAt:1000,pausedMs:5000,timeLimitMs:60000};assert.equal(expireRoom(r,65999),false);assert.equal(expireRoom(r,66000),true);assert.equal(r.status,'ended');assert.equal(r.expired,true);assert.equal(r.pausedAt,66000);assert.equal(expireRoom(r,999999),false);});
test('Host pause and unlimited sessions do not expire',()=>{assert.equal(expireRoom({status:'paused',startedAt:1,timeLimitMs:60000,pausedAt:100},999999),false);assert.equal(expireRoom({status:'running',startedAt:1,timeLimitMs:0},999999),false);assert.equal(durationLimit(0),0);assert.equal(durationLimit(15),900000);assert.equal(durationLimit(undefined),1200000);for(const value of [-1,1.5,241,'bad'])assert.throws(()=>durationLimit(value));});
