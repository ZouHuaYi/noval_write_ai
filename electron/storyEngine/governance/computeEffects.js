const EffectRules = [

  {
    id: "injury",
    keywords: ["贯穿", "重伤", "血"],
    field: "health",
    to: "injured",
    meta: {}
  },
  {
    id: "death",
    keywords: ["死亡", "气息全无"],
    field: "alive",
    to: false,
    meta: {}
  },
  {
    id: "revival",
    keywords: ["复活", "再生"],
    field: "alive",
    to: true,
    meta: { requiresEventMeta: "revival" }
  }
]

function computeEffects(eventClaim, characterClaims, characterStore) {
  const effectMap = new Map()

  for (const claim of characterClaims) {
    const char = characterStore.get(claim.characterId)


    for (const rule of EffectRules) {
      const matchesKeyword = rule.keywords.some(k => claim.claim.includes(k))
      if (!matchesKeyword) continue

      // 如果规则需要事件 meta 才触发
      if (rule.meta.requiresEventMeta && !eventClaim.meta?.[rule.meta.requiresEventMeta]) continue

      effectMap.set(eventClaim.eventId, {
        targetType: "character",
        targetId: claim.characterId,
        name: claim?.name ?? "",
        field: rule.field,
        from: char?.states?.[rule.field] ?? "unknown",
        to: rule.to,
        reason: claim.claim,
        causedBy: eventClaim.eventId || eventClaim.id
      })
    }
  }

  return Array.from(effectMap.values())
}

module.exports = { computeEffects }