const worldviewDAO = require('./database/worldviewDAO')

function getWorldview(novelId) {
  return worldviewDAO.getWorldviewByNovel(novelId)
}

function saveWorldview(novelId, data) {
  return worldviewDAO.saveWorldview(novelId, data)
}

module.exports = {
  getWorldview,
  saveWorldview
}
