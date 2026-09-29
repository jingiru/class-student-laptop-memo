class AnnotationController {
  constructor({ canvas, video, toolbar, status }) {
    this.canvas = canvas;
    this.video = video;
    this.toolbar = toolbar;
    this.status = status;
    this.context = canvas.getContext("2d");
    this.channel = null;
    this.tool = "pen";
    this.drawing = false;
    this.points = [];
    this.startPoint = null;

    this.textInput = toolbar.querySelector("#annotation-text");
    this.colorInput = toolbar.querySelector("#annotation-color");
    this.toolButtons = [...toolbar.querySelectorAll("[data-tool]")];
    this.controls = [...toolbar.querySelectorAll("button, input")];
    this.controls.forEach((control) => { control.disabled = true; });

    this.toolButtons.forEach((button) => button.addEventListener("click", () => this.selectTool(button.dataset.tool)));
    toolbar.querySelector("#clear-annotations").addEventListener("click", () => this.clear());
    canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
    canvas.addEventListener("pointercancel", () => this.cancelPreview());
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    this.setConnected(false);
  }

  setChannel(channel) {
    this.channel = channel;
    channel.onopen = () => this.setConnected(true);
    channel.onclose = () => this.setConnected(false);
    channel.onerror = () => {
      this.setConnected(false);
      this.status.textContent = "주석 연결 오류";
    };
    if (channel.readyState === "open") this.setConnected(true);
  }

  detach() {
    this.channel = null;
    this.setConnected(false);
    this.cancelPreview();
  }

  setConnected(connected) {
    this.controls.forEach((control) => { control.disabled = !connected; });
    this.status.textContent = connected ? "주석 전송 준비됨" : "주석 연결 대기 중";
    this.canvas.style.pointerEvents = connected ? "auto" : "none";
  }

  selectTool(tool) {
    this.tool = tool;
    this.toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
    if (tool === "text") this.textInput.focus();
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  videoContentRect() {
    const canvasRect = this.canvas.getBoundingClientRect();
    const videoRect = this.video.getBoundingClientRect();
    const element = {
      x: videoRect.left - canvasRect.left,
      y: videoRect.top - canvasRect.top,
      width: videoRect.width,
      height: videoRect.height
    };
    if (!this.video.videoWidth || !this.video.videoHeight) return element;
    const videoRatio = this.video.videoWidth / this.video.videoHeight;
    const elementRatio = element.width / element.height;
    if (elementRatio > videoRatio) {
      const width = element.height * videoRatio;
      return { x: element.x + (element.width - width) / 2, y: element.y, width, height: element.height };
    }
    const height = element.width / videoRatio;
    return { x: element.x, y: element.y + (element.height - height) / 2, width: element.width, height };
  }

  eventPoint(event) {
    const canvasRect = this.canvas.getBoundingClientRect();
    const videoRect = this.videoContentRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;
    if (x < videoRect.x || y < videoRect.y || x > videoRect.x + videoRect.width || y > videoRect.y + videoRect.height) return null;
    return {
      normalized: { x: (x - videoRect.x) / videoRect.width, y: (y - videoRect.y) / videoRect.height },
      local: { x, y }
    };
  }

  pointerDown(event) {
    if (this.channel?.readyState !== "open") return;
    const point = this.eventPoint(event);
    if (!point) return;
    if (this.tool === "text") {
      const text = this.textInput.value.trim();
      if (!text) {
        this.status.textContent = "표시할 글자를 먼저 입력하세요.";
        this.textInput.focus();
        return;
      }
      this.send({ type: "text", point: point.normalized, text, color: this.colorInput.value, size: 28 });
      return;
    }
    this.drawing = true;
    this.canvas.setPointerCapture(event.pointerId);
    this.startPoint = point;
    this.points = [point];
  }

  pointerMove(event) {
    if (!this.drawing) return;
    const point = this.eventPoint(event);
    if (!point) return;
    if (this.tool === "pen") this.points.push(point);
    else this.points = [this.startPoint, point];
    this.drawPreview();
  }

  pointerUp(event) {
    if (!this.drawing) return;
    const point = this.eventPoint(event) || this.points[this.points.length - 1];
    this.drawing = false;
    if (this.tool === "pen" && this.points.length > 1) {
      this.send({ type: "stroke", points: this.points.map((item) => item.normalized), color: this.colorInput.value, width: 5 });
    } else if (this.tool === "arrow" && point) {
      this.send({ type: "arrow", start: this.startPoint.normalized, end: point.normalized, color: this.colorInput.value, width: 5 });
    }
    this.cancelPreview();
  }

  drawPreview() {
    const rect = this.canvas.getBoundingClientRect();
    this.context.clearRect(0, 0, rect.width, rect.height);
    if (this.points.length < 2) return;
    this.context.strokeStyle = this.colorInput.value;
    this.context.lineWidth = 5;
    this.context.lineCap = "round";
    this.context.lineJoin = "round";
    this.context.beginPath();
    this.points.forEach((item, index) => {
      if (index === 0) this.context.moveTo(item.local.x, item.local.y);
      else this.context.lineTo(item.local.x, item.local.y);
    });
    this.context.stroke();
  }

  cancelPreview() {
    this.drawing = false;
    this.points = [];
    this.startPoint = null;
    const rect = this.canvas.getBoundingClientRect();
    this.context.clearRect(0, 0, rect.width, rect.height);
  }

  clear() {
    this.send({ type: "clear" });
    this.cancelPreview();
  }

  send(command) {
    if (this.channel?.readyState !== "open") return;
    this.channel.send(JSON.stringify(command));
    this.status.textContent = command.type === "clear" ? "학생 화면의 표시를 지웠습니다." : "학생 화면에 표시를 보냈습니다.";
  }
}

window.AnnotationController = AnnotationController;
