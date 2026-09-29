const test = require("node:test");
const assert = require("node:assert/strict");
const { DISCOVERY } = require("../../../packages/shared/src");
const { parseAnnouncement } = require("../src/services/discovery-client");

test("교사 탐색 신호의 발신 IP로 서버 주소를 만든다", () => {
  const message = Buffer.from(JSON.stringify({
    magic: DISCOVERY.MAGIC,
    version: DISCOVERY.VERSION,
    port: 3001,
    hostname: "TEACHER-PC"
  }));
  assert.deepEqual(parseAnnouncement(message, "192.168.0.24"), {
    serverUrl: "http://192.168.0.24:3001",
    hostname: "TEACHER-PC"
  });
});

test("다른 프로그램의 UDP 메시지와 잘못된 포트는 무시한다", () => {
  assert.equal(parseAnnouncement(Buffer.from('{"magic":"OTHER","port":3001}'), "192.168.0.24"), null);
  const invalidPort = Buffer.from(JSON.stringify({
    magic: DISCOVERY.MAGIC,
    version: DISCOVERY.VERSION,
    port: 70000
  }));
  assert.equal(parseAnnouncement(invalidPort, "192.168.0.24"), null);
});
