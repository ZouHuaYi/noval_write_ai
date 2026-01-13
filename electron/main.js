const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')
const { initDatabase } = require('./database/index.js')
const { registerIpcHandlers } = require('./ipcHandlers.js')

let mainWindow = null

function createWindow() {
  // 获取应用路径
  const appPath = app.getAppPath()
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
  
  // 获取 preload 脚本路径
  const preloadPath = isDev
    ? join(process.cwd(), 'electron/preload.js')
    : join(appPath, 'electron/preload.js')
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 开发环境加载本地服务器，生产环境加载打包后的文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(appPath, 'dist/index.html'))
  }
}

app.whenReady().then(() => {
  // 初始化数据库（同步）
  initDatabase()
  
  // 注册所有数据库相关的 IPC 处理器
  registerIpcHandlers()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

