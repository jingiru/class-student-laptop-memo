const statusElement = document.querySelector("#server-status");
const countElement = document.querySelector("#online-count");
const emptyElement = document.querySelector("#empty-state");
const gridElement = document.querySelector("#student-grid");

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
    return card;
  }));
}

socket.on("connect", () => setServerStatus("online", "서버 정상"));
socket.on("disconnect", () => setServerStatus("offline", "서버 연결 끊김"));
socket.on("connect_error", () => setServerStatus("offline", "서버 연결 실패"));
socket.on("presence:snapshot", render);
socket.on("presence:changed", render);
