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

  // 数据库迁移:为 planning_meta 表添加 chapterBeats 列
  try {
    const tableInfo = db.pragma('table_info(planning_meta)')
    const hasChapterBeats = tableInfo.some(col => col.name === 'chapterBeats')

    if (!hasChapterBeats) {
      console.log('检测到旧版数据库,正在添加 planning_meta.chapterBeats 列...')
      db.exec('ALTER TABLE planning_meta ADD COLUMN chapterBeats TEXT')
      console.log('planning_meta.chapterBeats 列已添加')
    }
  } catch (error) {
    console.error('数据库迁移失败:', error)
    throw error
  }

  // 数据库迁移: 修复可能存在的旧的单列唯一索引问题
  try {
    // 检查 chapter 表上的所有索引
    const indexes = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='chapter'").all()
    console.log('[数据库迁移] chapter 表的索引:', indexes.map(i => i.name).join(', '))
    
    // 查找可能存在的错误索引（只基于 chapterNumber 的唯一索引）
    const problematicIndexes = indexes.filter(idx => {
      if (!idx.sql) return false // 自动创建的索引可能没有 sql
      const sql = idx.sql.toLowerCase()
      // 检查是否只包含 chapterNumber 而不包含 novelId
      return sql.includes('unique') && 
             sql.includes('chapternumber') && 
             !sql.includes('novelid')
    })
    
    if (problematicIndexes.length > 0) {
      console.log('[数据库迁移] 检测到有问题的唯一索引，正在删除...')
      problematicIndexes.forEach(idx => {
        console.log(`[数据库迁移] 删除索引: ${idx.name}`)
        db.exec(`DROP INDEX IF EXISTS "${idx.name}"`)
      })
      console.log('[数据库迁移] 问题索引已删除')
    }
    
    // 确保正确的组合唯一索引存在
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_novel_number ON chapter(novelId, chapterNumber)')
    console.log('[数据库迁移] 已确保正确的组合唯一索引存在')
  } catch (error) {
    console.error('[数据库迁移] 索引修复失败:', error)
    // 不抛出错误，因为这不是致命问题
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
