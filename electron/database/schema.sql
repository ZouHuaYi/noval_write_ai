-- 小说表
CREATE TABLE IF NOT EXISTS novel (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT,
  description TEXT,
  createdAt INTEGER,
  updatedAt INTEGER
);

-- 章节表
CREATE TABLE IF NOT EXISTS chapter (
  id TEXT PRIMARY KEY,
  novelId TEXT NOT NULL,
  chapterNumber INTEGER UNIQUE NOT NULL,
  title TEXT,
  content TEXT,
  status TEXT, -- draft, writing, completed

  wordCount INTEGER,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE
);

-- 实体表 章节内容相关实体
CREATE TABLE IF NOT EXISTS entity (
  id TEXT PRIMARY KEY,
  eventId TEXT NOT NULL,
  novelId TEXT NOT NULL,
  chapterNumber INTEGER NOT NULL,
  name TEXT NOT NULL,
  states TEXT, -- JSON object
  history TEXT, -- JSON array
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE
);

-- 依赖表 章节内容相关依赖
CREATE TABLE IF NOT EXISTS dependency (
  id TEXT PRIMARY KEY,
  eventId TEXT NOT NULL,
  novelId TEXT NOT NULL,
  chapterNumber INTEGER NOT NULL,
  description TEXT,
  type TEXT,
  relatedCharacters TEXT, -- JSON array
  resolveWhen TEXT, -- JSON array
  violateWhen TEXT, -- JSON array
  status TEXT,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE
);

-- 事件表 章节内容相关事件
CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  eventId TEXT NOT NULL,
  novelId TEXT NOT NULL,
  chapterNumber INTEGER NOT NULL,
  type TEXT,
  summary TEXT,
  detail TEXT,
  actors TEXT, -- JSON array
  effects TEXT, -- JSON array
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE
);

-- 事件表 章节内容相关事件

-- 设置表（用于存储应用配置，如大模型配置）
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  createdAt INTEGER,
  updatedAt INTEGER
);

-- 小说大纲表
CREATE TABLE IF NOT EXISTS outline (
  id TEXT PRIMARY KEY,
  novelId TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  startChapter INTEGER,
  endChapter INTEGER,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_chapter_novelId ON chapter(novelId);
CREATE INDEX IF NOT EXISTS idx_chapter_idx ON chapter(novelId, idx);
CREATE INDEX IF NOT EXISTS idx_chapter_number ON chapter(chapterNumber);
CREATE INDEX IF NOT EXISTS idx_chapter_event_chapterId ON chapter_event(chapterId);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_outline_novelId ON outline(novelId);