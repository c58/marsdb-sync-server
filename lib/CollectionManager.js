import _bind from 'fast.js/function/bind';
import { method } from './MethodCallManager';


// Internals
const _definedCollections = {};
const _currentDelegateClass = Collection.defaultDelegate();


/**
 * Register a collection in an internal collection registry
 * This registry will be used for insert/update/remove
 * operations received from clients.
 * @param  {Collection} coll
 */
export function _registerCollection(coll, manager) {
  invariant(
    !_definedCollections[coll.modelName],
    '_registerCollection(...): collection is already registered'
  );

  const modelName = coll.modelName;
  _definedCollections[modelName] = 1;
  method(`/${modelName}/insert`, _bind(manager, manager._remoteInsert));
  method(`/${modelName}/update`, _bind(manager, manager._remoteUpdate));
  method(`/${modelName}/remove`, _bind(manager, manager._remoteRemove));
}

/**
 * Per-connection manager for handling messages with
 * insert/remove/update some collection.
 */
export default class CollectionManager extends _currentDelegateClass {
  constructor(db, ...args) {
    super(db, ...args);
    _registerCollection(db, this);
  }

  _remoteInsert(doc, { randomSeed }) {
    // TODO
  }

  _remoteUpdate(query, modifier, { randomSeed }) {
    // TODO
  }

  _remoteUpdate(query) {
    // TODO
  }
}
