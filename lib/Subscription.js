import _map from 'fast.js/map';
import _bind from 'fast.js/function/bind';
import _values from 'fast.js/object/values';
import _each from 'fast.js/forEach';
import { EJSON, debounce } from 'marsdb';
import invariant from 'invariant';


// Internal utils
export function _getDocumentsByCursors(cursors, result = {}) {
  _each(cursors, cursor => {
    const modelName = cursor.db.modelName;

    if (cursor._latestResult) {
      _each(cursor._latestResult, (doc) => {
        result[modelName] = result[modelName] || {};
        result[modelName][doc._id] = doc;
      });
    }

    const childrenCursors = _values(cursor._childrenCursors);
    _getDocumentsByCursors(childrenCursors, result);
  });

  return result;
}

export function _diffDocumentsMap(newDocs = {}, oldDocs = {}) {
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
export default class Subscription {
  constructor(cursorsArr = [], updateCallback, name, params) {
    this.name = name;
    this.params = params;
    this._callback = updateCallback;
    this._cursors = cursorsArr;
    this._latestResult = {};
    this._stoppers = [];
    this._handleCursorChange = debounce(
      _bind(this._handleCursorChange, this),
      1000 / 30, 0
    );
  }

  getDocumentsMap() {
    return this._latestResult;
  }

  stop() {
    _each(this._stoppers, (stopper) => stopper.stop());
    this._stoppers = [];
    this._latestResult = {};
  }

  start() {
    invariant(
      !this._stoppers || this._stoppers.length === 0,
      'start(...): subscription is already started'
    );

    if (this._cursors.length > 0) {
      const stopeprs = _map(this._cursors, cursor =>
        cursor.observe(() => this._handleCursorChange())
      );
      this._stoppers = stopeprs;
      return Promise.all(stopeprs);
    } else {
      return this._handleCursorChange().then(() => []);
    }
  }

  replaceCursors(newCursors) {
    _each(this._stoppers, (stopper) => stopper.stop());
    this._stoppers = [];
    this._cursors = newCursors;
    return this.start();
  }

  _handleCursorChange() {
    const docsMap = _getDocumentsByCursors(this._cursors);
    const diff = _diffDocumentsMap(docsMap, this._latestResult);
    this._latestResult = docsMap;
    this._callback(diff);
  }
}
