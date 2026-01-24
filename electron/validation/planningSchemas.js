const { z } = require('zod')

const PlanningEventSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  description: z.string().optional(),
  eventType: z.string().optional(),
  chapter: z.number().nullable().optional(),
  characters: z.array(z.string()).optional(),
  preconditions: z.array(z.string()).optional(),
  postconditions: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional()
}).passthrough()

const PlanningEventListSchema = z.array(PlanningEventSchema)

const stringArray = z.preprocess((value) => {
  if (!Array.isArray(value)) return value
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        return item.id || item.label || item.name || item.title || ''
      }
      return ''
    })
    .filter((item) => typeof item === 'string' && item.length > 0)
}, z.array(z.string()))

const PlanningChapterSchema = z.object({
  id: z.string().optional(),
  chapterNumber: z.number(),
  title: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  targetWords: z.number().optional(),
  wordCountTarget: z.number().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  focus: stringArray.optional(),
  focusCharacters: stringArray.optional(),
  writingHints: stringArray.optional(),
  events: stringArray.optional(),
  includedEvents: stringArray.optional(),
  progress: z.number().optional(),
  lockWritingTarget: z.boolean().optional()
}).passthrough()

const PlanningChapterListSchema = z.array(PlanningChapterSchema)

const PlanningMetaSchema = z.object({
  synopsis: z.string().nullable().optional(),
  targetChapters: z.number().nullable().optional(),
  wordsPerChapter: z.number().nullable().optional(),
  chapterBeats: z.array(z.any()).optional(),
  lockWritingTarget: z.boolean().optional()
}).passthrough()

module.exports = {
  PlanningEventSchema,
  PlanningEventListSchema,
  PlanningChapterSchema,
  PlanningChapterListSchema,
  PlanningMetaSchema
}
