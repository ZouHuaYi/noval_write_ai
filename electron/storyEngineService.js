const storyEngine = require('./storyEngine')

async function runStoryEngine(novelId) {
  return await storyEngine.run(novelId)
}

function compressStoryContext(chapter, novelId) {
  return storyEngine.processCompressOutput(chapter, novelId)
}

module.exports = {
  runStoryEngine,
  compressStoryContext
}
