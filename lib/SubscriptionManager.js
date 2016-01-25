import _map from 'fast.js/map';
import _each from 'fast.js/forEach';
import _bind from 'fast.js/function/bind';
import invariant from 'invariant';


// Internals
const _publishers = {};

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
 * Observe cursors for change and invoke given callback
 * with added and removed documents.
 */
export class Subscription {
  constructor(cursorsArr, updateCallback) {
    this._callback = updateCallback;
    this._cursors = cursorsArr;
  }

  getDocumentsMap() {

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
    this._updateCursorsDocs(cursor);
  }

  _updateCursorsDocs(cursor) {
    const newCursorsDocs = this._getDocumentsByCursor(cursor);

    if (!this._currCursorsDocs) {
      this._currCursorsDocs = newCursorsDocs;
    } else {
      const currDocs = this._currCursorsDocs;
      this._currCursorsDocs = {};

      _each(newCursorsDocs, (cursorResult, cursorId) => {
        if (
          !currDocs[cursorId] ||
          currDocs[cursorId].docs !== cursorResult.docs
        ) {
          this._currCursorsDocs[cursorId] = cursorResult;
        }
      });
    }
  }

  _getDocumentsByCursor(cursor, result = {}) {
    result[cursor._id] = {
      modelName: cursor.db.modelName,
      docs: cursor._latestResult,
    };

    _each(cursor._childrenCursors, childCursor => {
      _getDocumentsByCursor(childCursor, result);
    });

    return result;
  }
}

/**
 * Per-connection manager of subscriptions to publishers
 * Use given connection to listen subscription requests
 */
export default class SubscriptionManager {
  constructor(ddpConn) {
    this._ddpConn = ddpConn;
    this._subscribed = {};
    this._remoteDocs = {};
    this._handleSubscriptionUpdate = _bind(this,
      this._handleSubscriptionUpdate);

    ddpConn.on('message:sub', _bind(this, this._handleSubscribe));
    ddpConn.on('message:unsub', _bind(this, this._handleUnsubscribe));
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
      const result = fn(...params, { connection } );
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

  _handleSubscriptionUpdate(addedMap, removedMap) {
    const { added, changed } = this._appendDocuments(addedMap);
    const { removed } = this._removeDocuments(removedMap);

    _each(added, (docs, collName) => {
      _each(docs, (d) => {
        connection.sendAdded(collName, d._id, d);
      });
    });
    _each(changed, (docs, collName) => {
      _each(docs, (d) => {
        connection.sendChanged(collName, d._id, d);
      });
    });
    _each(removed, (docs, collName) => {
      _each(docs, (d) => {
        connection.sendRemoved(collName, d._id);
      });
    });
  }

  _appendDocuments(newDocs) {

  }

  _removeDocuments(removedDocs) {

  }
}
