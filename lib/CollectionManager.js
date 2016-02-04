import _check from 'check-types';
import _bind from 'fast.js/function/bind';
import _each from 'fast.js/forEach';
import invariant from 'invariant';
import { Collection, Random } from 'marsdb';
import { method } from './MethodCallManager';


// Internals
const _definedCollections = {};

/**
 * Remove all defined collections from registry
 * (for testing)
 */
export function _clearRegisteredCollections() {
  _each(_definedCollections, (fn, name) => {
    delete _definedCollections[name];
  });
}

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
  method(`/${modelName}/insert`, _bind(manager._remoteInsert, manager));
  method(`/${modelName}/update`, _bind(manager._remoteUpdate, manager));
  method(`/${modelName}/remove`, _bind(manager._remoteRemove, manager));
  method(`/${modelName}/sync`, _bind(manager._remoteSync, manager));
}

/**
 * Creates a CollectionManager class that extends current default
 * collection delegate class
 * @return {Class[CollectionManager]}
 */
export function createCollectionManager() {
  const _currentDelegateClass = Collection.defaultDelegate();

  /**
   * Per-connection manager for handling messages with
   * insert/remove/update some collection.
   */
  class CollectionManager extends _currentDelegateClass {
    constructor(db, ...args) {
      super(db, ...args);
      _registerCollection(db, this);
    }

    _remoteInsert({ randomSeed, connection }, doc, options) {
      if (this._ensureDocumentId(doc, connection, randomSeed)) {
        connection.subManager._handleAcceptedRemoteInsert(
          doc, this.db.modelName
        );
      }
      return this.db.insert(doc, options);
    }

    _remoteUpdate({ randomSeed, connection }, query, modifier, options) {
      this._ensureDocumentId(modifier, connection, randomSeed);
      return this.db.update(query, modifier, options)
    }

    _remoteRemove(ctx, query, options) {
      return this.db.remove(query, options);
    }

    _remoteSync(ctx, remoteIds) {
      return this.db.ids({_id: {$in: remoteIds}}).then((dbIds) => {
        remoteIds = new Set(remoteIds);
        _each(dbIds, id => remoteIds.delete(id));
        return [...remoteIds];
      });
    }

    _ensureDocumentId(doc, connection, randomSeed) {
      if (doc._id) {
        let acceptId = false;
        if (_check.string(randomSeed) && randomSeed.length === 20) {
          const sequenceSeed = [randomSeed, `/collection/${this.db.modelName}`];
          const seededID = Random.createWithSeeds.apply(null, sequenceSeed).id(17);
          acceptId = doc._id === seededID;
        }

        if (!acceptId) {
          connection.sendRemoved(doc._id);
          delete doc._id;
        } else {
          return true;
        }
      }
      return false;
    }
  }

  return CollectionManager;
}
