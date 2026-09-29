const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const os = require("node:os");
const { PresenceClient } = require("./services/presence-client");

let mainWindow;
let presenceClient;

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
  presenceClient = new PresenceClient((status) => mainWindow?.webContents.send("presence:status", status));
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

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  presenceClient?.disconnect();
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
