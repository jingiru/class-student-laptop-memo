const test = require("node:test");
const assert = require("node:assert/strict");
const { io: createClient } = require("socket.io-client");
const { createClassroomServer } = require("../src/create-server");
const { EVENTS, ROLES } = require("@classroom-guide/shared");

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

test("학생 접속과 종료가 교사에게 실시간으로 전달된다", async (t) => {
  const { httpServer, io } = createClassroomServer({ logger: { info() {} } });
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  const teacher = createClient(url, { auth: { role: ROLES.TEACHER } });
  const student = createClient(url, { auth: { role: ROLES.STUDENT } });
  t.after(() => {
    teacher.disconnect();
    student.disconnect();
    io.close();
    httpServer.close();
  });

  await once(teacher, EVENTS.PRESENCE_SNAPSHOT);
  await once(student, "connect");
  const online = once(teacher, EVENTS.PRESENCE_CHANGED);
  const joined = await new Promise((resolve) => student.emit(EVENTS.STUDENT_JOIN, {
    studentId: "device-01", name: "17번 홍길동", hostname: "STUDENT-01", platform: "win32"
  }, resolve));
  assert.equal(joined.ok, true);
  const onlineStudents = await online;
  assert.equal(onlineStudents.length, 1);
  assert.equal(onlineStudents[0].name, "17번 홍길동");

  const offline = once(teacher, EVENTS.PRESENCE_CHANGED);
  student.disconnect();
  assert.deepEqual(await offline, []);
});

test("학생 이름과 기기 ID가 없으면 등록을 거부한다", async (t) => {
  const { httpServer, io } = createClassroomServer({ logger: { info() {} } });
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const student = createClient(`http://127.0.0.1:${httpServer.address().port}`, { auth: { role: ROLES.STUDENT } });
  t.after(() => { student.disconnect(); io.close(); httpServer.close(); });
  await once(student, "connect");
  const result = await new Promise((resolve) => student.emit(EVENTS.STUDENT_JOIN, {}, resolve));
  assert.equal(result.ok, false);
});

test("교사의 화면 요청과 WebRTC signaling을 해당 학생에게만 중계한다", async (t) => {
  const { httpServer, io } = createClassroomServer({ logger: { info() {} } });
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${httpServer.address().port}`;
  const teacher = createClient(url, { auth: { role: ROLES.TEACHER } });
  const student = createClient(url, { auth: { role: ROLES.STUDENT } });
  t.after(() => { teacher.disconnect(); student.disconnect(); io.close(); httpServer.close(); });
  await Promise.all([once(teacher, "connect"), once(student, "connect")]);
  await new Promise((resolve) => student.emit(EVENTS.STUDENT_JOIN, {
    studentId: "device-02", name: "테스트 학생", hostname: "STUDENT-02"
  }, resolve));

  const requested = once(student, EVENTS.STREAM_REQUEST);
  const requestResult = await new Promise((resolve) => teacher.emit(EVENTS.STREAM_REQUEST, {
    studentSocketId: student.id
  }, resolve));
  assert.equal(requestResult.ok, true);
  assert.equal((await requested).teacherSocketId, teacher.id);

  const relayed = once(teacher, EVENTS.WEBRTC_SIGNAL);
  student.emit(EVENTS.WEBRTC_SIGNAL, {
    targetSocketId: teacher.id,
    description: { type: "offer", sdp: "test-sdp" }
  });
  const signal = await relayed;
  assert.equal(signal.fromSocketId, student.id);
  assert.equal(signal.description.type, "offer");

  const statusRelayed = once(teacher, EVENTS.STREAM_STATUS);
  student.emit(EVENTS.STREAM_STATUS, {
    teacherSocketId: teacher.id,
    state: "captured",
    message: "화면 캡처 완료"
  });
  const status = await statusRelayed;
  assert.equal(status.studentSocketId, student.id);
  assert.equal(status.state, "captured");
});
