const novelDAO = require('./database/novelDAO')
const chapterDAO = require('./database/chapterDAO')

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

async function exportNovel(novelId) {
  const novel = novelDAO.getNovelById(novelId)
  if (!novel) throw new Error('小说不存在')

  const chapters = chapterDAO.getChaptersByNovelAsc(novelId)
  
  let content = `${novel.title}\n\n`
  if (novel.description) {
    content += `简介：\n${novel.description}\n\n`
  }
  content += `\n`

  for (const chapter of chapters) {
    content += `\n${chapter.title}\n`
    content += `--------------------\n`
    content += `${chapter.content}\n\n`
  }

  return {
    title: novel.title,
    content
  }
}

module.exports = {
  listNovels,
  getNovel,
  createNovel,
  updateNovel,
  deleteNovel,
  exportNovel
}
