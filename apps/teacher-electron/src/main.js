const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");
const { createClassroomServer } = require("../../teacher-server/src/create-server");
const { createDiscoveryBroadcaster } = require("../../teacher-server/src/discovery-broadcaster");

const port = 3001;
let mainWindow;
let httpServer;
let discovery;

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    title: "Classroom Guide · 교사",
    backgroundColor: "#f4f7fb",
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://localhost:${port}`);
}

function startTeacher() {
  const created = createClassroomServer({ webRoot: path.resolve(__dirname, "../../teacher-web") });
  httpServer = created.httpServer;
  discovery = createDiscoveryBroadcaster({ servicePort: port });
  httpServer.once("error", (error) => {
    const message = error.code === "EADDRINUSE"
      ? "이미 교사 프로그램이 실행 중이거나 3001번 포트를 사용하고 있습니다."
      : error.message;
    dialog.showErrorBox("교사 프로그램을 시작할 수 없습니다", message);
    app.quit();
  });
  httpServer.listen(port, "0.0.0.0", () => {
    discovery.start();
    createWindow();
  });
}

app.whenReady().then(startTeacher);
app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  discovery?.stop();
  httpServer?.close();
});
