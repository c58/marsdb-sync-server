import _check from 'check-types';
import _each from 'fast.js/forEach';
import _bind from 'fast.js/function/bind';
import invariant from 'invariant';
import Subscription, { diffObjects } from './Subscription';
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
export function _diffObjects(left, right,
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
export function _diffAddedWithRemote(subAdded, remoteDocs) {
  const added = {};

  _each(subAdded, (docs, collName) => {
    remoteDocs[collName] = remoteDocs[collName] || {};
    added[collName] = added[collName] || {};
    _each(docs, (d) => {
      if (!remoteDocs[collName][d._id]) {
        added[collName][d._id] = d;
        remoteDocs[collName][d._id] = { count: 1, doc: d };
      } else {
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
export function _diffChangedWithRemote(subChanged, remoteDocs) {
  const changed = {};

  _each(subChanged, (docs, collName) => {
    changed[collName] = changed[collName] || {};
    _each(docs, (d) => {
      if (remoteDocs[collName] && remoteDocs[collName][d._id]) {
        const remoteDoc = remoteDocs[collName][d._id].doc;
        const changes = { fields: {}, cleared: [] };

        diffObjects(d, remoteDoc, {
          leftOnly: (k, v) => changes.fields[k] = d[k],
          rightOnly: (k, v) => changes.cleared.push(k),
          both: (k, v) => {
            if (!EJSON.equals(d[k], remoteDoc[k])) {
              changes.fields[k] = d[k];
            }
          },
        });

        changed[collName][d._id] = changes;
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
export function _diffRemovedWithRemote(subRemoved, remoteDocs) {
  const removed = {};

  _each(subRemoved, (docs, collName) => {
    _each(docs, (d) => {
      if (remoteDocs[collName] && remoteDocs[collName][d._id]) {
        removed[collName][d._id] = d;
        remoteDocs[collName][d._id].count -= 1;

        if (remoteDocs[collName][d._id].count <= 0) {
          delete remoteDocs[collName][d._id];
        }
      }
    });
  });

  return removed;
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
    this._handleSubscriptionUpdate = _bind(
      this._handleSubscriptionUpdate, this
    );

    ddpConn.on('message:sub', _bind(this._handleSubscribe, this));
    ddpConn.on('message:unsub', _bind(this._handleUnsubscribe, this));
  }

  whenAllCursorsUpdated() {
    // TODO resolve when all observers ready
    return Promise.resolve();
  }

  _handleSubscribe({ id, name, params }) {
    invariant(
      _publishers[name],
      'There is no publisher with name \'%s\'',
      name
    );

    if (!this._subscribed[id]) {
      const fn = _publishers[name];
      const connection = this._ddpConn;
      const result = fn({ connection }, ...params);
      const resultArr = _check.array(result) ? result : [result];
      const sub = new Subscription(resultArr, this._handleSubscriptionUpdate);
      this._subscribed[id] = sub;

      return sub.start().then(() => {
        connection.sendReady(id);
      });
    }
  }

  _handleUnsubscribe({ id }) {
    if (this._subscribed[id]) {
      const sub = this._subscribed[id];
      const connection = this._ddpConn;
      const docsMap = sub.getDocumentsMap();
      const { removed } = this._removeDocuments(docsMap);

      delete this._subscribed[id];
      sub.stop();

      _each(removed, (docs, collName) => {
        _each(docs, (d) => {
          connection.sendRemoved(collName, d._id);
        });
      });

      connection.sendNoSub(id);
    }
  }

  _handleSubscriptionUpdate(res) {
    const { added, changed } = this._appendDocuments(res.added, res.changed);
    const removed = this._removeDocuments(res.removed);
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

  _appendDocuments(subAdded, subChanged) {
    return {
      added: _diffAddedWithRemote(subAdded, this._remoteDocs),
      changed: _diffChangedWithRemote(subChanged, this._remoteDocs),
    };
  }

  _removeDocuments(subRemoved) {
    return _diffRemovedWithRemote(subRemoved, this._remoteDocs);
  }
}
