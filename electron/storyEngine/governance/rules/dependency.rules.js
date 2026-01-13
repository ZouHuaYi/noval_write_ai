// dependencyRules.js
const { DependencyStore } = require("../../storage/dependencyStore")
const dependencyStore = new DependencyStore()

/**
 * 依赖规则声明
 */
const DependencyRules = [
  {
    id: "dependency_not_violated",
    description: "已被破坏的依赖不能再推进",
    when: ({ dep, event }) => dep.status === "violated",
    validate: ({ dep, event }) => ({
      ok: false,
      code: "DEPENDENCY_VIOLATED",
      message: `依赖【${dep.description}】已被破坏，事件 ${event.id} 无法推进`
    })
  },
  {
    id: "dependency_only_actor_can_progress",
    description: "非依赖指定角色无法推进依赖",
    when: ({ dep, event }) =>
      dep.allowedActors &&
      !event.actors.some(a => dep.allowedActors.includes(a)),
    validate: ({ dep, event }) => ({
      ok: false,
      code: "DEPENDENCY_INVALID_ACTOR",
      message: `事件 ${event.id} 的参与者无法推进依赖【${dep.description}】`
    })
  },
  {
    id: "dependency_time_order",
    description: "依赖必须按顺序完成",
    when: ({ dep, event }) =>
      dep.status === "pending" && event.t < dep.startT,
    validate: ({ dep, event }) => ({
      ok: false,
      code: "DEPENDENCY_TIME_ORDER",
      message: `事件 ${event.id} 发生在依赖【${dep.description}】开始之前`
    })
  }
  // 可以继续扩展：
  // - 跨章节依赖
  // - 回溯/复活事件对依赖的影响
  // - 并行依赖处理
]

function checkDependencyRules(event) {
  // 获取事件相关的依赖
  const deps = dependencyStore.getOpenRelated(event.actors)
  for (const dep of deps) {
    for (const rule of DependencyRules) {
      if (rule.when({ dep, event })) {
        const res = rule.validate({ dep, event })
        if (!res.ok) {
          throw new Error(`依赖规则违反：${res.message}`)
        }
      }
    }
  }
}

module.exports = { checkDependencyRules, DependencyRules }
