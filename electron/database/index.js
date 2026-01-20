const Database = require('better-sqlite3')
const { app } = require('electron')
const { join } = require('path')
const fs = require('fs')

let db = null

function initDatabase() {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'novels.db')

  db = new Database(dbPath)

  // 启用外键约束
  db.pragma('foreign_keys = ON')

  // 从 schema.sql 文件创建表结构
  const schemaPath = join(__dirname, 'schema.sql')
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, 'utf-8')
      db.exec(schema)
      console.log('数据库表结构已创建/更新')
    } catch (error) {
      console.error('执行schema.sql失败:', error)
      throw error
    }
  } else {
    console.warn('警告: schema.sql 文件不存在')
  }

  // 数据库迁移:为 chapter 表添加 contentHash 列
  try {
    const tableInfo = db.pragma('table_info(chapter)')
    const hasContentHash = tableInfo.some(col => col.name === 'contentHash')

    if (!hasContentHash) {
      console.log('检测到旧版数据库,正在添加 contentHash 列...')
      db.exec('ALTER TABLE chapter ADD COLUMN contentHash TEXT')

      // 为已有数据计算并填充 contentHash
      const crypto = require('crypto')
      const chapters = db.prepare('SELECT id, content FROM chapter').all()
      const updateStmt = db.prepare('UPDATE chapter SET contentHash = ? WHERE id = ?')

      chapters.forEach(chapter => {
        if (chapter.content) {
          const hash = crypto.createHash('md5').update(chapter.content).digest('hex')
          updateStmt.run(hash, chapter.id)
        }
      })

      console.log(`已为 ${chapters.length} 个章节计算并填充 contentHash`)
    }
  } catch (error) {
    console.error('数据库迁移失败:', error)
    throw error
  }

  console.log('数据库初始化成功:', dbPath)
  return db
}

function getDatabase() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()')
  }
  return db
}

module.exports = {
  initDatabase,
  getDatabase
}
