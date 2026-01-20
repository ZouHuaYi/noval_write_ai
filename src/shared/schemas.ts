/**
 * Zod Schema 定义
 * 用于强制 AI 输出符合预定义结构，确保数据一致性
 */
import { z } from 'zod'

// =============================================
// 1. 事件节点 Schema (对应 StoryWriter 的 Outline Agent)
// =============================================
export const EventNodeSchema = z.object({
  id: z.string().describe('事件唯一标识'),
  title: z.string().describe('事件标题'),
  summary: z.string().describe('事件摘要，简洁描述发生了什么'),
  participants: z.array(z.string()).describe('参与角色名称列表'),
  location: z.string().optional().describe('事件发生地点'),
  timeFrame: z.string().optional().describe('事件时间框架'),
  causalDependency: z.string().nullable().optional().describe('前置事件ID，用于建立因果关系'),
  effects: z.array(z.string()).optional().describe('事件产生的影响'),
  tags: z.array(z.string()).optional().describe('事件标签，如"转折点"、"伏笔"等'),
})

export type EventNode = z.infer<typeof EventNodeSchema>

// 事件列表 Schema (AI 生成大纲时返回)
export const EventListSchema = z.object({
  events: z.array(EventNodeSchema).describe('事件节点列表'),
  summary: z.string().optional().describe('整体故事摘要'),
})

export type EventList = z.infer<typeof EventListSchema>

// =============================================
// 2. 章节规划 Schema (对应 StoryWriter 的 Planning Agent)
// =============================================
export const ChapterPlanSchema = z.object({
  chapterNumber: z.number().describe('章节编号'),
  title: z.string().describe('章节标题'),
  includedEvents: z.array(z.string()).describe('本章包含的事件ID列表'),
  narrativeStrategy: z.enum(['顺序', '倒叙', '插叙', '并叙']).describe('叙事策略'),
  focusCharacters: z.array(z.string()).optional().describe('本章重点角色'),
  emotionalTone: z.string().optional().describe('情感基调'),
  wordCountTarget: z.number().optional().describe('目标字数'),
})

export type ChapterPlan = z.infer<typeof ChapterPlanSchema>

// 章节规划列表
export const ChapterPlanListSchema = z.object({
  chapters: z.array(ChapterPlanSchema).describe('章节规划列表'),
  totalChapters: z.number().describe('总章节数'),
})

export type ChapterPlanList = z.infer<typeof ChapterPlanListSchema>

// =============================================
// 3. 角色卡片 Schema (对应 NovelForge 的设定卡)
// =============================================
export const CharacterRelationshipSchema = z.object({
  target: z.string().describe('关系对象名称'),
  type: z.string().describe('关系类型，如"朋友"、"敌人"、"恋人"等'),
  description: z.string().optional().describe('关系详细描述'),
})

export const CharacterCardSchema = z.object({
  id: z.string().optional().describe('角色唯一标识'),
  name: z.string().describe('角色名称'),
  aliases: z.array(z.string()).optional().describe('角色别名'),
  traits: z.array(z.string()).describe('性格特征'),
  appearance: z.string().optional().describe('外貌描述'),
  background: z.string().optional().describe('背景故事'),
  goals: z.string().describe('角色目标/动机'),
  abilities: z.array(z.string()).optional().describe('能力/技能'),
  relationships: z.array(CharacterRelationshipSchema).optional().describe('人物关系'),
  currentState: z.record(z.string(), z.unknown()).optional().describe('当前状态'),
})

export type CharacterCard = z.infer<typeof CharacterCardSchema>

// =============================================
// 4. 世界观/场景 Schema
// =============================================
export const LocationSchema = z.object({
  id: z.string().optional(),
  name: z.string().describe('地点名称'),
  description: z.string().describe('地点描述'),
  features: z.array(z.string()).optional().describe('地点特征'),
  connectedTo: z.array(z.string()).optional().describe('连接的其他地点'),
})

export type Location = z.infer<typeof LocationSchema>

