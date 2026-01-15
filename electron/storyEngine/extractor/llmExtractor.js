const { safeParseJSON } = require("../../llm/storyEngine/jsonGuard")
const { SYSTEM_PROMPT, buildPrompt } = require("../../prompt/llmExtractorPrompt")

async function extractWithLLM({ llm, chapter, text }) {
  const rawText = await llm.chat({
    system: SYSTEM_PROMPT,
    user: buildPrompt(chapter, text),
    temperature: 0,
    max_tokens: 4096
  })

  const raw = safeParseJSON(rawText)

  return {
    chapter: raw.chapter,
    character_claim: raw.character_claim,
    event_claim: raw.event_claim,
    dependency_candidates: raw.dependency_candidates
  }
}

module.exports = { extractWithLLM }
