const { computeEffects } = require("./computeEffects")

function createFromClaims(eventClaims, characterClaims, characterStore) {
  const events = []


  for (const ev of eventClaims) {
    const related = characterClaims.filter(
      c => c.relatedEventId === ev.eventId
    )

    const effects = computeEffects(ev, related, characterStore)


    const event = {
      id: ev.eventId,
      t: ev.t,
      chapter: ev.t,
      type: ev.type,
      summary: ev.summary,
      detail: ev.detail,
      actors: ev.actors,
      effects
    }

    events.push(event)
  }

  return events
}

module.exports = { createFromClaims }
