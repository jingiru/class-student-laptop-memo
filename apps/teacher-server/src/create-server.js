const http = require("node:http");
const path = require("node:path");
const express = require("express");
const { Server } = require("socket.io");
const { EVENTS, ROLES } = require("../../../packages/shared/src");
const { PresenceStore } = require("./presence-store");
const { StreamSessionStore } = require("./stream-session-store");

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
  const streamSessions = new StreamSessionStore();
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
      socket.data.role = ROLES.TEACHER;
      socket.join(teacherRoom);
      socket.emit(EVENTS.PRESENCE_SNAPSHOT, presence.list());
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

    socket.on(EVENTS.STREAM_REQUEST, ({ studentSocketId } = {}, acknowledge) => {
      const studentSocket = io.sockets.sockets.get(studentSocketId);
      if (socket.data.role !== ROLES.TEACHER || studentSocket?.data.role !== ROLES.STUDENT) {
        acknowledge?.({ ok: false, message: "접속 중인 학생을 찾을 수 없습니다." });
        return;
      }
      if (!streamSessions.start(socket.id, studentSocketId)) {
        acknowledge?.({ ok: false, message: "다른 교사가 이미 이 화면을 확인 중입니다." });
        return;
      }
      studentSocket.emit(EVENTS.STREAM_REQUEST, { teacherSocketId: socket.id });
      acknowledge?.({ ok: true });
    });

    socket.on(EVENTS.WEBRTC_SIGNAL, ({ targetSocketId, description, candidate } = {}) => {
      if (!targetSocketId || !streamSessions.isPair(socket.id, targetSocketId)) return;
      io.to(targetSocketId).emit(EVENTS.WEBRTC_SIGNAL, {
        fromSocketId: socket.id,
        description,
        candidate
      });
    });

    socket.on(EVENTS.STREAM_STOP, ({ studentSocketId } = {}) => {
      if (!streamSessions.stop(socket.id, studentSocketId)) return;
      io.to(studentSocketId).emit(EVENTS.STREAM_STOP, { teacherSocketId: socket.id });
    });

    socket.on(EVENTS.STREAM_ENDED, ({ teacherSocketId } = {}) => {
      if (!streamSessions.stop(teacherSocketId, socket.id)) return;
      io.to(teacherSocketId).emit(EVENTS.STREAM_ENDED, { studentSocketId: socket.id });
    });

    socket.on(EVENTS.STREAM_STATUS, ({ teacherSocketId, state, message } = {}) => {
      if (!streamSessions.isPair(socket.id, teacherSocketId)) return;
      io.to(teacherSocketId).emit(EVENTS.STREAM_STATUS, {
        studentSocketId: socket.id,
        state: String(state || ""),
        message: String(message || "").slice(0, 160)
      });
    });

    socket.on("disconnect", () => {
      for (const peerSocketId of streamSessions.removeSocket(socket.id)) {
        io.to(peerSocketId).emit(EVENTS.STREAM_ENDED, { disconnectedSocketId: socket.id });
      }
      const student = presence.leave(socket.id);
      if (student) {
        publishPresence();
        logger.info?.(`[student offline] ${student.name}`);
      }
    });
  });

  return { app, httpServer, io, presence, streamSessions };
}

module.exports = { createClassroomServer, normalizeStudentProfile };
