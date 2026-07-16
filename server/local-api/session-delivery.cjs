'use strict'

function validGeneration(value) {
  return Number.isSafeInteger(value) && value > 0
}

function createSessionDelivery({
  constructContext,
  applyContext,
  invalidateContext = () => {},
  postMessage,
  onError = () => {},
}) {
  let latestGeneration = 0
  let epoch = 0

  async function apply(message) {
    const generation = message && message.generation
    const requestedUserId = message && message.userId
    if (!validGeneration(generation) || typeof requestedUserId !== 'string' || !requestedUserId) {
      return { applied: false, code: 'invalid_session_delivery' }
    }
    if (generation <= latestGeneration) {
      return { applied: false, code: 'stale_generation' }
    }

    latestGeneration = generation
    const applyEpoch = ++epoch
    invalidateContext()
    try {
      const context = await constructContext(message)
      if (applyEpoch !== epoch || generation !== latestGeneration) {
        return { applied: false, code: 'stale_generation' }
      }
      if (!context || context.userId !== requestedUserId) {
        return { applied: false, code: 'user_mismatch' }
      }

      applyContext(context)
      postMessage({ type: 'sessionApplied', generation, userId: requestedUserId })
      return { applied: true, generation, userId: requestedUserId }
    } catch {
      onError('session_application_failed')
      return { applied: false, code: 'session_application_failed' }
    }
  }

  function clear() {
    epoch += 1
    invalidateContext()
  }

  return { apply, clear }
}

module.exports = { createSessionDelivery }
