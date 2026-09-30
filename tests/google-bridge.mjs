import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const props=new Map([['RECEIPT_SECRET','x'.repeat(40)],['RECEIPT_EMAIL','test@example.test']]);
let mails=0,eventCount=0,throwMail=false;const events=new Map(),files=new Map();let next=1;
function folder(name){const folders=new Map(),children=new Map();return {getId:()=>name,getFoldersByName:n=>iterator(folders.has(n)?[folders.get(n)]:[]),createFolder:n=>{const f=folder(n);folders.set(n,f);return f},getFilesByName:n=>iterator(children.has(n)?[children.get(n)]:[]),createFile:(n,text)=>{if(typeof n==='object'){text='photo';n=n.name;}const id='file'+next++,f={getId:()=>id,getUrl:()=>`https://drive.google.com/file/d/${id}`,getBlob:()=>({getDataAsString:()=>text}),setContent:t=>{text=t;return f;}};children.set(n,f);files.set(id,f);return f}};}
const iterator=a=>({hasNext:()=>a.length>0,next:()=>a.shift()});const root=folder('root');
const context={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},DriveApp:{createFolder:()=>root,getFolderById:()=>root,getFileById:id=>files.get(id)},Utilities:{base64Decode:()=>[],newBlob:()=>({name:'photo',setName(n){this.name=n;return this}})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},Calendar:{Events:{get:(c,id)=>{if(!events.has(id))throw Error('404 Not Found');return events.get(id);},insert:e=>{eventCount++;events.set(e.id,e);return {...e,htmlLink:'https://calendar.google.com'}},update:e=>e}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:()=>{mails++;if(throwMail)throw Error('unknown transport');}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}};
vm.createContext(context);vm.runInContext(fs.readFileSync('public/setup/Code.gs','utf8'),context);
const receipt={id:'00000000-0000-4000-8000-000000000001',date:'2026-09-29',company:'WEKO',place:'테스트 식당',amount:32000,currency:'KRW',mime:'image/jpeg',image:'AA==',color:9};
let result=context.sync_(receipt);assert.equal(result.mail,'done');assert.equal(result.calendar,'done');assert.equal(mails,1);context.sync_(receipt);assert.equal(mails,1);assert.equal(eventCount,1);
throwMail=true;result=context.sync_({...receipt,id:'00000000-0000-4000-8000-000000000002'});assert.equal(result.mail,'unknown');context.sync_({...receipt,id:'00000000-0000-4000-8000-000000000002'});assert.equal(mails,2);
assert.equal(context.doPost({postData:{contents:JSON.stringify({secret:'wrong',action:'sync'})}}).ok,false);
console.log('PASS: Google bridge mocks — unauthorized request denied; retry does not duplicate email/calendar; uncertain email is not resent. Live Google authorization still required.');
