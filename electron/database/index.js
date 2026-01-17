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

  // 先检查并执行数据库迁移（在创建表之前处理现有表）
  try {
    // 检查 chapter 表是否存在
    const chapterTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='chapter'
    `).get()

    if (chapterTableExists) {
      const chapterTableInfo = db.prepare("PRAGMA table_info(chapter)").all()
      const hasChapterNumber = chapterTableInfo.some(col => col.name === 'chapterNumber')
      if (!hasChapterNumber) {
        console.log('执行数据库迁移：添加chapterNumber字段')
        db.exec(`ALTER TABLE chapter ADD COLUMN chapterNumber INTEGER`)
      }

      const novels = db.prepare('SELECT id FROM novel').all()
      const updateStmt = db.prepare('UPDATE chapter SET chapterNumber = ? WHERE id = ?')
      const updateChapterNumbers = db.transaction(() => {
        novels.forEach((novel) => {
          const chapters = db.prepare('SELECT id FROM chapter WHERE novelId = ? ORDER BY createdAt ASC').all(novel.id)
          chapters.forEach((chapter, index) => {
            updateStmt.run(index + 1, chapter.id)
          })
        })
      })
      updateChapterNumbers()

      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_novel_number ON chapter(novelId, chapterNumber)')
    }


    // 检查 outline 表是否存在，添加范围字段
    const outlineTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='outline'
    `).get()

    if (outlineTableExists) {
      const outlineTableInfo = db.prepare("PRAGMA table_info(outline)").all()
      const hasStartChapter = outlineTableInfo.some(col => col.name === 'startChapter')
      const hasEndChapter = outlineTableInfo.some(col => col.name === 'endChapter')

      if (!hasStartChapter) {
        console.log('执行数据库迁移：添加startChapter字段')
        db.exec(`ALTER TABLE outline ADD COLUMN startChapter INTEGER`)
      }

      if (!hasEndChapter) {
        console.log('执行数据库迁移：添加endChapter字段')
        db.exec(`ALTER TABLE outline ADD COLUMN endChapter INTEGER`)
      }
    }

    // const memoryTables = ['entity', 'event', 'dependency'] // Removed in Phase 7
    /*
    memoryTables.forEach((tableName) => {
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'
      `).get()

      if (!tableExists) return

      const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all()
      const hasChapterNumber = tableInfo.some(col => col.name === 'chapterNumber')
      if (!hasChapterNumber) {
        console.log(`执行数据库迁移：为 ${tableName} 添加chapterNumber字段`)
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN chapterNumber INTEGER`)
      }
    })
    */

    const knowledgeTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_entry'
    `).get()

    if (!knowledgeTableExists) {
      console.log('执行数据库迁移：创建 knowledge_entry 表')
      db.exec(`
        CREATE TABLE knowledge_entry (
          id TEXT PRIMARY KEY,
          novelId TEXT NOT NULL,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          summary TEXT,
          detail TEXT,
          aliases TEXT,
          tags TEXT,
          sourceChapter INTEGER,
          sourceEventId TEXT,
          sourceEntityId TEXT,
          sourceType TEXT,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `)
    } else {
      const knowledgeTableInfo = db.prepare('PRAGMA table_info(knowledge_entry)').all()
      const hasColumn = (name) => knowledgeTableInfo.some(col => col.name === name)
      const addColumn = (name, type) => {
        console.log(`执行数据库迁移：为 knowledge_entry 添加 ${name} 字段`)
        db.exec(`ALTER TABLE knowledge_entry ADD COLUMN ${name} ${type}`)
      }

      if (!hasColumn('novelId')) addColumn('novelId', 'TEXT')
      if (!hasColumn('type')) addColumn('type', 'TEXT')
      if (!hasColumn('name')) addColumn('name', 'TEXT')
      if (!hasColumn('summary')) addColumn('summary', 'TEXT')
      if (!hasColumn('detail')) addColumn('detail', 'TEXT')
      if (!hasColumn('aliases')) addColumn('aliases', 'TEXT')
      if (!hasColumn('tags')) addColumn('tags', 'TEXT')
      if (!hasColumn('reviewStatus')) addColumn('reviewStatus', 'TEXT')
      if (!hasColumn('reviewedAt')) addColumn('reviewedAt', 'INTEGER')
      if (!hasColumn('sourceChapter')) addColumn('sourceChapter', 'INTEGER')
      if (!hasColumn('sourceEventId')) addColumn('sourceEventId', 'TEXT')
      if (!hasColumn('sourceEntityId')) addColumn('sourceEntityId', 'TEXT')
      if (!hasColumn('sourceType')) addColumn('sourceType', 'TEXT')
      if (!hasColumn('createdAt')) addColumn('createdAt', 'INTEGER')
      if (!hasColumn('updatedAt')) addColumn('updatedAt', 'INTEGER')
    }

  } catch (error) {

    console.error('数据库迁移失败:', error)
  }

  // 从 schema.sql 文件创建表结构
  // 注意：对于已存在的表，CREATE TABLE IF NOT EXISTS 不会修改表结构
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
