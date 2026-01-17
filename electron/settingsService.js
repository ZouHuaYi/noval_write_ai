const settingsDAO = require('./database/settingsDAO')

function getSetting(key) {
  return settingsDAO.getSetting(key)
}

function setSetting(key, value, description) {
  return settingsDAO.setSetting(key, value, description)
}

function getAllSettings() {
  return settingsDAO.getAllSettings()
}

function deleteSetting(key) {
  settingsDAO.deleteSetting(key)
  return { success: true }
}

module.exports = {
  getSetting,
  setSetting,
  getAllSettings,
  deleteSetting
}
