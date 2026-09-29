const dgram = require("node:dgram");
const os = require("node:os");
const { DISCOVERY } = require("../../../packages/shared/src");

function directedBroadcasts() {
  const addresses = new Set(["127.0.0.1", "255.255.255.255"]);
  for (const network of Object.values(os.networkInterfaces()).flat()) {
    if (!network || network.family !== "IPv4" || network.internal || !network.netmask) continue;
    const ip = network.address.split(".").map(Number);
    const mask = network.netmask.split(".").map(Number);
    addresses.add(ip.map((part, index) => (part & mask[index]) | (~mask[index] & 255)).join("."));
  }
  return [...addresses];
}

function createDiscoveryBroadcaster({ servicePort, logger = console, intervalMs = 2000 }) {
  const socket = dgram.createSocket("udp4");
  const message = Buffer.from(JSON.stringify({
    magic: DISCOVERY.MAGIC,
    version: DISCOVERY.VERSION,
    port: servicePort,
    hostname: os.hostname()
  }));
  let timer = null;

  function broadcast() {
    for (const address of directedBroadcasts()) {
      socket.send(message, DISCOVERY.PORT, address, (error) => {
        if (error && error.code !== "EACCES") logger.warn?.(`[discovery] ${error.message}`);
      });
    }
  }

  return {
    start() {
      socket.bind(0, () => {
        socket.setBroadcast(true);
        broadcast();
        timer = setInterval(broadcast, intervalMs);
        timer.unref?.();
        logger.info?.(`[discovery] UDP ${DISCOVERY.PORT} 포트로 교사 서버를 알립니다.`);
      });
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      try { socket.close(); } catch {}
    }
  };
}

module.exports = { createDiscoveryBroadcaster, directedBroadcasts };
