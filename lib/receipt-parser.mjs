export function validDate(v){if(!/^20\d{2}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;}
export function parseReceipt(text){
 const lines=text.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const match=text.match(/(20\d{2})[.\/년\-\s]+(\d{1,2})[.\/월\-\s]+(\d{1,2})/);
 const date=match?`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`:'';
 let amount='';
 for(let i=0;i<lines.length;i++){
  if(!/(총\s*액|합\s*계|결제\s*금액|승인\s*금액|받을\s*금액|grand\s*total|^total\b)/i.test(lines[i])||/소계|subtotal|부가세|과세/.test(lines[i]))continue;
  const candidate=lines[i].replace(/(총\s*액|합\s*계|결제\s*금액|승인\s*금액|받을\s*금액|grand\s*total|total)/ig,'').trim()||lines[i+1]||'';
  const nums=candidate.match(/\d[\d,]*(?:\.\d{1,2})?/g);if(nums?.length)amount=nums[nums.length-1].replaceAll(',','');
 }
 const named=lines.find(l=>/^(상호|가맹점명|매장명)\s*[:：]/.test(l));
 const candidate=lines.slice(0,8).find(l=>/[가-힣A-Za-z]{2}/.test(l)&&l.length<80&&!/영수증|receipt|신용|카드|매출|전표|사업자|등록번호|전화|TEL|주소|대표|고객|승인|합계|부가|과세|\d{2,}/i.test(l));
 const place=named?named.replace(/^(상호|가맹점명|매장명)\s*[:：]\s*/,''):(candidate||'');
 const currency=/\bUSD\b|\$/.test(text)?'USD':/\bJPY\b|円/.test(text)?'JPY':/\bEUR\b|€/.test(text)?'EUR':'KRW';
 return {date:validDate(date)?date:'',amount,place,currency,text};
}

