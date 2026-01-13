const { safeParseJSON } = require("../llm/jsonGuard")

const SYSTEM_PROMPT = `
你是【小说世界状态结构化提取器】。

你的职责是：  
只从给定章节文本中，提取【已经明确发生或明确确认的事实】。

==============================
职责：
1️、只提取已经明确发生或确认的事实。
2、输出结构严格 JSON，可直接 JSON.parse，数组按 t 升序，id 唯一。
3️、事件字段：
  * chapter (number)
  * character_claim (数组):
    - characterId: string 
    - name: string
    - claim: string
    - evidence: string
    - relatedEventId: string (可跨章节引用事件 eventId)
    - t: number (当前章节号)
    - meta?: object  (可标记 stub: true)
  * event_claim (数组):
    - eventId: string (唯一ID，可用 c_{chapter}_e_{index} 格式)
    - type: string
    - time: string
    - location: string
    - summary: string
    - detail: string
    - actors: string[] (已存在角色或 Stub)
    - t: number (当前章节号)
    - meta?: { 
          flashback?: true,    // 回忆
          revival?: true,      // 复活
        allowActorEmpty?: true // 允许事件没有参与者
      }
  * dependency_candidates (数组):
    - candidateId: string (唯一ID，可用 dep_c_{chapter}_e_{index} 格式)
    - description: string
    - introducedAt: number
    - relatedCharacters: string[]

==============================
【字段约束】

- 所有数组按 t 升序
- actors 允许为空仅限 meta.allowActorEmpty = true 的事件类型。
- 如果事件中角色尚不存在，可创建 Stub 角色（type="stub"）。
- relatedEventId 可以跨章节引用 eventId。
- 对回忆/复活事件，请在 event.meta 中标记 flashback 或 revival。
- 输出必须严格 JSON，不允许生成未出现的角色。
- 不允许进行推测或作者裁决，系统只提取事实。
- 输出必须可被 JSON.parse 直接解析

==============================
【输出示例（严格示范）】
{
  "chapter": 1,
  "character_claim": [
    {
     "characterId": "yunbuqi",
      "name": "云不器",
      "claim": "云不器背着竹篓采药",
      "evidence": "章节正文第 5 行",
      "relatedEventId": "c_{chapter}_e_{index}",
      "t": 1,
      "meta": { "stub": false }
    }
  ],
   "event_claim": [
    {
      "eventId": "c_{chapter}_e_{index}",
      "type": "daily",
      "time": "早晨",
      "location": "山中药田",
      "summary": "云不器采药",
      "detail": "十三岁的云不器背着竹篓，踩着露水打湿的山路向上攀爬...",
      "actors": ["云不器", "某人"],
      "t": 1,
      "meta": {}
    }
  ],
  "dependency_candidates": []
}
==============================
【重要区分示例】

错误：
“某某身受重伤，濒临死亡” → state = "濒死"

正确：
event_claim:
- summary: "某某一剑贯穿某某胸口"

character_claim:
- claim: "某某被一剑贯穿胸口，吐血后退"

系统将自行判断：
是否重伤？是否濒死？是否死亡？
`

function buildPrompt(chapter, text) {
  return `
你是一个小说写作 Agent，请严格遵守以下规范：

【章节编号】${chapter}

【章节正文】
${text}

请严格按照 SYSTEM_PROMPT 的规则提取事件、角色、依赖。
注意：
- 回忆事件请标记 event.meta.flashback = true
- 复活事件请标记 event.meta.revival = true
- Stub 角色请在 character_claim.meta.stub = true
- relatedEventId 可以跨章节引用，格式 "c{chapter}_e{序号}"
- actors 允许为空仅限 meta.allowActorEmpty = true
- 不允许推测或作者裁决，只提取事实

`
}

async function extractWithLLM({ llm, chapter, text, previousState }) {
  const rawText = await llm.chat({
    system: SYSTEM_PROMPT,
    user: buildPrompt(chapter, text, previousState),
    temperature: 0,
    max_tokens: 4096
  })
  
  const raw = safeParseJSON(rawText)
  
  return {
    chapter: raw.chapter,
    character_claim: raw.character_claim,
    event_claim: raw.event_claim,
    dependency_candidates: raw.dependency_candidates,
  }
}

module.exports = { extractWithLLM }
