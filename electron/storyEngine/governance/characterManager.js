const { CharacterStore } = require("../storage/characterStore")

const characterStore = new CharacterStore()

function apply(effects, chapter) {
  for (const e of effects) {
    if (e.targetType !== "character") continue

    // 使用新的增量方法
    characterStore.applyEffect(e, chapter)
  }
}

module.exports = { apply }
