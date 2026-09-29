class StreamingClient {
  constructor(api, onStateChange) {
    this.api = api;
    this.onStateChange = onStateChange;
    this.peer = null;
    this.stream = null;
    this.teacherSocketId = null;
    this.pendingCandidates = [];
    this.annotationChannel = null;

    api.onStreamRequest((payload) => this.start(payload.teacherSocketId));
    api.onSignal((payload) => this.handleSignal(payload));
    api.onStreamStop(() => this.stop(false));
  }

  async start(teacherSocketId) {
    this.stop(false);
    this.teacherSocketId = teacherSocketId;
    this.pendingCandidates = [];
    this.onStateChange(true, "화면 캡처를 준비하고 있습니다.");
    this.reportStatus("capturing", "학생 화면 캡처 준비 중…");
    try {
      const source = await this.api.getCaptureSource();
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: source.id,
            maxFrameRate: 15
          }
        },
        audio: false
      });
      this.onStateChange(true, "교사가 화면을 확인하고 있습니다.");
      this.reportStatus("captured", "화면 캡처 완료 · WebRTC 연결 중…");
      this.peer = new RTCPeerConnection({ iceServers: [] });
      this.annotationChannel = this.peer.createDataChannel("classroom-annotations", { ordered: true });
      this.annotationChannel.onmessage = ({ data }) => {
        try {
          const command = JSON.parse(data);
          if (command.type === "clear") this.api.clearAnnotations();
          else this.api.renderAnnotation(command);
        } catch (error) {
          console.error("주석 데이터 처리 실패", error);
        }
      };
      this.annotationChannel.onclose = () => this.api.clearAnnotations();
      this.stream.getTracks().forEach((track) => this.peer.addTrack(track, this.stream));
      this.stream.getVideoTracks()[0].addEventListener("ended", () => this.stop(true), { once: true });
      this.peer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.api.sendSignal({
            targetSocketId: this.teacherSocketId,
            candidate: candidate.toJSON()
          });
        }
      };
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      this.api.sendSignal({
        targetSocketId: teacherSocketId,
        description: {
          type: this.peer.localDescription.type,
          sdp: this.peer.localDescription.sdp
        }
      });
      this.reportStatus("offered", "화면 전송 연결 협상 중…");
    } catch (error) {
      console.error("화면 공유 시작 실패", error);
      const detail = error?.message || "알 수 없는 오류";
      this.reportStatus("error", `학생 화면 캡처 실패: ${detail}`);
      this.api.notifyStreamEnded(teacherSocketId);
      this.stop(false);
      this.onStateChange(false, `화면 공유 실패: ${detail}`);
    }
  }

  reportStatus(state, message) {
    if (!this.teacherSocketId) return;
    this.api.notifyStreamStatus({ teacherSocketId: this.teacherSocketId, state, message });
  }

  async handleSignal({ fromSocketId, description, candidate }) {
    if (!this.peer || fromSocketId !== this.teacherSocketId) return;
    try {
      if (description?.type === "answer") {
        await this.peer.setRemoteDescription(description);
        for (const queuedCandidate of this.pendingCandidates.splice(0)) {
          await this.peer.addIceCandidate(queuedCandidate);
        }
      }
      if (candidate) {
        if (this.peer.remoteDescription) await this.peer.addIceCandidate(candidate);
        else this.pendingCandidates.push(candidate);
      }
    } catch (error) {
      console.error("WebRTC signaling 실패", error);
    }
  }

  stop(notifyTeacher) {
    const teacherSocketId = this.teacherSocketId;
    this.peer?.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.annotationChannel?.close();
    this.api.clearAnnotations();
    this.peer = null;
    this.stream = null;
    this.annotationChannel = null;
    this.teacherSocketId = null;
    this.pendingCandidates = [];
    this.onStateChange(false, "");
    if (notifyTeacher && teacherSocketId) this.api.notifyStreamEnded(teacherSocketId);
  }
}

window.StreamingClient = StreamingClient;
