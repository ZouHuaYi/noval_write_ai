const novelDAO = require('./database/novelDAO')

function listNovels() {
  return novelDAO.getNovelList()
}

function getNovel(id) {
  return novelDAO.getNovelById(id)
}

function createNovel(data) {
  const id = novelDAO.createNovel(data)
  return { id, ...novelDAO.getNovelById(id) }
}

function updateNovel(id, data) {
  return novelDAO.updateNovel(id, data)
}

function deleteNovel(id) {
  novelDAO.deleteNovel(id)
  return { success: true }
}

module.exports = {
  listNovels,
  getNovel,
  createNovel,
  updateNovel,
  deleteNovel
}
