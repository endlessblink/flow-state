'use strict'

const { createHash } = require('node:crypto')

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function timestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function canonicalString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError('Canonical JSON rejects unpaired surrogate strings')
      }
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError('Canonical JSON rejects unpaired surrogate strings')
    }
  }
  return JSON.stringify(value)
}

function canonicalKey(key) {
  if (![...key].every(character => {
    const code = character.codePointAt(0)
    return code >= 0x20 && code <= 0x7e
  })) {
    throw new TypeError('Canonical JSON object keys must be printable ASCII')
  }
  return canonicalString(key)
}

function canonicalJson(value) {
  if (typeof value === 'string') return canonicalString(value)
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (object(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${canonicalKey(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  throw new TypeError('Canonical JSON supports only safe-integer JSON values')
}

function canonicalHash(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

function postgresJsonbText(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(postgresJsonbText).join(', ')}]`
  if (object(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => Buffer.byteLength(left) - Buffer.byteLength(right) || Buffer.from(left).compare(Buffer.from(right)))
      .map(key => `${JSON.stringify(key)}: ${postgresJsonbText(value[key])}`)
      .join(', ')}}`
  }
  throw new TypeError('PostgreSQL JSONB text supports only finite JSON values')
}

function postgresJsonbHash(value) {
  return createHash('sha256').update(postgresJsonbText(value)).digest('hex')
}

function matchesExpected(receipt, expected) {
  return object(expected) && Object.entries(expected).every(
    ([field, value]) => receipt[field] === value,
  )
}

function validCanonicalReceipt(
  value,
  expected,
  validDomainReadBack,
  acceptedHashers = [canonicalHash],
) {
  if (!object(value) || !matchesExpected(value, expected)) return false
  if (
    !nonEmptyString(value.contractVersion) ||
    !nonEmptyString(value.operationId) ||
    !nonEmptyString(value.source) ||
    !nonEmptyString(value.entityType) ||
    !nonEmptyString(value.action) ||
    !nonEmptyString(value.entityId) ||
    !positiveInteger(value.canonicalRevision) ||
    !timestamp(value.canonicalUpdatedAt) ||
    !positiveInteger(value.changeSequence) ||
    !timestamp(value.committedAt) ||
    typeof value.replayed !== 'boolean' ||
    !object(value.readBack) ||
    value.readBack.id !== value.entityId ||
    value.readBack.canonicalRevision !== value.canonicalRevision ||
    value.readBack.canonicalUpdatedAt !== value.canonicalUpdatedAt ||
    !/^[0-9a-f]{64}$/.test(value.readBackHash || '')
  ) {
    return false
  }

  try {
    if (!acceptedHashers.some(hasher => value.readBackHash === hasher(value.readBack))) return false
  } catch {
    return false
  }
  return typeof validDomainReadBack !== 'function' || validDomainReadBack(value.readBack)
}

module.exports = {
  canonicalJson,
  canonicalHash,
  postgresJsonbText,
  postgresJsonbHash,
  validCanonicalReceipt,
}