export const WorldSettingSchema = z.object({
  worldName: z.string().optional().describe('世界名称'),
  era: z.string().optional().describe('时代背景'),
  rules: z.array(z.string()).describe('世界规则/设定'),
  locations: z.array(LocationSchema).optional().describe('重要地点'),
  factions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    goals: z.string().optional(),
  })).optional().describe('势力/组织'),
})

export type WorldSetting = z.infer<typeof WorldSettingSchema>

// =============================================
// 5. AI 输出校验 Schema
// =============================================

// 一致性检查结果
export const ConsistencyCheckResultSchema = z.object({
  isConsistent: z.boolean().describe('是否一致'),
  issues: z.array(z.object({
    type: z.enum(['角色行为矛盾', '时间线错误', '设定冲突', '逻辑漏洞', '其他']),
    description: z.string().describe('问题描述'),
    severity: z.enum(['低', '中', '高']).describe('严重程度'),
    suggestion: z.string().optional().describe('修改建议'),
  })).describe('发现的问题列表'),
  summary: z.string().optional().describe('检查总结'),
})

export type ConsistencyCheckResult = z.infer<typeof ConsistencyCheckResultSchema>

// 一致性检查 Diff 格式结果
export const ConsistencyDiffItemSchema = z.object({
  id: z.string().describe('建议唯一ID'),
  category: z.string().describe('问题分类,如"人物年龄与行为表现"'),
  issue: z.string().describe('不一致点描述'),
  originalText: z.string().describe('原文片段'),
  suggestedText: z.string().describe('建议修改后的文本'),
  reason: z.string().describe('修改理由'),
  startIndex: z.number().optional().describe('原文在章节中的起始位置'),
  endIndex: z.number().optional().describe('原文在章节中的结束位置')
})

export type ConsistencyDiffItem = z.infer<typeof ConsistencyDiffItemSchema>

export const ConsistencyDiffResultSchema = z.object({
  summary: z.string().describe('总体检查摘要'),
  suggestions: z.array(ConsistencyDiffItemSchema).describe('具体建议列表')
})

export type ConsistencyDiffResult = z.infer<typeof ConsistencyDiffResultSchema>

// ReIO 输出重写检查结果
export const ReIOCheckResultSchema = z.object({
  passed: z.boolean().describe('是否通过检查'),
  deviatesFromGoal: z.boolean().describe('是否偏离事件目标'),
  hasLogicConflict: z.boolean().describe('是否存在逻辑冲突'),
  hasCharacterInconsistency: z.boolean().describe('是否存在角色行为不一致'),
  issues: z.array(z.string()).describe('具体问题列表'),
  rewriteSuggestion: z.string().optional().describe('重写建议'),
})

export type ReIOCheckResult = z.infer<typeof ReIOCheckResultSchema>

// =============================================
// 6. 知识条目 Schema (用于 @DSL 引用)
// =============================================
export const KnowledgeEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['character', 'location', 'event', 'item', 'rule', 'other']),
  name: z.string(),
  summary: z.string().optional(),
  detail: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>

// =============================================
// 工具函数：解析 AI JSON 输出
// =============================================

/**
 * 安全解析 JSON 字符串
 */
export function safeParseJSON<T>(jsonString: string, schema: z.ZodSchema<T>): {
  success: true; data: T
} | {
  success: false; error: string
} {
  try {
    // 尝试提取 JSON 块（处理 AI 可能输出的 markdown 代码块）
    let cleanJson = jsonString
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      cleanJson = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(cleanJson)
    const result = schema.safeParse(parsed)

    if (result.success) {
      return { success: true, data: result.data }
    } else {
      return {
        success: false,
        error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      }
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'JSON 解析失败'
    }
  }
}

/**
 * 生成 JSON Schema 描述（用于 AI Prompt）
 */
export function generateSchemaDescription(schema: z.ZodSchema): string {
  // 简化版：将 Zod schema 转为可读描述
  // 实际项目可以使用 zod-to-json-schema 库
  return JSON.stringify(schema._def, null, 2)
}
