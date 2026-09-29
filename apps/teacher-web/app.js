const statusElement = document.querySelector("#server-status");
const countElement = document.querySelector("#online-count");
const emptyElement = document.querySelector("#empty-state");
const gridElement = document.querySelector("#student-grid");
const viewerElement = document.querySelector("#viewer");
const videoElement = document.querySelector("#student-video");
const viewerTitle = document.querySelector("#viewer-title");
const viewerStatus = document.querySelector("#viewer-status");
const annotationController = new window.AnnotationController({
  canvas: document.querySelector("#annotation-canvas"),
  video: videoElement,
  toolbar: document.querySelector("#annotation-toolbar"),
  status: document.querySelector("#annotation-status")
});
let activeStudent = null;
let peer = null;
let pendingCandidates = [];

const socket = io({ auth: { role: "teacher" } });

function setServerStatus(state, label) {
  statusElement.className = `status ${state}`;
  statusElement.textContent = label;
}

function render(students = []) {
  countElement.textContent = `${students.length}명`;
  emptyElement.hidden = students.length > 0;
  gridElement.hidden = students.length === 0;
  gridElement.replaceChildren(...students.map((student) => {
    const card = document.createElement("article");
    card.className = "student-card";
    const time = new Date(student.connectedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    card.innerHTML = `
      <div class="card-top"><span class="student-name"></span><span class="online-dot" aria-label="온라인"></span></div>
      <p class="device"></p><p class="connected">${time}부터 접속</p>`;
    card.querySelector(".student-name").textContent = student.name;
    card.querySelector(".device").textContent = student.hostname || student.studentId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "watch-button";
    button.textContent = "화면 보기";
    button.addEventListener("click", () => startViewing(student));
    card.append(button);
    return card;
  }));
}

socket.on("connect", () => setServerStatus("online", "서버 정상"));
socket.on("disconnect", () => setServerStatus("offline", "서버 연결 끊김"));
socket.on("connect_error", () => setServerStatus("offline", "서버 연결 실패"));
socket.on("presence:snapshot", render);
socket.on("presence:changed", render);

function startViewing(student) {
  stopViewing();
  activeStudent = student;
  pendingCandidates = [];
  viewerElement.hidden = false;
  viewerTitle.textContent = `${student.name} 화면`;
  viewerStatus.textContent = "화면 연결 요청 중…";
  annotationController.detach();
  peer = new RTCPeerConnection({ iceServers: [] });
  peer.ondatachannel = ({ channel }) => {
    if (channel.label === "classroom-annotations") annotationController.setChannel(channel);
  };
  peer.ontrack = ({ streams }) => {
    videoElement.srcObject = streams[0];
    viewerStatus.textContent = "실시간 연결됨";
    viewerElement.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  peer.onicecandidate = ({ candidate }) => {
    if (candidate && activeStudent) {
      socket.emit("webrtc:signal", {
        targetSocketId: activeStudent.socketId,
        candidate: candidate.toJSON()
      });
    }
  };
  peer.onconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(peer?.connectionState)) viewerStatus.textContent = "화면 연결이 끊겼습니다.";
  };
  socket.emit("stream:request", { studentSocketId: student.socketId }, (result) => {
    if (!result?.ok) {
      viewerStatus.textContent = result?.message || "화면 연결에 실패했습니다.";
      peer?.close();
      peer = null;
    }
  });
}

async function handleSignal({ fromSocketId, description, candidate }) {
  if (!peer || fromSocketId !== activeStudent?.socketId) return;
  try {
    if (description?.type === "offer") {
      await peer.setRemoteDescription(description);
      for (const queuedCandidate of pendingCandidates.splice(0)) await peer.addIceCandidate(queuedCandidate);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("webrtc:signal", {
        targetSocketId: fromSocketId,
        description: {
          type: peer.localDescription.type,
          sdp: peer.localDescription.sdp
        }
      });
    }
    if (candidate) {
      if (peer.remoteDescription) await peer.addIceCandidate(candidate);
      else pendingCandidates.push(candidate);
    }
  } catch (error) {
    console.error("WebRTC signaling 실패", error);
    viewerStatus.textContent = `WebRTC 오류: ${error?.message || "연결 처리 실패"}`;
  }
}

function stopViewing(notifyStudent = true) {
  if (notifyStudent && activeStudent) socket.emit("stream:stop", { studentSocketId: activeStudent.socketId });
  annotationController.detach();
  peer?.close();
  peer = null;
  pendingCandidates = [];
  videoElement.srcObject = null;
  activeStudent = null;
  viewerElement.hidden = true;
}

socket.on("webrtc:signal", handleSignal);
socket.on("stream:status", ({ studentSocketId, message }) => {
  const hasError = viewerStatus.textContent.includes("오류") || viewerStatus.textContent.includes("실패");
  if (!hasError && studentSocketId === activeStudent?.socketId && message) viewerStatus.textContent = message;
});
socket.on("stream:ended", () => {
  if (!activeStudent) return;
  if (!viewerStatus.textContent.includes("실패")) viewerStatus.textContent = "학생의 화면 공유가 종료되었습니다.";
  peer?.close();
  peer = null;
  videoElement.srcObject = null;
  annotationController.detach();
});
document.querySelector("#close-viewer").addEventListener("click", () => stopViewing());
window.addEventListener("beforeunload", () => stopViewing());
