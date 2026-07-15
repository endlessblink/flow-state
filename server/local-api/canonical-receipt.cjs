'use strict'

const { createHash, timingSafeEqual } = require('node:crypto')

const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const PRINTABLE_ASCII_KEY_RE = /^[\x20-\x7e]+$/
const OFFSET_TIMESTAMP_RE = /(?:Z|[+-]\d{2}:\d{2})$/

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validString(value) {
  return typeof value === 'string' && !/[\ud800-\udfff]/u.test(value)
}

function canonicalJson(value, seen = new Set()) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') {
    if (!validString(value)) throw new TypeError('Canonical JSON rejects unpaired surrogate strings')
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('Canonical JSON supports only safe integers')
    return String(value)
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('Canonical JSON rejects cycles')
    seen.add(value)
    try {
      return `[${value.map(item => canonicalJson(item, seen)).join(',')}]`
    } finally {
      seen.delete(value)
    }
  }
  if (object(value)) {
    if (seen.has(value)) throw new TypeError('Canonical JSON rejects cycles')
    const keys = Object.keys(value)
    if (keys.some(key => !PRINTABLE_ASCII_KEY_RE.test(key))) {
      throw new TypeError('Canonical JSON object keys must be printable ASCII')
    }
    seen.add(value)
    try {
      return `{${keys
        .sort()
        .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key], seen)}`)
        .join(',')}}`
    } finally {
      seen.delete(value)
    }
  }
  throw new TypeError('Canonical JSON contains an unsupported value')
}

function canonicalHash(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function timestamp(value) {
  return (
    typeof value === 'string'
    && value.includes('T')
    && OFFSET_TIMESTAMP_RE.test(value)
    && Number.isFinite(Date.parse(value))
  )
}

function digest(value) {
  return typeof value === 'string' && SHA256_HEX_RE.test(value)
}

function secureEqual(left, right) {
  if (!digest(left) || !digest(right)) return false
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}

function invalid(code) {
  return { ok: false, code }
}

function validateCanonicalReceipt(receipt, options = {}) {
  if (
    !object(receipt)
    || receipt.ok !== true
    || !['committed', 'replayed'].includes(receipt.status)
  ) {
    return invalid('not_committed')
  }

  if (
    receipt.replayed !== undefined
    && (
      typeof receipt.replayed !== 'boolean'
      || receipt.replayed !== (receipt.status === 'replayed')
    )
  ) {
    return invalid('replay_mismatch')
  }

  if (
    typeof receipt.operationId !== 'string'
    || !receipt.operationId
    || receipt.operationId !== receipt.operationId.trim()
  ) {
    return invalid('invalid_operation')
  }
  if (
    options.expectedOperationId !== undefined
    && receipt.operationId !== options.expectedOperationId
  ) {
    return invalid('operation_mismatch')
  }

  if (!digest(receipt.requestHash)) return invalid('invalid_request_hash')
  if (
    options.expectedRequestHash !== undefined
    && !secureEqual(receipt.requestHash, options.expectedRequestHash)
  ) {
    return invalid('request_mismatch')
  }

  if (!positiveInteger(receipt.canonicalRevision)) return invalid('invalid_revision')
  if (!positiveInteger(receipt.changeSequence)) return invalid('invalid_sequence')
  if (!timestamp(receipt.committedAt)) return invalid('invalid_timestamp')
  if (!object(receipt.readBack)) return invalid('invalid_read_back')

  const expectedFields = options.expectedFields || {}
  if (
    !object(expectedFields)
    || Object.entries(expectedFields).some(([field, value]) => receipt[field] !== value)
  ) {
    return invalid('identity_mismatch')
  }

  let computedHash
  try {
    computedHash = canonicalHash(receipt.readBack)
  } catch {
    return invalid('unsafe_json')
  }
  if (!secureEqual(receipt.readBackHash, computedHash)) {
    return invalid('read_back_hash_mismatch')
  }

  if (receipt.affected !== undefined) {
    if (!Array.isArray(receipt.affected) || receipt.affected.length === 0) {
      return invalid('invalid_affected_entry')
    }
    const identities = new Set()
    for (const entry of receipt.affected) {
      const identity = object(entry) ? entry.entityId : null
      if (
        typeof identity !== 'string'
        || identities.has(identity)
        || !validateAffectedTaskEntry(entry, {
          entityId: identity,
          action: entry.action,
        }).ok
      ) {
        return invalid('invalid_affected_entry')
      }
      identities.add(identity)
    }
    const primary = receipt.affected[0]
    if (
      primary.entityId !== receipt.entityId
      || primary.entityType !== receipt.entityType
      || primary.canonicalRevision !== receipt.canonicalRevision
      || primary.changeSequence !== receipt.changeSequence
    ) {
      return invalid('invalid_affected_entry')
    }
  }

  if (options.validateReadBack !== undefined) {
    if (typeof options.validateReadBack !== 'function') return invalid('invalid_read_back')
    try {
      if (!options.validateReadBack(receipt.readBack)) return invalid('invalid_read_back')
    } catch {
      return invalid('invalid_read_back')
    }
  }
  return { ok: true }
}

function validateAffectedTaskEntry(entry, options = {}) {
  if (
    !object(entry)
    || typeof options.entityId !== 'string'
    || options.entityId.length === 0
    || typeof options.action !== 'string'
    || options.action.length === 0
    || entry.entityType !== 'task'
    || entry.entityId !== options.entityId
    || entry.action !== options.action
    || !positiveInteger(entry.canonicalRevision)
    || !positiveInteger(entry.changeSequence)
    || !object(entry.readBack)
    || entry.readBack.id !== entry.entityId
    || entry.readBack.canonicalRevision !== entry.canonicalRevision
    || !timestamp(entry.readBack.canonicalUpdatedAt)
  ) {
    return invalid('invalid_affected_entry')
  }

  let computedHash
  try {
    computedHash = canonicalHash(entry.readBack)
  } catch {
    return invalid('unsafe_json')
  }
  if (!secureEqual(entry.readBackHash, computedHash)) {
    return invalid('affected_read_back_hash_mismatch')
  }
  return { ok: true }
}

module.exports = {
  canonicalHash,
  canonicalJson,
  validateAffectedTaskEntry,
  validateCanonicalReceipt,
}
