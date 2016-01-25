import _map from 'fast.js/map';
import _each from 'fast.js/forEach';
import { EJSON } from 'marsdb';
import invariant from 'invariant';


// Internal utils
export function _getDocumentsByCursor(cursor, result = {}) {
  const modelName = cursor.db.modelName;
  _each(cursor._latestResult, (doc) => {
    result[modelName] = result[modelName] || {};
    result[modelName][doc._id] = doc;
  });

  _each(cursor._childrenCursors, childCursor => {
    _getDocumentsByCursor(childCursor, result);
  });

  return result;
}

export function _diffDocumentsMap(newDocs, oldDocs) {
  const added = {};
  const removed = {};
  const changed = {};

  const ensureModelName = (modelName) => {
    added[modelName] = added[modelName] || {};
    removed[modelName] = removed[modelName] || {};
    changed[modelName] = changed[modelName] || {};
  };

  _each(newDocs, (docsMap, modelName) => {
    ensureModelName(modelName);
    _each(docsMap, (doc, id) => {
      if (!oldDocs[modelName] || !oldDocs[modelName][id]) {
        added[modelName][id] = doc;
      } else if (
        oldDocs[modelName] && oldDocs[modelName][id] &&
        !EJSON.equals(doc, oldDocs[modelName][id])
      ) {
        changed[modelName][id] = doc;
      }
    });
  });

  _each(oldDocs, (docsMap, modelName) => {
    ensureModelName(modelName);
    _each(docsMap, (doc, id) => {
      if (!newDocs[modelName] || !newDocs[modelName][id]) {
        removed[modelName][id] = doc;
      }
    });
  });

  return { added, removed, changed };
}


/**
 * Observe cursors for change and invoke given callback
 * with added and removed documents.
 */
export class Subscription {
  constructor(cursorsArr, updateCallback) {
    this._callback = updateCallback;
    this._cursors = cursorsArr;
    this._latestResult = {};
  }

  getDocumentsMap() {
    return this._latestResult;
  }

  stop() {
    invariant(
      this._stoppers,
      'stop(...): subscription is not started'
    );
    _each(this._stoppers, (stopper) => stopper.stop());
  }

  start() {
    invariant(
      !this._stoppers,
      'start(...): subscription is already started'
    );
    const stopeprs = _map(this._cursors, cursor =>
      cursor.observe(() => this._handleCursorChange(cursor))
    );
    this._stoppers = stopeprs;
    return Promise.all(stopeprs);
  }

  _handleCursorChange(cursor) {
    const docsMap = _getDocumentsByCursor(cursor);
    const diff = _diffDocumentsMap(docsMap, this._latestResult);
    this._latestResult = docsMap;
    this._callback(diff);
  }
}
