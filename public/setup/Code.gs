/* 한끼장부 Google 연결 v1.0 — 본인 계정에 설치하세요.
 * Script properties: RECEIPT_SECRET (32+ chars), RECEIPT_EMAIL.
 * Optional: RECEIPT_CALENDAR_ID (default primary).
 * Enable advanced services: Drive API v3, Calendar API v3.
 */
function setup() {
  const p = PropertiesService.getScriptProperties();
  if ((p.getProperty('RECEIPT_SECRET') || '').length < 32) throw new Error('RECEIPT_SECRET을 32자 이상으로 설정하세요.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.getProperty('RECEIPT_EMAIL') || '')) throw new Error('RECEIPT_EMAIL을 설정하세요.');
  root_();
  Calendar.CalendarList.get(p.getProperty('RECEIPT_CALENDAR_ID') || 'primary');
  MailApp.getRemainingDailyQuota();
  DocumentApp.getActiveDocument();
  console.log('설정 완료. 이제 웹 앱으로 배포하세요.');
}
function doGet(){return json_({ok:true,service:'한끼장부 연결',version:1});}
function doPost(e) {
  try {
    const p=PropertiesService.getScriptProperties();
    const b=JSON.parse(e.postData.contents);
    const secret=p.getProperty('RECEIPT_SECRET');
    if(!secret || secret.length<32 || b.secret!==secret) throw new Error('연결 키가 일치하지 않습니다.');
    if(b.action==='health') return json_({ok:true,recipient:p.getProperty('RECEIPT_EMAIL'),version:1});
    if(b.action==='ocr') {
      const blob=blob_(b);
      let doc;
      try {
        doc=Drive.Files.create({name:'한끼장부 임시 인식',mimeType:'application/vnd.google-apps.document',parents:[root_().getId()]},blob,{ocrLanguage:'ko',fields:'id'});
        const text=DocumentApp.openById(doc.id).getBody().getText();
        return json_({ok:true,text:text.slice(0,30000)});
      } finally {if(doc) DriveApp.getFileById(doc.id).setTrashed(true);}
    }
    if(b.action==='sync') return json_(sync_(b));
    throw new Error('지원하지 않는 요청입니다.');
  }catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function blob_(b){
  if(typeof b.image!=='string'||b.image.length>8000000||!['image/jpeg','image/png'].includes(b.mime)) throw new Error('JPEG 또는 PNG 사진이 필요합니다.');
  return Utilities.newBlob(Utilities.base64Decode(b.image),b.mime,'receipt.'+(b.mime==='image/png'?'png':'jpg'));
}
function root_(){const p=PropertiesService.getScriptProperties();let id=p.getProperty('RECEIPT_ROOT_ID');if(id)return DriveApp.getFolderById(id);const f=DriveApp.createFolder('한끼장부');p.setProperty('RECEIPT_ROOT_ID',f.getId());return f;}
function folder_(parent,name){const it=parent.getFoldersByName(name);return it.hasNext()?it.next():parent.createFolder(name);}
function json_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}
function sync_(b){
  if(!/^[a-f0-9-]{36}$/.test(b.id)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||typeof b.company!=='string'||b.company.length>60||typeof b.place!=='string'||b.place.length>150||!Number.isFinite(b.amount)||b.amount<=0||!['KRW','USD','JPY','EUR','CNY'].includes(b.currency)) throw new Error('기록 정보가 올바르지 않습니다.');
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000)) throw new Error('다른 영수증을 처리 중입니다. 잠시 후 다시 시도하세요.');
  try{
    const root=root_(), ledgers=folder_(root,'_연동상태');
    const items=ledgers.getFilesByName(b.id+'.json');
    let file=items.hasNext()?items.next():ledgers.createFile(b.id+'.json','{}','application/json');
    const s=JSON.parse(file.getBlob().getDataAsString());
    const save=()=>file.setContent(JSON.stringify(s));
    const errors=[];
    let photo;
    try{
      if(s.driveId) photo=DriveApp.getFileById(s.driveId);
      else {
        const f=folder_(folder_(root,b.company.replace(/[\\/]/g,'_')),b.date.slice(0,7));
        const filename=b.date+'_'+b.place.replace(/[\\/]/g,'_')+'_'+b.amount+'_'+b.id+'.'+(b.mime==='image/png'?'png':'jpg');
        const prior=f.getFilesByName(filename);
        photo=prior.hasNext()?prior.next():f.createFile(blob_(b).setName(filename));
        s.driveId=photo.getId();s.driveUrl=photo.getUrl();save();
      }
      s.drive='done';save();
    }catch(e){s.drive='failed';errors.push('Drive: '+e.message);save();}
    const p=PropertiesService.getScriptProperties(), cal=p.getProperty('RECEIPT_CALENDAR_ID')||'primary';
    const title='['+b.company+'] '+b.place+' · '+b.amount.toLocaleString('en-US')+' '+b.currency;
    const description='법인: '+b.company+'\n날짜: '+b.date+'\n장소: '+b.place+'\n금액: '+b.amount+' '+b.currency+'\n메모: '+(b.note||'')+'\n영수증: '+(s.driveUrl||'저장 실패')+'\n기록 ID: '+b.id;
    try{
      const eventId='receipt'+b.id.replace(/-/g,'');
      const end=new Date(b.date+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+1);
      const event={id:eventId,summary:title,description:description,location:b.place,start:{date:b.date},end:{date:end.toISOString().slice(0,10)},colorId:String(b.color||9),extendedProperties:{private:{receiptId:b.id,company:b.company}}};
      let existing;
      try {existing=Calendar.Events.get(cal,eventId);}catch(e){if(!/404|not found/i.test(String(e)))throw e;}
      const result=existing?Calendar.Events.update(event,cal,eventId):Calendar.Events.insert(event,cal,{sendUpdates:'none'});
      s.calendar='done';s.calendarUrl=result.htmlLink;save();
    }catch(e){s.calendar='failed';errors.push('Calendar: '+e.message);save();}
    if(s.mail!=='done'&&s.mail!=='sending'&&s.mail!=='unknown'){
      if(!photo){s.mail='failed';errors.push('메일: 사진 저장 후 다시 시도하세요.');save();}
      else if(MailApp.getRemainingDailyQuota()<1){s.mail='failed';errors.push('메일: 오늘 발송 한도를 초과했습니다.');save();}
      else{
        s.mail='sending';save();
        try{MailApp.sendEmail({to:p.getProperty('RECEIPT_EMAIL'),subject:title,body:description,attachments:[photo.getBlob()],name:'한끼장부'});s.mail='done';save();}
        catch(e){s.mail='unknown';errors.push('메일 결과 확인 필요: 중복 발송 방지를 위해 자동 재발송하지 않습니다.');save();}
      }
    }
    if(s.mail==='sending')s.mail='unknown';
    s.errors=errors;save();return {ok:true,...s};
  }finally{lock.releaseLock();}
}
