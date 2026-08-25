import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import './polyfill.js';
import { app, BrowserWindow, Menu } from 'electron';
import { startServer } from './server.js';
let mainWindow = null;

const iconPath = path.join(__dirname, 'assets', 'icon.png');

async function createWindow() {
  try {
    const dataDir = path.join(app.getPath('userData'), 'lead-gen');
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.LEAD_GEN_DATA = dataDir;
  } catch (_) {}

  const PORT = await startServer();

  // Allow geolocation permission for the app window (Nearby me).
  app.commandLine.appendSwitch('enable-features', 'GeolocationPermissions');

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: '#0d1018',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadURL('http://localhost:' + PORT);
  mainWindow.on('closed', () => { mainWindow = null; });

  try {
    const ses = mainWindow.webContents.session;
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'geolocation') return callback(true);
      return callback(false);
    });
  } catch (_) {}

  // When running from source (not packaged), open DevTools on the right
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.openDevTools({ mode: 'right' });
    });
  }

  // Remove default menu (File, Edit, View, etc.)
  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
