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

module.exports = { EVENTS, ROLES };
