const entityDAO = require('./database/entityDAO')
const eventDAO = require('./database/eventDAO')
const dependencyDAO = require('./database/dependencyDAO')
const storyEngine = require('./storyEngine')

async function refreshMemory(novelId) {
  if (!novelId) return null
  return await storyEngine.run(novelId)
}

function getMemory(novelId) {
  return {
    entities: entityDAO.getEntitiesByNovel(novelId),
    events: eventDAO.getEventsByNovel(novelId),
    dependencies: dependencyDAO.getDependenciesByNovel(novelId)
  }
}

module.exports = {
  refreshMemory,
  getMemory
}
