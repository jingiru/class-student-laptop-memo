const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("classroom", {
  getDeviceInfo: () => ipcRenderer.invoke("device:info"),
  connect: (settings) => ipcRenderer.invoke("presence:connect", settings),
  disconnect: () => ipcRenderer.invoke("presence:disconnect"),
  getCaptureSource: () => ipcRenderer.invoke("capture:get-source"),
  sendSignal: (payload) => ipcRenderer.send("webrtc:signal", payload),
  notifyStreamEnded: (teacherSocketId) => ipcRenderer.send("stream:ended", teacherSocketId),
  notifyStreamStatus: (payload) => ipcRenderer.send("stream:status", payload),
  onStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("presence:status", handler);
    return () => ipcRenderer.removeListener("presence:status", handler);
  },
  onStreamRequest: (callback) => subscribe("stream:request", callback),
  onSignal: (callback) => subscribe("stream:signal", callback),
  onStreamStop: (callback) => subscribe("stream:stop", callback)
});

function subscribe(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
