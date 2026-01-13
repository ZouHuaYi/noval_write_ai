// 数据库操作封装
export const db = {
  // 查询多条
  async query(sql, params = []) {
    if (window.electronAPI) {
      return await window.electronAPI.db.query(sql, params)
    }
    return []
  },
  
  // 执行操作（INSERT, UPDATE, DELETE）
  async execute(sql, params = []) {
    if (window.electronAPI) {
      return await window.electronAPI.db.execute(sql, params)
    }
    return { lastInsertRowid: 0, changes: 0 }
  },
  
  // 获取所有结果
  async getAll(sql, params = []) {
    if (window.electronAPI) {
      return await window.electronAPI.db.getAll(sql, params)
    }
    return []
  },
  
  // 获取单条结果
  async get(sql, params = []) {
    if (window.electronAPI) {
      return await window.electronAPI.db.get(sql, params)
    }
    return null
  }
}
