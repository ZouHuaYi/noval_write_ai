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
      // 表已存在，检查是否需要添加 chapterNumber 字段
      const chapterTableInfo = db.prepare("PRAGMA table_info(chapter)").all()
      const hasChapterNumber = chapterTableInfo.some(col => col.name === 'chapterNumber')
      
      if (!hasChapterNumber) {
        console.log('执行数据库迁移：添加chapterNumber字段')
        // 添加chapterNumber字段
        db.exec(`ALTER TABLE chapter ADD COLUMN chapterNumber INTEGER`)
        
        // 为现有章节分配编号
        const chapters = db.prepare('SELECT id FROM chapter ORDER BY createdAt ASC').all()
        if (chapters.length > 0) {
          const updateStmt = db.prepare('UPDATE chapter SET chapterNumber = ? WHERE id = ?')
          const transaction = db.transaction((chapters) => {
            for (let i = 0; i < chapters.length; i++) {
              updateStmt.run(i + 1, chapters[i].id)
            }
          })
          transaction(chapters)
          console.log(`已为 ${chapters.length} 个现有章节分配编号`)
        }
      }
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

    const memoryTables = ['entity', 'event', 'dependency']
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
  } catch (error) {

    console.error('数据库迁移失败:', error)
  }
  
  // 从 schema.sql 文件创建表结构
  // 注意：对于已存在的表，CREATE TABLE IF NOT EXISTS 不会修改表结构
  const schemaPath = join(__dirname, 'schema.sql')
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, 'utf-8')
      // 读取schema内容，但移除chapterNumber相关的索引创建（稍后单独处理）
      const schemaWithoutChapterNumberIndex = schema.replace(
        /CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+idx_chapter_number\s+ON\s+chapter\(chapterNumber\);/gi,
        ''
      )
      
      db.exec(schemaWithoutChapterNumberIndex)
      console.log('数据库表结构已创建/更新')
    } catch (error) {
      console.error('执行schema.sql失败:', error)
      throw error
    }
  } else {
    console.warn('警告: schema.sql 文件不存在')
  }
  
  // 确保chapterNumber索引存在（如果字段存在）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(chapter)").all()
    const hasChapterNumber = tableInfo.some(col => col.name === 'chapterNumber')
    if (hasChapterNumber) {
      // 尝试创建唯一索引
      try {
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_number ON chapter(chapterNumber)')
      } catch (error) {
        // 如果唯一索引失败（可能有重复值或索引已存在），尝试普通索引
        if (!error.message.includes('already exists')) {
          try {
            db.exec('CREATE INDEX IF NOT EXISTS idx_chapter_number ON chapter(chapterNumber)')
          } catch (idxError) {
            console.warn('创建chapterNumber索引失败:', idxError.message)
          }
        }
      }
    }
  } catch (error) {
    console.warn('检查chapterNumber字段失败:', error.message)
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
