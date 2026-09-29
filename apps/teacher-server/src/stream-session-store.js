class StreamSessionStore {
  constructor() {
    this.teacherByStudent = new Map();
  }

  start(teacherSocketId, studentSocketId) {
    const currentTeacher = this.teacherByStudent.get(studentSocketId);
    if (currentTeacher && currentTeacher !== teacherSocketId) return false;
    this.teacherByStudent.set(studentSocketId, teacherSocketId);
    return true;
  }

  stop(teacherSocketId, studentSocketId) {
    if (this.teacherByStudent.get(studentSocketId) !== teacherSocketId) return false;
    this.teacherByStudent.delete(studentSocketId);
    return true;
  }

  isPair(firstSocketId, secondSocketId) {
    return this.teacherByStudent.get(firstSocketId) === secondSocketId
      || this.teacherByStudent.get(secondSocketId) === firstSocketId;
  }

  removeSocket(socketId) {
    const peers = [];
    if (this.teacherByStudent.has(socketId)) {
      peers.push(this.teacherByStudent.get(socketId));
      this.teacherByStudent.delete(socketId);
    }
    for (const [studentId, teacherId] of this.teacherByStudent) {
      if (teacherId === socketId) {
        peers.push(studentId);
        this.teacherByStudent.delete(studentId);
      }
    }
    return peers;
  }
}

module.exports = { StreamSessionStore };
