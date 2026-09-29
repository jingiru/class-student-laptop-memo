const { app, BrowserWindow, desktopCapturer, ipcMain, screen } = require("electron");
const path = require("node:path");
const os = require("node:os");
const { PresenceClient } = require("./services/presence-client");

let mainWindow;
let overlayWindow;
let presenceClient;

function createOverlayWindow() {
  const bounds = screen.getPrimaryDisplay().bounds;
  overlayWindow = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    show: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "overlay-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.loadFile(path.join(__dirname, "../overlay/index.html"));
  overlayWindow.on("closed", () => { overlayWindow = null; });
}

function updateOverlayBounds() {
  overlayWindow?.setBounds(screen.getPrimaryDisplay().bounds);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 650,
    minWidth: 440,
    minHeight: 560,
    backgroundColor: "#f4f7fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  presenceClient = new PresenceClient(
    (status) => mainWindow?.webContents.send("presence:status", status),
    (type, payload) => mainWindow?.webContents.send(`stream:${type}`, payload)
  );
}

ipcMain.handle("device:info", () => ({ hostname: os.hostname(), platform: process.platform }));
ipcMain.handle("presence:connect", (_event, { serverUrl, name }) => {
  const normalizedUrl = String(serverUrl || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\/[^\s]+$/i.test(normalizedUrl)) {
    return { ok: false, message: "http://로 시작하는 올바른 서버 주소를 입력해 주세요." };
  }
  const trimmedName = String(name || "").trim();
  if (!trimmedName) return { ok: false, message: "학생 이름을 입력해 주세요." };
  const profile = { studentId: os.hostname(), name: trimmedName, hostname: os.hostname(), platform: process.platform };
  presenceClient.connect(normalizedUrl, profile);
  return { ok: true };
});
ipcMain.handle("presence:disconnect", () => presenceClient.disconnect());
ipcMain.handle("capture:get-source", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 0, height: 0 }
  });
  if (!sources.length) throw new Error("캡처할 화면을 찾을 수 없습니다.");
  return { id: sources[0].id, name: sources[0].name };
});
ipcMain.on("webrtc:signal", (_event, payload) => presenceClient.sendSignal(payload));
ipcMain.on("stream:ended", (_event, teacherSocketId) => presenceClient.notifyStreamEnded(teacherSocketId));
ipcMain.on("stream:status", (_event, payload) => presenceClient.notifyStreamStatus(payload));
ipcMain.on("overlay:draw", (_event, command) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.showInactive();
  overlayWindow.webContents.send("overlay:draw", command);
});
ipcMain.on("overlay:clear", () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.webContents.send("overlay:clear");
  overlayWindow.hide();
});

app.whenReady().then(() => {
  createOverlayWindow();
  createWindow();
  screen.on("display-metrics-changed", updateOverlayBounds);
  screen.on("display-added", updateOverlayBounds);
  screen.on("display-removed", updateOverlayBounds);
});
app.on("window-all-closed", () => {
  presenceClient?.disconnect();
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
