import {config} from 'dotenv';config({path:'.env.local',quiet:true});
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {DEFAULT_BOTS,DEFAULT_SETTINGS} from '../src/lib/types';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('Integration tests only run on local Supabase.');
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false}});
const password='Local-test-'+crypto.randomUUID();const ids:string[]=[];
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await admin.rpc(name,args);assert.ifError(error);return data;}
async function room(user:string,settings={}){const {data,error}=await admin.from('rooms').insert({user_id:user,title:'Integration test',topic:'Test turn orchestration',purpose:'plan',bots:DEFAULT_BOTS,settings:{...DEFAULT_SETTINGS,cooldownSeconds:1,...settings}}).select().single();assert.ifError(error);return data;}
async function start(id:string,user:string){return rpc('room_action',{p_room:id,p_user:user,p_action:'start'});}
const quotes=Object.fromEntries(DEFAULT_BOTS.map(b=>[b.model,0.01]));
async function claim(r:{id:string;run_id:string},user:string,prices=quotes){return rpc('claim_turn',{p_room:r.id,p_user:user,p_run:r.run_id,p_prices:prices,p_daily_budget:10});}
async function finish(m:{id:string;room_id:string},cost=0.001){return rpc('finish_turn',{p_room:m.room_id,p_message:m.id,p_content:'Useful response',p_cost:cost,p_input:10,p_output:10});}
try{
 const clients=[];
 for(let i=0;i<2;i++){
  const email=`botsbots-test-${crypto.randomUUID()}@example.test`;
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);ids.push(data.user!.id);
  const c=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});assert.ifError((await c.auth.signInWithPassword({email,password})).error);clients.push(c);
 }
 const user=ids[0];let r=await start((await room(user)).id,user);
 let claims=await Promise.all(Array.from({length:12},()=>claim(r,user)));
 assert.equal(claims.filter(Boolean).length,1,'Moderated mode must admit one reply under contention');
 const first=claims.find(Boolean);await finish(first);assert.equal(await finish(first),false,'Settlement must be idempotent');
 const second=await claim(r,user);assert.notEqual(second.bot_id,first.bot_id);await finish(second);
 const third=await claim(r,user);await finish(third);assert.equal(await claim(r,user),null);
 assert.equal((await admin.from('rooms').select('status').eq('id',r.id).single()).data!.status,'paused');
 console.log('PASS moderated serialization, unique participants, round pause, idempotent settlement');
 const {data:privateRooms}=await clients[1].from('rooms').select('*');assert.equal(privateRooms!.length,0);
 assert.ok((await clients[0].rpc('claim_turn',{p_room:r.id,p_user:user,p_run:r.run_id,p_prices:quotes,p_daily_budget:10})).error);
 assert.ok((await clients[0].from('rooms').update({status:'running'}).eq('id',r.id)).error);
 assert.ok((await admin.rpc('room_action',{p_room:r.id,p_user:ids[1],p_action:'start'})).error);
 console.log('PASS RLS isolation, server-only writes, RPC access, owner check');
 r=await start((await room(user,{mode:'free',concurrency:2,maxMessages:4,maxPerBot:1})).id,user);
 claims=await Promise.all(Array.from({length:12},()=>claim(r,user)));assert.equal(claims.filter(Boolean).length,2);assert.equal(new Set(claims.filter(Boolean).map(c=>c.bot_id)).size,2);
 const requestId=crypto.randomUUID();await Promise.all(Array.from({length:8},()=>rpc('room_action',{p_room:r.id,p_user:user,p_action:'message',p_payload:{content:'Human steering',requestId}})));
 assert.equal((await admin.from('messages').select('id').eq('room_id',r.id).is('bot_id',null)).data!.length,1);
 await Promise.all(claims.filter(Boolean).map(c=>finish(c)));const last=await claim(r,user);assert.ok(last);await finish(last);assert.equal(await claim(r,user),null);
 assert.equal((await admin.from('messages').select('id').eq('room_id',r.id)).data!.length,4);
 console.log('PASS free-for-all concurrency, per-bot lock, human idempotency, total cap');
 r=await start((await room(user,{mode:'free',concurrency:3,budget:0.015})).id,user);
 claims=await Promise.all(Array.from({length:8},()=>claim(r,user)));assert.equal(claims.filter(Boolean).length,1);
 await rpc('room_action',{p_room:r.id,p_user:user,p_action:'pause'});assert.equal(await claim(r,user),null);
 assert.ok((await admin.rpc('room_action',{p_room:r.id,p_user:user,p_action:'start'})).error,'Cannot resume with pending work');
 await finish(claims.find(Boolean),0.01);r=await start(r.id,user);assert.equal(await claim(r,user),null);
 console.log('PASS atomic budget reservation, pause, pending-run fencing');
 r=await start((await room(user)).id,user);const lost=await claim(r,user);
 await admin.from('messages').update({created_at:new Date(Date.now()-130000).toISOString()}).eq('id',lost.id);
 assert.equal(await claim(r,user),null);assert.equal(await finish(lost),false);
 const stale=(await admin.from('messages').select('*').eq('id',lost.id).single()).data!;assert.equal(stale.status,'failed');assert.equal(stale.cost,null);assert.equal(stale.reserved_cost,0.01);
 console.log('PASS stale lease recovery, late-write fencing, retained uncertain cost');
 console.log('All integration checks passed. No Gateway calls were made.');
}finally{for(const id of ids)assert.ifError((await admin.auth.admin.deleteUser(id)).error);}
