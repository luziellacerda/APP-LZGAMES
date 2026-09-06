"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {orderTransition,assertVisible,STATES,TERMS_VERSION}=require('../lib/marketplacePolicy');
const base={buyer_customer_id:2,seller_customer_id:1,status:'requested',product_status:'reserved',moderation_status:'visible',expires_at:new Date(Date.now()+86400000)};
test('only the correct participant can accept, reject, cancel or complete',()=>{
  assert.equal(orderTransition(base,1,'accept').status,'accepted');
  assert.equal(orderTransition(base,1,'reject').status,'rejected');
  assert.equal(orderTransition(base,2,'cancel').status,'cancelled');
  for(const [actor,action] of [[3,'accept'],[3,'complete'],[2,'accept'],[2,'reject'],[1,'cancel'],[2,'complete']])assert.throws(()=>orderTransition(base,actor,action));
});
test('a timed-out reservation cannot be accepted even before the next expiry sweep',()=>{
  assert.throws(()=>orderTransition({...base,expires_at:new Date(0)},1,'accept'),{code:'RESERVATION_EXPIRED'});
});
test('moderated listings and suspended sellers cannot accept payment negotiations',()=>{
  assert.throws(()=>assertVisible({moderation_status:'hidden'}),{code:'PRODUCT_MODERATED'});
  assert.throws(()=>assertVisible({seller_suspended:1}),{code:'PRODUCT_MODERATED'});
  assert.throws(()=>orderTransition({...base,moderation_status:'hidden'},1,'accept'));
  assert.equal(orderTransition({...base,moderation_status:'hidden'},2,'cancel').status,'cancelled');
});
test('replays are read-only and still enforce participant roles',()=>{
  assert.equal(orderTransition({...base,status:'accepted'},1,'accept').replay,true);
  assert.equal(orderTransition({...base,status:'completed'},2,'complete').replay,true);
  assert.throws(()=>orderTransition({...base,status:'accepted'},2,'accept'));
  assert.throws(()=>orderTransition({...base,status:'completed'},3,'complete'),{code:'ORDER_NOT_FOUND'});
});
test('valid Brazilian states and versioned publication rules are explicit',()=>{
  assert.equal(STATES.size,27);assert.equal(STATES.has('AL'),true);assert.equal(STATES.has('ZZ'),false);assert.equal(TERMS_VERSION,'2026-09-06');
});
