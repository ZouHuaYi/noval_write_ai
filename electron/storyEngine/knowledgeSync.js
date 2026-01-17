const knowledgeEntryDAO = require('../database/knowledgeEntryDAO')
const { CharacterStore } = require('./storage/characterStore')
const { EventStore } = require('./storage/eventStore')
const { DependencyStore } = require('./storage/dependencyStore')

function summarizeEvent(event) {
  return event.summary || event.detail || ''
}

function buildCharacterEntry(character, novelId) {
  return {
    novelId,
    type: 'character',
    name: character.name,
    summary: character.states?.alive === false ? '已死亡' : '存活',
    detail: JSON.stringify({
      states: character.states || {},
      history: character.history || []
    }),
    tags: ['角色'],
    reviewStatus: 'pending',
    sourceChapter: character.t || null,
    sourceType: 'entity'
  }
}

function buildEventEntry(event, novelId) {
  return {
    novelId,
    type: 'timeline',
    name: event.summary || event.detail || event.eventId || '事件',
    summary: summarizeEvent(event),
    detail: JSON.stringify({
      detail: event.detail || '',
      actors: event.actors || [],
      effects: event.effects || [],
      type: event.type || ''
    }),
    tags: ['时间线'],
    reviewStatus: 'pending',
    sourceChapter: event.t || event.chapterNumber || null,
    sourceEventId: event.eventId || null,
    sourceType: 'event'
  }
}

function buildDependencyEntry(dep, novelId) {
  return {
    novelId,
    type: 'plot',
    name: dep.description || dep.candidateId || '剧情依赖',
    summary: dep.description || '',
    detail: JSON.stringify({
      relatedCharacters: dep.relatedCharacters || [],
      resolveWhen: dep.resolveWhen || [],
      violateWhen: dep.violateWhen || [],
      status: dep.status || ''
    }),
    tags: ['剧情'],
    reviewStatus: 'pending',
    sourceChapter: dep.introducedAt || dep.chapterNumber || null,
    sourceType: 'dependency'
  }
}

function buildLocationEntries(events, novelId) {
  const locations = new Map()
  for (const event of events) {
    const location = event.location || event.place || ''
    if (!location) continue
    const key = location.trim()
    if (!key) continue
    const existing = locations.get(key)
    if (!existing) {
      locations.set(key, {
        name: key,
        firstChapter: event.t || event.chapterNumber || null,
        events: [event.eventId || event.id].filter(Boolean)
      })
    } else {
      existing.events.push(event.eventId || event.id)
    }
  }

  return Array.from(locations.values()).map(item => ({
    novelId,
    type: 'location',
    name: item.name,
    summary: `出现于第 ${item.firstChapter ?? '?'} 章`,
    detail: JSON.stringify({
      events: item.events
    }),
    tags: ['地点'],
    reviewStatus: 'pending',
    sourceChapter: item.firstChapter || null,
    sourceType: 'event'
  }))
}

function syncKnowledgeFromMemory(novelId) {
  if (!novelId) {
    throw new Error('syncKnowledgeFromMemory 需要 novelId')
  }

  const characterStore = new CharacterStore(novelId)
  const eventStore = new EventStore(novelId)
  const dependencyStore = new DependencyStore(novelId)

  const characters = characterStore.getAll()
  const events = eventStore.getAll()
  const dependencies = dependencyStore.getAll()

  const entries = []
  characters.forEach(character => {
    entries.push(buildCharacterEntry(character, novelId))
  })
  events.forEach(event => {
    entries.push(buildEventEntry(event, novelId))
  })
  dependencies.forEach(dep => {
    entries.push(buildDependencyEntry(dep, novelId))
  })
  buildLocationEntries(events, novelId).forEach(entry => entries.push(entry))

  entries.forEach(entry => {
    knowledgeEntryDAO.upsertEntry(novelId, entry)
  })

  return {
    total: entries.length
  }
}

module.exports = {
  syncKnowledgeFromMemory
}
