const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  onDraw: (callback) => ipcRenderer.on("overlay:draw", (_event, command) => callback(command)),
  onClear: (callback) => ipcRenderer.on("overlay:clear", () => callback())
});
