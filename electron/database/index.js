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
