# Classroom Guide MVP

교사 Windows 노트북을 로컬 서버로 사용하고, 학생 Electron 앱의 온라인 상태를 교사 화면에서 실시간으로 확인하는 1단계 구현입니다.

## 구성

- `apps/teacher-server`: Node.js + Socket.IO 로컬 서버와 학생 presence 관리
- `apps/teacher-web`: 브라우저에서 여는 교사용 접속 현황 화면
- `apps/student-electron`: 학생용 Windows Electron 클라이언트
- `packages/shared`: 양쪽에서 공유하는 이벤트 이름과 역할 정의

화면 스트리밍은 추후 학생 앱의 별도 `streaming` 서비스와 교사 화면의 뷰어 영역으로, 투명 오버레이는 Electron의 별도 overlay window/service로 추가할 수 있습니다. 현재 presence 모듈과 직접 얽히지 않도록 분리했습니다.

## 준비

Node.js 20 이상이 필요합니다. 프로젝트 폴더에서 한 번만 실행합니다.

```powershell
npm install
```

## 실행

### 1. 교사 노트북

```powershell
npm run start:teacher
```

터미널에 표시되는 `학생 서버 주소`를 학생에게 알려 주세요. 교사 화면은 브라우저에서 `http://localhost:3001`을 열면 됩니다.

Windows 방화벽이 묻는 경우 학교/개인 네트워크에서 Node.js의 통신을 허용해야 학생 노트북이 접속할 수 있습니다.

### 2. 학생 노트북

같은 프로젝트를 준비한 뒤 실행합니다.

```powershell
npm run start:student
```

교사가 알려준 주소(예: `http://192.168.0.10:3001`)와 학생 이름을 입력하고 **연결하기**를 누릅니다.

## 확인

```powershell
npm test
npm run check
```

자동 테스트는 학생 접속 시 ONLINE 목록 추가, 연결 종료 시 제거, 잘못된 접속 정보 거부를 검증합니다.

## 다음 확장 지점

1. `student-electron/src/services/streaming-client.js`: `desktopCapturer` + WebRTC 송출
2. `teacher-server`: offer/answer/ICE signaling 이벤트 중계(영상 자체는 중계하지 않음)
3. `teacher-web`: 선택 학생의 `RTCPeerConnection`과 영상 뷰어
4. `student-electron`: click-through 투명 BrowserWindow와 annotation DataChannel
5. 수업 코드 또는 사전 공유 토큰을 이용한 LAN 접속 인증
