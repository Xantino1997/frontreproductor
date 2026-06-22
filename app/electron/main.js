const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");
const log = require("electron-log");

// ── Configuración de Debug ─────────────────────────────────────────────────
const logPath = path.join(app.getPath("desktop"), 'debug_log.txt');
try {
    const logStream = fs.createWriteStream(logPath);
    process.stdout.write = process.stderr.write = logStream.write.bind(logStream);
} catch (e) { console.log("No se pudo crear log de escritorio"); }

// ── Carga segura de AutoUpdater ───────────────────────────────────────────
let autoUpdater = null;
try {
    autoUpdater = require("electron-updater").autoUpdater;
    autoUpdater.logger = log;
    log.transports.file.level = "info";
} catch (e) {
    console.log("electron-updater no disponible, continuando sin él.");
}

const isDev = !app.isPackaged;
nativeTheme.themeSource = "dark";

const getPath = (filePath) => {
    return isDev 
        ? path.join(__dirname, "../../", filePath) 
        : path.join(process.resourcesPath, filePath);
};

// ── Directorios de datos ──────────────────────────────────────────────────
const USER_DATA = app.getPath("userData");
const LISTS_DIR = path.join(USER_DATA, "listas");
if (!fs.existsSync(LISTS_DIR)) fs.mkdirSync(LISTS_DIR, { recursive: true });

let mainWindow = null;
let splashWindow = null;

// ── Ventanas ──────────────────────────────────────────────────────────────
function createSplash() {
    splashWindow = new BrowserWindow({
        width: 480, height: 300, frame: false, transparent: true, resizable: false,
        center: true, alwaysOnTop: true, skipTaskbar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    splashWindow.loadFile(getPath("app/electron/splash.html"));
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 800, minWidth: 900, minHeight: 600,
        backgroundColor: "#0f1520",
        show: false,
        webPreferences: {
            preload: getPath("app/electron/preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL("https://frontreproductor.vercel.app");
    } else {
        mainWindow.loadFile(getPath("out/index.html"));
    }

    mainWindow.once("ready-to-show", () => {
        setTimeout(() => {
            if (splashWindow) splashWindow.close();
            mainWindow.show();
        }, 2000);
    });
}

// ── IPC Handlers ──────────────────────────────────────────────────────────
ipcMain.handle("dialog:openFiles", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] });
    return result.canceled ? [] : result.filePaths;
});

// ── Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
    createSplash();
    createMainWindow();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
