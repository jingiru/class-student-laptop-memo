const EVENTS = Object.freeze({
  STUDENT_JOIN: "student:join",
  STUDENT_LEAVE: "student:leave",
  PRESENCE_SNAPSHOT: "presence:snapshot",
  PRESENCE_CHANGED: "presence:changed",
  STREAM_REQUEST: "stream:request",
  STREAM_STOP: "stream:stop",
  STREAM_ENDED: "stream:ended",
  STREAM_STATUS: "stream:status",
  WEBRTC_SIGNAL: "webrtc:signal",
  CONNECTION_ERROR: "connection:error"
});

const ROLES = Object.freeze({
  TEACHER: "teacher",
  STUDENT: "student"
});

const DISCOVERY = Object.freeze({
  MAGIC: "CLASSROOM_GUIDE_TEACHER",
  VERSION: 1,
  PORT: 41234
});

module.exports = { DISCOVERY, EVENTS, ROLES };
