const canvas = document.querySelector("#overlay-canvas");
const context = canvas.getContext("2d");
const commands = [];

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  redraw();
}

function point(value) {
  return { x: value.x * innerWidth, y: value.y * innerHeight };
}

function drawArrow(startValue, endValue, color, width) {
  const start = point(startValue);
  const end = point(endValue);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = Math.max(16, width * 4);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
  context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function draw(command) {
  const color = command.color || "#ff3b30";
  const width = Number(command.width || 5);
  if (command.type === "stroke" && command.points?.length) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    command.points.forEach((value, index) => {
      const current = point(value);
      if (index === 0) context.moveTo(current.x, current.y);
      else context.lineTo(current.x, current.y);
    });
    context.stroke();
  } else if (command.type === "arrow") {
    drawArrow(command.start, command.end, color, width);
  } else if (command.type === "text") {
    const location = point(command.point);
    context.font = `700 ${Number(command.size || 28)}px "Malgun Gothic", sans-serif`;
    context.textBaseline = "top";
    context.lineWidth = 5;
    context.strokeStyle = "rgba(255,255,255,.95)";
    context.strokeText(command.text, location.x, location.y);
    context.fillStyle = color;
    context.fillText(command.text, location.x, location.y);
  }
}

function redraw() {
  context.clearRect(0, 0, innerWidth, innerHeight);
  commands.forEach(draw);
}

window.overlay.onDraw((command) => {
  commands.push(command);
  draw(command);
});
window.overlay.onClear(() => {
  commands.length = 0;
  redraw();
});
window.addEventListener("resize", resize);
resize();
