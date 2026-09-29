const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("classroom", {
  getDeviceInfo: () => ipcRenderer.invoke("device:info"),
  connect: (settings) => ipcRenderer.invoke("presence:connect", settings),
  disconnect: () => ipcRenderer.invoke("presence:disconnect"),
  onStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("presence:status", handler);
    return () => ipcRenderer.removeListener("presence:status", handler);
  }
});
