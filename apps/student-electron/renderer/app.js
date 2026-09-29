const form = document.querySelector("#join-form");
const serverInput = document.querySelector("#server-url");
const nameInput = document.querySelector("#student-name");
const card = document.querySelector("#connection-card");
const title = document.querySelector("#status-title");
const message = document.querySelector("#status-message");

serverInput.value = localStorage.getItem("serverUrl") || "http://localhost:3001";
nameInput.value = localStorage.getItem("studentName") || "";

const labels = { connecting: "연결 중", online: "온라인", offline: "오프라인", error: "연결 실패" };
window.classroom.onStatus((status) => {
  card.className = `connection-card ${status.state}`;
  title.textContent = labels[status.state] || "연결 상태";
  message.textContent = status.message;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = { serverUrl: serverInput.value, name: nameInput.value };
  localStorage.setItem("serverUrl", settings.serverUrl);
  localStorage.setItem("studentName", settings.name);
  const result = await window.classroom.connect(settings);
  if (!result.ok) {
    card.className = "connection-card error";
    title.textContent = "입력 확인";
    message.textContent = result.message;
  }
});

window.classroom.getDeviceInfo().then((device) => {
  document.querySelector("#device-info").textContent = `이 기기: ${device.hostname}`;
});
