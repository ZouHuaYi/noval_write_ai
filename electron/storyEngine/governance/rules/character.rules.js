// characterRules.js
const { CharacterStore } = require("../../storage/characterStore")
const characterStore = new CharacterStore()

/**
 * 角色状态规则声明
 */
const CharacterStateRules = [
  {
    id: "injured_no_heal_in_battle",
    description: "重伤角色不可在战斗中直接恢复",
    when: ({ character, event, effect }) =>
      character.states.health === "injured" &&
      event.type === "battle" &&
      effect.field === "health" &&
      effect.to === "healthy",
    validate: ({ character, event, effect }) => {
      return {
        ok: false,
        code: "CHAR_INJURED_BATTLE_HEAL",
        message: `重伤角色【${character.name}】不应在战斗中直接恢复`
      }
    }
  },
  {
    id: "dead_no_magic_in_battle",
    description: "死亡角色不可在战斗中施法",
    when: ({ character, event, effect }) =>
      character.states.alive === false &&
      event.type === "battle" &&
      effect.field === "mana",
    validate: ({ character, event, effect }) => ({
      ok: false,
      code: "CHAR_DEAD_BATTLE_MAGIC",
      message: `死亡角色【${character.name}】不应在战斗中施法`
    })
  }
  // 可以继续扩展更多规则，比如：
  // 昏迷、魔力枯竭、回忆状态、复活状态等
]

/**
 * 校验函数
 */
function checkCharacterRules(event) {
  for (const eff of event.effects || []) {
    if (eff.targetType !== "character") continue

    const ch = characterStore.get(eff.targetId)
    if (!ch) continue

    for (const rule of CharacterStateRules) {
      if (rule.when({ character: ch, event, effect: eff })) {
        const res = rule.validate({ character: ch, event, effect: eff })
        if (!res.ok) {
          throw new Error(`人物规则违反：${res.message}`)
        }
      }
    }
  }
}

module.exports = { checkCharacterRules, CharacterStateRules }
