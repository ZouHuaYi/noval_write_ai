const fs = require("fs")
const path = require("path")

class JsonStore {
  constructor(filePath, defaultValue) {
    this.filePath = filePath
    this.data = defaultValue || []
    this.load()
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      this.data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"))
    } else {
      this.save()
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(this.data, null, 2),
      "utf-8"
    )
  }
}

module.exports = { JsonStore }
