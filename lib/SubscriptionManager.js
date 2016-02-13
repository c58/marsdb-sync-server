import _check from 'check-types';
import _map from 'fast.js/map';
import _values from 'fast.js/object/values';
import _keys from 'fast.js/object/keys';
import _filter from 'fast.js/array/filter';
import _each from 'fast.js/forEach';
import _bind from 'fast.js/function/bind';
import _try from 'fast.js/function/try';
import invariant from 'invariant';
import Subscription from './Subscription';
import { EJSON } from 'marsdb';


// Internals
const _publishers = {};
export function _noop() {}

/**
 * General helper for diff-ing two objects.
 * @param  {Object} left
 * @param  {Object} right
 * @param  {Function} options.both
 * @param  {Function} options.leftOnly
 * @param  {Function} options.rightOnly
 */
export function _diffObjects(left = {}, right = {},
  { both = _noop, leftOnly = _noop, rightOnly = _noop }
) {
  _each(left, (leftValue, key) => {
    if (Object.prototype.hasOwnProperty.call(right, key)) {
      both(key, leftValue, right[key]);
    } else {
      leftOnly(key, leftValue);
    }
  });
  _each(right, (rightValue, key) => {
    if (!Object.prototype.hasOwnProperty.call(left, key)) {
      rightOnly(key, rightValue);
    }
  });
}

/**
 * By given documents map added to a subscription and
 * given remote documents map create an object of documents
 * that must be added to the remote.
 * @param  {Object} subAdded
 * @param  {Object} remoteDocs
 * @return {Object}
 */
export function _diffAddedWithRemote(subAdded, remoteDocs, subId) {
  const added = {};

  _each(subAdded, (docs, collName) => {
    remoteDocs[collName] = remoteDocs[collName] || {};
    added[collName] = added[collName] || {};
    _each(docs, (d) => {
      const remDoc = remoteDocs[collName][d._id];
      if (!remDoc) {
        added[collName][d._id] = d;
        remoteDocs[collName][d._id] = { count: 1, doc: d, subId };
      } else if (remDoc.subId !== subId) {
        if (_keys(remDoc.doc).length < _keys(d).length) {
          remDoc.subId = subId;
          remDoc.doc = d;
          added[collName][d._id] = d;
        }
        remoteDocs[collName][d._id].count += 1;
      }
    });
  });

  return added;
}

/**
 * By given changed documents in a subscription and given
 * remotly available docuemnts create an object with changes
 * that must be changed on the remote
 * @param  {Object} subChanged
 * @param  {Object} remoteDocs
 * @return {Object}
 */
export function _diffChangedWithRemote(subChanged, remoteDocs, subId) {
  const changed = {};

  _each(subChanged, (docs, collName) => {
    changed[collName] = changed[collName] || {};
    _each(docs, (d) => {
      const remDoc = remoteDocs[collName] && remoteDocs[collName][d._id];
      if (remDoc && (remDoc.subId === subId || !remDoc.subId)) {
        const remoteDoc = remoteDocs[collName][d._id].doc;
        const changes = { fields: {}, cleared: [] };

        _diffObjects(d, remoteDoc, {
          leftOnly: (k, v) => changes.fields[k] = d[k],
          rightOnly: (k, v) => changes.cleared.push(k),
          both: (k, v) => {
            if (!EJSON.equals(d[k], remoteDoc[k])) {
              changes.fields[k] = d[k];
            }
          },
        });

        remDoc.subId = subId;
        changed[collName][d._id] = changes;
        remoteDocs[collName][d._id].doc = d;
      }
    });
  });

  return changed;
}

/**
 * By given list of removed docuements from subscription
 * and given remotly available doucments create a list of
 * documents that must be removed on the remote.
 * @param  {Object} subRemoved
 * @param  {Object} remoteDocs
 * @return {Object}
 */
export function _diffRemovedWithRemote(subRemoved, remoteDocs, subId) {
  const removed = {};

  _each(subRemoved, (docs, collName) => {
    removed[collName] = removed[collName] || {};
    _each(docs, (d) => {
      const remDoc = remoteDocs[collName] && remoteDocs[collName][d._id];
      if (remDoc) {
        remDoc.count -= 1;

        if (remDoc.subId === subId) {
          delete remDoc.subId;
        }
        if (remDoc.count <= 0) {
          removed[collName][d._id] = d;
          delete remoteDocs[collName][d._id];
        }
      }
    });
  });

  return removed;
}

/**
 * Remove all registered publishers
 */
