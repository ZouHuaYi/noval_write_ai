const fs = require("fs")
const path = require("path")

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

module.exports = { scanChapters }
