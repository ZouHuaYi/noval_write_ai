const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const { join } = require('path')
const { initDatabase } = require('./database/index.js')
const { registerIpcHandlers } = require('./ipcHandlers.js')
const pipelineService = require('./pipeline/pipelineService')

let mainWindow = null

function createWindow() {
  // 移除默认菜单栏
  Menu.setApplicationMenu(null)

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
    frame: false, // 完全移除原生边框和标题栏
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

// 窗口控制 IPC 处理器
function registerWindowHandlers() {
  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize()
  })

  ipcMain.on('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close()
  })
}

app.whenReady().then(() => {
  // 初始化数据库（同步）
  initDatabase()

  // 启动时回收流水线运行状态
  try {
    pipelineService.recoverPipelineRunsOnStartup()
  } catch (error) {
    console.error('流水线启动恢复失败:', error?.message || String(error))
  }

  // 注册所有数据库相关的 IPC 处理器
  registerIpcHandlers()

  // 注册窗口控制处理器
  registerWindowHandlers()

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

