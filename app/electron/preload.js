/**
 * preload.js
 * Puente seguro entre el proceso de Node.js (main) y React (renderer).
 * contextIsolation: true → el renderer NO tiene acceso a Node directamente.
 */
const { contextBridge, ipcRenderer } = require("electron");

// Helper para evitar memory leaks: registra UN listener y devuelve cleanup
function on(channel, callback) {
  const handler = (_, ...args) => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Archivos y carpetas ──────────────────────────────────────────────────
  openFiles:    ()           => ipcRenderer.invoke("dialog:openFiles"),
  openFolder:   ()           => ipcRenderer.invoke("dialog:openFolder"),
  readFolder:   (folderPath) => ipcRenderer.invoke("fs:readFolder", folderPath),
  pathToUrl:    (filePath)   => ipcRenderer.invoke("fs:pathToUrl", filePath),

  // ── Listas ───────────────────────────────────────────────────────────────
  saveList:    (data) => ipcRenderer.invoke("list:save", data),
  getAllLists:  ()     => ipcRenderer.invoke("list:getAll"),
  deleteList:  (name) => ipcRenderer.invoke("list:delete", name),

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: ()         => ipcRenderer.invoke("settings:get"),
  setSettings: (settings) => ipcRenderer.invoke("settings:set", settings),

  // ── Segunda pantalla ─────────────────────────────────────────────────────
  openSecondScreen:  () => ipcRenderer.send("open-second-screen"),
  closeSecondScreen: () => ipcRenderer.send("close-second-screen"),

  // ── Relay de mensajes entre ventanas ────────────────────────────────────
  sendPlayerMessage: (message)  => ipcRenderer.send("player-message", message),
  onPlayerMessage:   (callback) => on("player-message", callback),
  onSecondScreenClosed: (callback) => on("second-screen-closed", callback),

  // ── Auto-updater ─────────────────────────────────────────────────────────
  checkUpdates:  () => ipcRenderer.invoke("check-updates"),
  installUpdate: () => ipcRenderer.send("install-update"),

  // Eventos de actualización (devuelven función de limpieza)
  onUpdateAvailable:  (cb) => on("update-available",  cb),
  onUpdateProgress:   (cb) => on("update-progress",   cb),
  onUpdateDownloaded: (cb) => on("update-downloaded", cb),
  onUpdateError:      (cb) => on("update-error",      cb),

  // ── Info de la app ────────────────────────────────────────────────────────
  isElectron: true,
});