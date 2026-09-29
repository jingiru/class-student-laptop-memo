const EVENTS = Object.freeze({
  STUDENT_JOIN: "student:join",
  STUDENT_LEAVE: "student:leave",
  PRESENCE_SNAPSHOT: "presence:snapshot",
  PRESENCE_CHANGED: "presence:changed",
  CONNECTION_ERROR: "connection:error"
});

const ROLES = Object.freeze({
  TEACHER: "teacher",
  STUDENT: "student"
});

module.exports = { EVENTS, ROLES };
