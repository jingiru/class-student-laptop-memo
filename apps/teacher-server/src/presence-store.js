class PresenceStore {
  constructor(clock = () => new Date()) {
    this.clock = clock;
    this.bySocketId = new Map();
  }

  join(socketId, profile) {
    const student = {
      socketId,
      studentId: String(profile.studentId || "").trim(),
      name: String(profile.name || "").trim(),
      hostname: String(profile.hostname || "").trim(),
      platform: String(profile.platform || "win32"),
      connectedAt: this.clock().toISOString()
    };
    this.bySocketId.set(socketId, student);
    return student;
  }

  leave(socketId) {
    const student = this.bySocketId.get(socketId) || null;
    this.bySocketId.delete(socketId);
    return student;
  }

  list() {
    return [...this.bySocketId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "ko")
    );
  }
}

module.exports = { PresenceStore };
