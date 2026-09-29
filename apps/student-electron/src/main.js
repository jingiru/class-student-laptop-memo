const { app, BrowserWindow, desktopCapturer, ipcMain, Menu, nativeImage, screen, Tray } = require("electron");
const path = require("node:path");
const os = require("node:os");
const { PresenceClient } = require("./services/presence-client");
const { DiscoveryClient } = require("./services/discovery-client");

let mainWindow;
let overlayWindow;
let presenceClient;
let discoveryClient;
let lastDiscoveredTeacher = null;
let tray;
let isQuitting = false;
const backgroundLaunch = process.argv.includes("--background");

if (!app.requestSingleInstanceLock()) app.quit();

function createTray() {
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#5369e8"/><path d="M7 10h18v12H7z" fill="white"/><path d="M11 25h10" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>'
  ).toString("base64")}`);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Classroom Guide 학생");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "상태 및 설정 열기", click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: "separator" },
    { label: "종료", click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on("double-click", () => { mainWindow.show(); mainWindow.focus(); });
}

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
    show: !backgroundLaunch,
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
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.webContents.on("did-finish-load", () => {
    if (lastDiscoveredTeacher) mainWindow.webContents.send("discovery:found", lastDiscoveredTeacher);
  });
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
  if (!trimmedName) return { ok: false, message: "노트북 번호를 입력해 주세요." };
  const displayName = /^\d+$/.test(trimmedName) ? `${trimmedName}번 노트북` : trimmedName;
  const profile = { studentId: os.hostname(), name: displayName, hostname: os.hostname(), platform: process.platform };
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
  createTray();
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: ["--background"]
    });
  }
  discoveryClient = new DiscoveryClient((teacher) => {
    lastDiscoveredTeacher = teacher;
    if (!mainWindow?.isDestroyed() && !mainWindow.webContents.isLoading()) {
      mainWindow.webContents.send("discovery:found", teacher);
    }
  });
  discoveryClient.start();
  screen.on("display-metrics-changed", updateOverlayBounds);
  screen.on("display-added", updateOverlayBounds);
  screen.on("display-removed", updateOverlayBounds);
});
app.on("window-all-closed", () => {
  presenceClient?.disconnect();
  discoveryClient?.stop();
});
app.on("before-quit", () => { isQuitting = true; });
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("second-instance", () => {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
});
