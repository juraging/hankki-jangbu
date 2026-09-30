# 한끼장부

아이폰 Safari와 홈 화면에서 사용하는 개인용 법인 영수증 장부입니다.

## 지금 구현된 기능
- WEKO, BNM, SKEPA, ZIUM 기본 등록 및 법인 추가
- 법인 선택, 카메라 촬영 또는 사진 선택, 날짜·금액·장소·메모 확인
- 서버 데이터베이스와 비공개 사진 저장소에 영구 저장
- 동일한 사진의 중복 등록 방지, 법인·월·검색어 필터, CSV 내려받기
- 본인 로그인과 기록 소유권 검사
- 구글 연결 후 Drive OCR, 법인/연월 폴더 저장, 사진 첨부 이메일, 색상과 법인명이 있는 캘린더 종일 일정
- Drive·메일·캘린더별 처리 상태 및 개별 재시도

## 구글 연결
앱의 설정 화면을 따르세요. `public/setup/Code.gs`와 `public/setup/appsscript.json`을 본인 Google Apps Script 프로젝트에 설치합니다.

스크립트 속성:
- RECEIPT_SECRET: 다른 곳에서 사용하지 않는 32자 이상의 임의 연결 키
- RECEIPT_EMAIL: 영수증을 받을 이메일 주소
- RECEIPT_CALENDAR_ID: 선택. 생략하면 기본 캘린더

setup을 실행해 권한을 승인하고 웹 앱으로 배포합니다. 실행 사용자 ‘나’, 액세스 ‘모든 사용자’가 필요하며 각 요청은 연결 키로 인증합니다. Google Workspace 조직 정책이 이 배포를 막으면 관리자 확인이 필요합니다. /exec 주소와 연결 키를 앱 설정에 입력합니다. 연결 키는 서버에서 보관하고 브라우저로 다시 반환하지 않습니다.

## 검증 범위
TypeScript 검사 및 배포용 빌드, 로컬 API의 로그인/소유권/요청 출처 검사, 날짜·금액 검증, 사진 저장/조회, 중복 처리, 미연결 오류 처리를 확인했습니다. Google 측은 모의 서비스로 재시도 시 메일·일정 중복 방지와 발송 결과 불명확 시 재발송하지 않는 처리를 확인했습니다. 실제 Google 계정의 권한 승인과 실제 영수증 OCR/메일/캘린더 통합 검증은 연결 후 필요합니다.

## 운영상 구분
서버 저장이 성공한 후 Google 연동을 별도 수행합니다. 창이 닫히거나 네트워크가 끊기면 기록 보기에서 대기 항목을 다시 연동할 수 있습니다. 앱을 닫은 상태의 백그라운드 재시도는 제공하지 않습니다. 메일은 발송 여부가 불확실할 때 자동 재발송하지 않습니다. 수신함을 먼저 확인해야 합니다.

사진은 최대 2400px JPEG로 변환해 저장합니다. 아이폰에서 읽을 수 없는 HEIC 파일은 카메라로 재촬영하거나 JPEG/PNG로 변환해야 합니다. 인터넷 연결이 필요하며 오프라인 저장은 지원하지 않습니다. 영수증 형식에 따라 인식 정확도가 다르므로 저장 전 확인이 필요합니다. 결제일 기준 최근 최대 2,000건을 표시하며, 서로 다른 통화는 별도 합산합니다.

## 개발
Node 22.13 이상. `npm ci`, `npm run db:generate`, `npm run dev`, `npm run build`를 사용합니다. Sites에서 DB(D1), BUCKET(R2) 논리 바인딩을 배포에 연결합니다. 스키마는 db/schema.ts, 마이그레이션은 drizzle에 있습니다. .openai/hosting.json의 기존 project_id를 유지하세요.

- npm/TypeScript: 표준 설치 후 `node node_modules/typescript/bin/tsc --noEmit`
- Google 연동 모의검사: `node tests/google-bridge.mjs`
- 로컬 통합 검사: 미리보기 데이터베이스 마이그레이션 적용 후 `node tests/core.mjs`. 테스트는 LOCAL TEST 메모의 가상 기록을 생성합니다. 실제 데이터베이스에는 실행하지 마세요.

## 조사 근거
- iOS 카메라 파일 입력: https://webkit.org/blog/7477/new-web-features-in-safari-10-1/
- Google Drive OCR 가져오기: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Apps Script 웹 앱과 실행 권한: https://developers.google.com/apps-script/guides/web
- MailApp 첨부파일 발송: https://developers.google.com/apps-script/reference/mail/mail-app
- Google Calendar 이벤트: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
