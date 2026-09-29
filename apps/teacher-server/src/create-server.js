const http = require("node:http");
const path = require("node:path");
const express = require("express");
const { Server } = require("socket.io");
const { EVENTS, ROLES } = require("@classroom-guide/shared");
const { PresenceStore } = require("./presence-store");

function normalizeStudentProfile(input) {
  const profile = input && typeof input === "object" ? input : {};
  const name = String(profile.name || "").trim().slice(0, 40);
  const studentId = String(profile.studentId || "").trim().slice(0, 80);
  if (!name || !studentId) return null;
  return {
    name,
    studentId,
    hostname: String(profile.hostname || "").trim().slice(0, 80),
    platform: String(profile.platform || "win32").trim().slice(0, 30)
  };
}

function createClassroomServer({ webRoot, logger = console } = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { serveClient: true });
  const presence = new PresenceStore();
  const teacherRoom = "role:teacher";

  app.disable("x-powered-by");
  app.get("/health", (_req, res) => {
    res.json({ ok: true, studentsOnline: presence.list().length });
  });
  app.use(express.static(webRoot || path.resolve(__dirname, "../../teacher-web")));

  function publishPresence() {
    io.to(teacherRoom).emit(EVENTS.PRESENCE_CHANGED, presence.list());
  }

  io.on("connection", (socket) => {
    const role = socket.handshake.auth?.role;
    if (role === ROLES.TEACHER) {
      socket.join(teacherRoom);
      socket.emit(EVENTS.PRESENCE_SNAPSHOT, presence.list());
      return;
    }

    socket.on(EVENTS.STUDENT_JOIN, (rawProfile, acknowledge) => {
      const profile = normalizeStudentProfile(rawProfile);
      if (!profile) {
        acknowledge?.({ ok: false, message: "학생 이름과 기기 ID가 필요합니다." });
        return;
      }
      presence.join(socket.id, profile);
      socket.data.role = ROLES.STUDENT;
      acknowledge?.({ ok: true });
      publishPresence();
      logger.info?.(`[student online] ${profile.name} (${profile.hostname || profile.studentId})`);
    });

    socket.on("disconnect", () => {
      const student = presence.leave(socket.id);
      if (student) {
        publishPresence();
        logger.info?.(`[student offline] ${student.name}`);
      }
    });
  });

  return { app, httpServer, io, presence };
}

module.exports = { createClassroomServer, normalizeStudentProfile };