export function _clearPublishers() {
  _each(_publishers, (fn, name) => {
    delete _publishers[name];
  });
}

/**
 * Register a publisher in a global registry
 */
export function publish(name, fn) {
  invariant(
    !_publishers[name],
    'publish(...): publisher with name \'%s\' already defined',
    name
  );
  invariant(
    _check['function'](fn),  // eslint-disable-line
    'publish(...): publish \'%s\' must be a function'
  );

  _publishers[name] = fn;
}

/**
 * Per-connection manager of subscriptions to publishers
 * Use given connection to listen subscription and
 * unsubscription requests.
 */
export default class SubscriptionManager {
  constructor(ddpConn) {
    this._ddpConn = ddpConn;
    this._subscribed = {};
    this._remoteDocs = {};

    ddpConn.on('message:sub', _bind(this._handleSubscribe, this));
    ddpConn.on('message:unsub', _bind(this._handleUnsubscribe, this));
    ddpConn.once('close', _bind(this._handleClose, this));
  }

  whenAllCursorsUpdated() {
    const promises = [];
    _each(this._subscribed, (sub) =>
      _each(sub._cursors, (cursor) =>
        promises.push(cursor._updatePromise)
      )
    );
    return Promise.all(promises);
  }

  updateSubscriptions() {
    return Promise.all(_map(_values(this._subscribed), (sub) => {
      const newCursors = this._callPublisher(sub.name, sub.params);
      return sub.replaceCursors(newCursors);
    }));
  }

  _callPublisher(name, params) {
    const fn = _publishers[name];
    const connection = this._ddpConn;
    const ctx = { data: connection.data, connection };
    const result = fn(ctx, ...params);
    const resultArr = _check.array(result) ? result : [result];
    return _filter(resultArr, x => x);
  }

  _handleClose() {
    _each(this._subscribed, sub => sub.stop());
    this._subscribed = {};
    this._remoteDocs = {};
  }

  _handleSubscribe({ id, name, params = [] }) {
    const callResult = _try(() => {
      invariant(
        _publishers[name],
        'There is no publisher with name \'%s\'',
        name
      );

      if (!this._subscribed[id]) {
        const connection = this._ddpConn;
        const cursors = this._callPublisher(name, params);
        const callback = _bind(this._handleSubscriptionUpdate, this, id);
        const sub = new Subscription(cursors, callback, name, params);
        this._subscribed[id] = sub;

        return sub.start().then(() => {
          connection.sendReady(id);
        });
      } else {
        return Promise.resolve();
      }
    });

    if (callResult instanceof Error) {
      this._ddpConn.emit('error', {error: callResult, name, params, id});
      this._ddpConn.sendNoSub(id, callResult);
      return Promise.resolve();
    } else {
      return callResult;
    }
  }

  _handleUnsubscribe({ id }) {
    if (this._subscribed[id]) {
      const sub = this._subscribed[id];
      const connection = this._ddpConn;
      const docsMap = sub.getDocumentsMap();
      const removed = this._removeDocuments(docsMap);

      delete this._subscribed[id];
      sub.stop();

      _each(removed, (docs, collName) => {
        _each(docs, (d) => {
          connection.sendRemoved(collName, d._id);
        });
      });

      connection.sendNoSub(id);
      return true;
    }
    return false;
  }

  _handleSubscriptionUpdate(subId, res) {
    const { added, changed } = this._appendDocuments(
      res.added, res.changed, subId
    );
    const removed = this._removeDocuments(res.removed, subId);
    const connection = this._ddpConn;

    _each(added, (docs, collName) => {
      _each(docs, (d, id) => {
        connection.sendAdded(collName, id, d);
      });
    });
    _each(changed, (docs, collName) => {
      _each(docs, (d, id) => {
        connection.sendChanged(collName, id, d.fields, d.cleared);
      });
    });
    _each(removed, (docs, collName) => {
      _each(docs, (d, id) => {
        connection.sendRemoved(collName, id);
      });
    });
  }

  _handleAcceptedRemoteInsert(doc, collName) {
    this._remoteDocs[collName] = this._remoteDocs[collName] || {};
    this._remoteDocs[collName][doc._id] = { count: 0, doc };
  }

  _appendDocuments(subAdded, subChanged, subId) {
    return {
      added: _diffAddedWithRemote(subAdded, this._remoteDocs, subId),
      changed: _diffChangedWithRemote(subChanged, this._remoteDocs, subId),
    };
  }

  _removeDocuments(subRemoved, subId) {
    return _diffRemovedWithRemote(subRemoved, this._remoteDocs, subId);
  }
}
