function registerCandidates(candidates, dependencyStore) {
  for (const c of candidates) {
    dependencyStore.add({
      id: c.candidateId,
      description: c.description,
      type: "foreshadow",
      relatedCharacters: c.relatedCharacters,
      status: "open",
      createdAt: c.introducedAt,
      resolveWhen: [],
      violateWhen: []
    })
  }
}


function matchDependencyConditions(conditions = [], event) {
  for (const cond of conditions) {
    if (cond.eventType && cond.eventType !== event.type) continue

    if (
      cond.requiredActors &&
      !cond.requiredActors.every(a => event.actors.includes(a))
    ) continue

    if (cond.effect) {
      const matched = event.effects?.some(e =>
        e.targetType === cond.effect.targetType &&
        e.field === cond.effect.field &&
        e.to === cond.effect.to
      )
      if (!matched) continue
    }

    return true
  }
  return false
}

function update(candidates, events, dependencyStore) {
  registerCandidates(candidates, dependencyStore)

  for (const event of events) {
    const deps = dependencyStore.getOpenRelated(event.actors)

    for (const dep of deps) {
      // 1️⃣ 已破坏依赖不能推进
      if (dep.status === "violated") continue

      // 2️⃣ 检查 resolve 条件
      if (matchDependencyConditions(dep.resolveWhen, event)) {
        dep.status = "resolved"
        dep.resolvedBy = event.id
        dependencyStore.add(dep) // 更新依赖状态
        continue
      }

      // 3️⃣ 检查 violate 条件
      if (matchDependencyConditions(dep.violateWhen, event)) {
        dep.status = "violated"
        dep.violatedBy = event.id
        dependencyStore.add(dep) // 更新依赖状态
      }
    }
  }
}

module.exports = { update }
