# Classroom Guide MVP

교사 Windows 노트북을 로컬 서버로 사용하고, 학생 Electron 앱의 온라인 상태와 화면을 교사 화면에서 실시간으로 확인하는 MVP입니다.

## 구성

- `apps/teacher-server`: Node.js + Socket.IO 로컬 서버와 학생 presence 관리
- `apps/teacher-web`: 브라우저에서 여는 교사용 접속 현황 화면
- `apps/student-electron`: 학생용 Windows Electron 클라이언트
- `packages/shared`: 양쪽에서 공유하는 이벤트 이름과 역할 정의

학생 영상은 서버에 업로드하지 않고 WebRTC로 학생과 교사 사이에 직접 전송됩니다. 서버는 접속 상태와 WebRTC signaling만 중계합니다. 화면 스트리밍은 Presence와 분리되어 있어 투명 오버레이를 별도 창으로 추가할 수 있습니다.

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

교사 화면은 브라우저에서 `http://localhost:3001`을 열면 됩니다. 서버는 UDP 41234 포트로 같은 네트워크에 자신의 주소를 알리므로 학생 앱이 IP를 자동으로 찾습니다.

Windows 방화벽이 묻는 경우 학교/개인 네트워크에서 Node.js의 통신을 허용해야 학생 노트북이 접속할 수 있습니다.

### 2. 학생 노트북

같은 프로젝트를 준비한 뒤 실행합니다.

```powershell
npm run start:student
```

Electron 44가 `Sandboxed processes cannot read ... ALL APPLICATION PACKAGES` 오류로 종료되는 Windows 환경에서는 관리자 권한 PowerShell에서 아래 명령을 한 번 실행합니다.

```powershell
icacls "D:\project_clone\cslm\node_modules\electron\dist" /grant "*S-1-15-2-1:(OI)(CI)(RX)"
```

이는 Chromium 샌드박스를 끄는 대신 Electron 실행 폴더에 Windows 앱 컨테이너의 읽기·실행 권한만 추가합니다. 프로젝트 경로가 다르면 명령의 경로도 실제 위치에 맞게 바꿉니다.

최초 실행 때 노트북 번호(예: `17`)를 입력하고 **저장하고 연결하기**를 누릅니다. 이후에는 번호가 저장되며, 학생 앱을 실행하면 교사 서버를 자동으로 발견해 연결합니다. 교사 노트북의 IP가 바뀌어도 새 탐색 신호의 실제 발신 주소를 사용합니다.

학교 Wi-Fi가 UDP broadcast를 차단하는 경우에는 기존처럼 교사 서버 주소를 직접 입력할 수 있습니다. Windows 방화벽이 네트워크 통신 허용을 요청하면 학교/개인 네트워크를 허용해야 자동 탐색과 접속이 가능합니다.

교사 화면의 학생 카드에서 **화면 보기**를 누르면 해당 학생의 전체 화면이 나타납니다. 같은 노트북에서 시험할 때는 학생 서버 주소로 `http://localhost:3001`을 사용합니다.

화면이 연결되면 영상 위 도구 모음에서 다음 주석을 학생 화면에 보낼 수 있습니다.

- **펜**: 화면 위를 드래그해 자유롭게 표시
- **화살표**: 시작점에서 끝점까지 드래그
- **텍스트**: 문구를 입력한 다음 표시할 위치를 클릭
- **모두 지우기**: 학생 화면에 남아 있는 모든 표시 제거

주석은 WebRTC DataChannel로 직접 전송되며, 학생 화면에는 마우스 클릭을 방해하지 않는 투명 오버레이로 나타납니다. 화면 보기를 닫거나 연결이 종료되면 주석도 자동으로 제거됩니다.

## 확인

```powershell
npm test
npm run check
```

자동 테스트는 학생 접속 시 ONLINE 목록 추가, 연결 종료 시 제거, 잘못된 접속 정보 거부, 화면 요청 및 WebRTC signaling 중계를 검증합니다.

## 다음 확장 지점

1. 수업 코드 또는 사전 공유 토큰을 이용한 LAN 접속 인증
2. 여러 화면이 연결된 학생 기기의 화면 선택
3. Windows 설치 파일 패키징과 자동 업데이트
