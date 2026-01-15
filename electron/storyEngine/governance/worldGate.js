const characterManager = require("./characterManager")
const dependencyManager = require("./dependencyManager")
const { createFromClaims } = require("./eventManager")
const { checkEventRules } = require("./rules/event.rules")
const { checkCharacterRules } = require("./rules/character.rules")
const { checkDependencyRules } = require("./rules/dependency.rules")

function validateAndApply(extract, chapter, stores) {
  const { characterStore, eventStore, dependencyStore } = stores
  
  const events = createFromClaims(
    extract.event_claim,
    extract.character_claim,
    characterStore
  )

  const depCandidates = extract.dependency_candidates || []

  const newEvents = []
  // 1. 验证事件
  for (const e of events) {
    try {
      checkEventRules(e, { characterStore, eventStore })
      checkCharacterRules(e, characterStore)
      checkDependencyRules(e, dependencyStore)
      eventStore.add(e)
      newEvents.push(e)
      characterManager.apply(e.effects, chapter, characterStore)

    } catch (err) {
      throw new Error(`事件验证失败：${err.message}`)
    }
  }

  dependencyManager.update(depCandidates, newEvents, dependencyStore)
}

module.exports = { validateAndApply }
