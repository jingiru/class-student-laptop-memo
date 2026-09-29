const dgram = require("node:dgram");
const { DISCOVERY } = require("@classroom-guide/shared");

function parseAnnouncement(message, remoteAddress) {
  try {
    const data = JSON.parse(message.toString("utf8"));
    const port = Number(data.port);
    if (data.magic !== DISCOVERY.MAGIC || data.version !== DISCOVERY.VERSION) return null;
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(remoteAddress)) return null;
    return {
      serverUrl: `http://${remoteAddress}:${port}`,
      hostname: String(data.hostname || "").slice(0, 80)
    };
  } catch {
    return null;
  }
}

class DiscoveryClient {
  constructor(onFound, logger = console) {
    this.onFound = onFound;
    this.logger = logger;
    this.socket = null;
  }

  start() {
    if (this.socket) return;
    this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this.socket.on("message", (message, remote) => {
      const teacher = parseAnnouncement(message, remote.address);
      if (teacher) this.onFound(teacher);
    });
    this.socket.on("error", (error) => this.logger.warn?.(`[discovery] ${error.message}`));
    this.socket.bind(DISCOVERY.PORT, "0.0.0.0");
  }

  stop() {
    try { this.socket?.close(); } catch {}
    this.socket = null;
  }
}

module.exports = { DiscoveryClient, parseAnnouncement };
