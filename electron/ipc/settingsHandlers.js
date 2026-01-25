/**
 * Settings IPC Handlers
 */
const { ipcMain } = require('electron')
const settingsDAO = require('../database/settingsDAO')

function registerSettingsHandlers(ipcMain) {
  ipcMain.handle('settings:get', async (_, key) => {
    try {
      return settingsDAO.getSetting(key)
    } catch (error) {
      console.error('获取设置失败:', error)
      throw error
    }
  })

  ipcMain.handle('settings:set', async (_, key, value, description) => {
    try {
      return settingsDAO.setSetting(key, value, description)
    } catch (error) {
      console.error('保存设置失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerSettingsHandlers
}