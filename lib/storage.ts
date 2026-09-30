import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export function db(){if(!env.DB)throw new Error('기록 저장소에 연결할 수 없습니다. 잠시 후 다시 시도하세요.');return env.DB;}
export function bucket(){if(!env.BUCKET)throw new Error('사진 저장소에 연결할 수 없습니다. 잠시 후 다시 시도하세요.');return env.BUCKET;}
export async function owner(){const u=await getChatGPTUser();if(!u)throw new Error('로그인이 필요합니다.');return u.userId;}
export async function ensureCompanies(user:string){await db().batch(['WEKO','BNM','SKEPA','ZIUM'].map((name,i)=>db().prepare('INSERT OR IGNORE INTO companies (id,owner,name,color,created) VALUES (?,?,?,?,?)').bind(user+'-'+name,user,name,[9,10,3,6][i],new Date().toISOString())));}
export type Connection={url:string;secret:string;recipient:string};
export async function connection(user:string){return db().prepare('SELECT url,secret,recipient FROM settings WHERE owner=?').bind(user).first<Connection>();}
export async function bridge(c:Connection,data:Record<string,unknown>){
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(c.url))throw new Error('Google 연결 주소가 올바르지 않습니다.');
 const r=await fetch(c.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,secret:c.secret}),signal:AbortSignal.timeout(90000)});
 if(!r.ok)throw new Error('구글 연결에 실패했습니다. 배포 주소와 접근 설정을 확인하세요.');
 let j;try{j=await r.json() as Record<string,any>;}catch{throw new Error('구글 연결 프로그램을 실행할 수 없습니다. 웹 앱 접근 설정을 확인하세요.');}
 if(!j.ok)throw new Error(String(j.error||'구글 처리에 실패했습니다.').slice(0,500));return j;
}
export function sameOrigin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw new Error('허용되지 않은 요청입니다.');}
export function reply(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
export function fail(e:unknown){const message=e instanceof Error?e.message:'처리 중 오류가 발생했습니다.';return reply({error:message},message==='로그인이 필요합니다.'?401:400);}
