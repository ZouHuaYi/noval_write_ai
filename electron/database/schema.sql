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
  chapterNumber INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  status TEXT, -- draft, writing, completed

  wordCount INTEGER,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE
);

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

-- 世界观/规则表
CREATE TABLE IF NOT EXISTS worldview (
  id TEXT PRIMARY KEY,
  novelId TEXT NOT NULL,
  worldview TEXT,
  rules TEXT,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE
);

-- 章节快照表
CREATE TABLE IF NOT EXISTS chapter_snapshot (
  id TEXT PRIMARY KEY,
  novelId TEXT NOT NULL,
  chapterId TEXT NOT NULL,
  chapterNumber INTEGER,
  title TEXT,
  content TEXT,
  wordCount INTEGER,
  reason TEXT,
  createdAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE,
  FOREIGN KEY (chapterId) REFERENCES chapter(id) ON DELETE CASCADE
);

-- 章节生成进度表
CREATE TABLE IF NOT EXISTS chapter_generation (
  id TEXT PRIMARY KEY,
  novelId TEXT NOT NULL,
  chapterId TEXT NOT NULL,
  status TEXT,
  chunkSize INTEGER,
  maxChunks INTEGER,
  currentChunk INTEGER,
  lastContentLength INTEGER,
  lastError TEXT,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE,
  FOREIGN KEY (chapterId) REFERENCES chapter(id) ON DELETE CASCADE
);

-- 知识库条目表
CREATE TABLE IF NOT EXISTS knowledge_entry (
  id TEXT PRIMARY KEY,
  novelId TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  summary TEXT,
  detail TEXT,
  aliases TEXT,
  tags TEXT,
  reviewStatus TEXT,
  reviewedAt INTEGER,
  sourceChapter INTEGER,
  sourceEventId TEXT,
  sourceEntityId TEXT,
  sourceType TEXT,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (novelId) REFERENCES novel(id) ON DELETE CASCADE
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_chapter_novelId ON chapter(novelId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_novel_number ON chapter(novelId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_outline_novelId ON outline(novelId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worldview_novelId ON worldview(novelId);
CREATE INDEX IF NOT EXISTS idx_chapter_snapshot_chapterId ON chapter_snapshot(chapterId);
CREATE INDEX IF NOT EXISTS idx_chapter_snapshot_novelId ON chapter_snapshot(novelId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_generation_chapterId ON chapter_generation(chapterId);
CREATE INDEX IF NOT EXISTS idx_knowledge_entry_novelId ON knowledge_entry(novelId);
CREATE INDEX IF NOT EXISTS idx_knowledge_entry_type ON knowledge_entry(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_entry_unique ON knowledge_entry(novelId, type, name);
