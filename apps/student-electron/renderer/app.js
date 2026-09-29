const form = document.querySelector("#join-form");
const serverInput = document.querySelector("#server-url");
const nameInput = document.querySelector("#student-name");
const card = document.querySelector("#connection-card");
const title = document.querySelector("#status-title");
const message = document.querySelector("#status-message");
const sharingCard = document.querySelector("#sharing-card");
const sharingTitle = document.querySelector("#sharing-title");
const sharingMessage = document.querySelector("#sharing-message");
const discoveryMessage = document.querySelector("#discovery-message");
let activeServerUrl = null;
let connectionState = "idle";

serverInput.value = localStorage.getItem("serverUrl") || "";
nameInput.value = localStorage.getItem("studentNumber") || localStorage.getItem("studentName") || "";

const labels = { connecting: "연결 중", online: "온라인", offline: "오프라인", error: "연결 실패" };
window.classroom.onStatus((status) => {
  connectionState = status.state;
  card.className = `connection-card ${status.state}`;
  title.textContent = labels[status.state] || "연결 상태";
  message.textContent = status.message;
});

async function connectTo(serverUrl, studentNumber) {
  const normalizedUrl = String(serverUrl || "").trim().replace(/\/$/, "");
  const normalizedNumber = String(studentNumber || "").trim();
  if (!normalizedUrl || !normalizedNumber) return false;
  if (activeServerUrl === normalizedUrl && ["connecting", "online", "offline", "error"].includes(connectionState)) return true;
  activeServerUrl = normalizedUrl;
  connectionState = "connecting";
  const result = await window.classroom.connect({ serverUrl: normalizedUrl, name: normalizedNumber });
  if (!result.ok) {
    activeServerUrl = null;
    card.className = "connection-card error";
    title.textContent = "입력 확인";
    message.textContent = result.message;
    return false;
  }
  return true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  localStorage.setItem("serverUrl", serverInput.value.trim());
  localStorage.setItem("studentNumber", nameInput.value.trim());
  localStorage.removeItem("studentName");
  await connectTo(serverInput.value, nameInput.value);
});

window.classroom.onTeacherFound((teacher) => {
  discoveryMessage.textContent = teacher.hostname ? `${teacher.hostname} 발견` : "교사 서버 발견";
  discoveryMessage.classList.add("found");
  serverInput.value = teacher.serverUrl;
  localStorage.setItem("serverUrl", teacher.serverUrl);
  if (nameInput.value.trim()) connectTo(teacher.serverUrl, nameInput.value);
});

window.classroom.getDeviceInfo().then((device) => {
  document.querySelector("#device-info").textContent = `이 기기: ${device.hostname}`;
});

new window.StreamingClient(window.classroom, (isSharing, text) => {
  sharingCard.hidden = !isSharing && !text;
  sharingCard.className = `sharing-card${!isSharing && text ? " error" : ""}`;
  sharingTitle.textContent = isSharing ? "화면 공유 중" : "화면 공유 실패";
  if (text) sharingMessage.textContent = text;
});

if (serverInput.value && nameInput.value.trim()) {
  title.textContent = "자동 연결 중";
  message.textContent = "저장된 설정으로 교사 서버에 연결하고 있습니다.";
  connectTo(serverInput.value, nameInput.value);
}
