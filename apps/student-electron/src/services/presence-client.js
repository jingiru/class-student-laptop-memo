const { io } = require("socket.io-client");
const { EVENTS, ROLES } = require("@classroom-guide/shared");

class PresenceClient {
  constructor(onStateChange) {
    this.socket = null;
    this.onStateChange = onStateChange;
  }

  connect(serverUrl, profile) {
    this.disconnect();
    this.onStateChange({ state: "connecting", message: "교사 서버에 연결 중…" });
    this.socket = io(serverUrl, {
      auth: { role: ROLES.STUDENT },
      reconnection: true,
      reconnectionDelay: 1000,
      timeout: 5000
    });
    this.socket.on("connect", () => {
      this.socket.emit(EVENTS.STUDENT_JOIN, profile, (result) => {
        if (result?.ok) this.onStateChange({ state: "online", message: "수업에 연결되었습니다." });
        else this.onStateChange({ state: "error", message: result?.message || "접속 정보를 확인해 주세요." });
      });
    });
    this.socket.on("disconnect", () => {
      this.onStateChange({ state: "offline", message: "연결이 끊겼습니다. 자동으로 다시 연결합니다." });
    });
    this.socket.on("connect_error", () => {
      this.onStateChange({ state: "error", message: "교사 서버를 찾을 수 없습니다." });
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

module.exports = { PresenceClient };
