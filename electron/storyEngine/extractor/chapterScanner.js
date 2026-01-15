const fs = require("fs")
const path = require("path")
const { getChaptersByNovelAndStatus } = require("../../database/chapterDAO")

function scanChapters(dir = "chapters") {
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".txt"))
    .sort()
    .map(file => {
      const chapter = Number(file.replace(".txt", ""))
      const text = fs.readFileSync(path.join(dir, file), "utf-8")
      return { chapter, text }
    })
}

function scanWritingChapters(novelId, status = "writing") {
  if (!novelId) return []
  return getChaptersByNovelAndStatus(novelId, status).map(chapter => ({
    id: chapter.id,
    chapter: chapter.chapterNumber,
    text: chapter.content || ""
  }))
}

module.exports = { scanChapters, scanWritingChapters }

