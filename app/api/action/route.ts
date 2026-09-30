import { db,bucket,owner,connection,bridge,sameOrigin,reply,fail } from '@/lib/storage';
import { parseReceipt,validDate } from '@/lib/receipt-parser.mjs';
function imageBytes(b:any){if(!['image/jpeg','image/png'].includes(b.mime)||typeof b.image!=='string'||b.image.length>8000000)throw new Error('6MB 이하의 JPEG 또는 PNG 사진을 선택하세요.');let bytes;try{bytes=Uint8Array.from(atob(b.image),c=>c.charCodeAt(0));}catch{throw new Error('사진을 읽을 수 없습니다.');}const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;if((b.mime==='image/jpeg'&&!jpg)||(b.mime==='image/png'&&!png))throw new Error('사진 형식이 일치하지 않습니다.');return bytes;}
async function sync(u:string,id:string){
 const r=await db().prepare('SELECT r.*,c.name company,c.color FROM receipts r JOIN companies c ON r.company_id=c.id WHERE r.owner=? AND r.id=?').bind(u,id).first<any>();if(!r)throw new Error('기록을 찾을 수 없습니다.');
 const c=await connection(u);if(!c)throw new Error('설정에서 구글을 먼저 연결해 주세요.');
 const f=await bucket().get(r.image_key);if(!f)throw new Error('저장된 사진을 찾을 수 없습니다.');
 const bytes=new Uint8Array(await f.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 try{const result=await bridge(c,{action:'sync',id:r.id,date:r.date,amount:r.amount,currency:r.currency,place:r.place,note:r.note,company:r.company,color:r.color,image:btoa(binary),mime:r.mime});await db().prepare('UPDATE receipts SET sync=? WHERE owner=? AND id=?').bind(JSON.stringify(result),u,id).run();return result;}
 catch(e){const prior=JSON.parse(r.sync);const state={...prior,error:e instanceof Error?e.message:'구글 연동 결과를 확인하지 못했습니다.',uncertain:true};await db().prepare('UPDATE receipts SET sync=? WHERE owner=? AND id=?').bind(JSON.stringify(state),u,id).run();return state;}
}
export async function POST(req:Request){try{
 sameOrigin(req);const u=await owner();if(Number(req.headers.get('content-length')||0)>8500000)throw new Error('사진이 너무 큽니다.');const raw=await req.text();if(raw.length>8500000)throw new Error('사진이 너무 큽니다.');const b=JSON.parse(raw);
 if(b.action==='company'){const name=String(b.name||'').trim();if(!name||name.length>60||/[\/\\\n\r]/.test(name))throw new Error('법인명은 1~60자로 입력하세요.');const color=Number(b.color);if(![9,10,3,6,11,5,7,8,1,2,4].includes(color))throw new Error('색상을 선택하세요.');try{await db().prepare('INSERT INTO companies (id,owner,name,color,created) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),u,name,color,new Date().toISOString()).run();}catch{throw new Error('동일한 법인이 있거나 저장에 실패했습니다.');}return reply({ok:true});}
 if(b.action==='connect'){const url=String(b.url||'').trim(),secret=String(b.secret||'');if(secret.length<32||secret.length>200)throw new Error('32자 이상의 연결 키를 입력하세요.');const c={url,secret,recipient:''};const result=await bridge(c,{action:'health'});if(!result.recipient)throw new Error('구글 프로그램의 수신 이메일을 먼저 설정하세요.');await db().prepare('INSERT INTO settings (owner,url,secret,recipient) VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET url=excluded.url,secret=excluded.secret,recipient=excluded.recipient').bind(u,url,secret,result.recipient).run();return reply({ok:true,recipient:result.recipient});}
 if(b.action==='disconnect'){await db().prepare('DELETE FROM settings WHERE owner=?').bind(u).run();return reply({ok:true});}
 if(b.action==='ocr'){imageBytes(b);const c=await connection(u);if(!c)throw new Error('구글 연결 후 자동 인식을 사용할 수 있습니다. 지금은 내용을 직접 입력해 주세요.');const result=await bridge(c,{action:'ocr',image:b.image,mime:b.mime});return reply(parseReceipt(String(result.text||'')));}
 if(b.action==='sync'){if(typeof b.id!=='string')throw new Error('기록 ID가 필요합니다.');return reply(await sync(u,b.id));}
 if(b.action==='save'){
  if(!/^[a-f0-9-]{36}$/.test(b.id)||!validDate(b.date)||!Number.isFinite(b.amount)||b.amount<=0||b.amount>100000000000||!['KRW','USD','JPY','EUR','CNY'].includes(b.currency))throw new Error('날짜, 금액, 통화를 확인해 주세요.');
  const place=String(b.place||'').trim(),note=String(b.note||'').trim();if(!place||place.length>150||note.length>1000)throw new Error('장소는 1~150자, 메모는 1,000자 이내로 입력하세요.');
  const company=await db().prepare('SELECT id FROM companies WHERE owner=? AND id=?').bind(u,b.companyId).first();if(!company)throw new Error('법인을 선택하세요.');
  const bytes=imageBytes(b);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const duplicate=await db().prepare('SELECT id FROM receipts WHERE owner=? AND (hash=? OR id=?)').bind(u,hash,b.id).first<{id:string}>();if(duplicate)return reply({ok:true,id:duplicate.id,duplicate:true});
  const key=u+'/'+b.companyId+'/'+b.date.slice(0,7)+'/'+b.id+(b.mime==='image/png'?'.png':'.jpg');
  await bucket().put(key,bytes,{httpMetadata:{contentType:b.mime}});
  try{await db().prepare('INSERT INTO receipts (id,owner,company_id,date,amount,currency,place,note,image_key,mime,hash,sync,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(b.id,u,b.companyId,b.date,b.amount,b.currency,place,note,key,b.mime,hash,JSON.stringify({drive:'pending',mail:'pending',calendar:'pending'}),new Date().toISOString()).run();}catch(e){const saved=await db().prepare('SELECT id FROM receipts WHERE owner=? AND hash=?').bind(u,hash).first<{id:string}>();if(saved)return reply({ok:true,id:saved.id,duplicate:true});throw e;}
  return reply({ok:true,id:b.id});
 }
 throw new Error('지원하지 않는 요청입니다.');
}catch(e){return fail(e)}}
