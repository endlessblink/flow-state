'use strict'

function scopeTaskQuery(context, query) {
  if (context.activeWorkspaceId == null) {
    return query.eq('user_id', context.userId).is('workspace_id', null)
  }
  return query.eq('workspace_id', context.activeWorkspaceId)
}

module.exports = { scopeTaskQuery }
