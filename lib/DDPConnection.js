import _check from 'check-types';
import _keys from 'fast.js/object/keys';
import _try from 'fast.js/function/try';
import _bind from 'fast.js/function/bind';
import { EJSON, Random } from 'marsdb';
import PromiseQueue from 'marsdb/dist/PromiseQueue';
import AsyncEventEmitter from 'marsdb/dist/AsyncEventEmitter';
import HeartbeatManager from './HeartbeatManager';


// Internals
const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT = 15000;

/**
 * WebSocket connection wrapper, that handles incoming messages
 * and emits an appropriate events.
 * While one message is asynchronously processed, another
 * message can't be processed.
 */
export default class DDPConnection extends AsyncEventEmitter {
  constructor(rawConn) {
    super();
    this.context = {};
    this._rawConn = rawConn;
    this._queue = new PromiseQueue(1);
    this._connected = false;
    this._sessionId = null;
    this._heartbeat = new HeartbeatManager(
      HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT
    );

    this._heartbeat.on('timeout', _bind(this._handleHearbeatTimeout, this));
    this._heartbeat.on('sendPing', _bind(this.sendPing, this));
    this._heartbeat.on('sendPong', _bind(this.sendPong, this));
    this._rawConn.on('message', _bind(this._handleRawMessage, this));
    this._rawConn.on('close', _bind(this._handleClose, this));
  }

  sendPing() {
    this._sendMessage({
      msg: 'ping',
      id: Random.default().hexString(20),
    });
  }

  sendPong(id) {
    this._sendMessage({
      msg: 'pong',
      id: id,
    });
  }

  sendReady(idOrArr) {
    const ids = _check.array(idOrArr) ? idOrArr : [idOrArr];
    this._sendMessage({
      msg: 'ready',
      subs: ids,
    });
  }

  sendNoSub(subId, error) {
    const msg = { msg: 'nosub', id: subId };
    if (error && error instanceof Error) {
      msg.error = this._getErrorMessageByObject(error);
    }
    this._sendMessage(msg);
  }

  sendResult(id, result) {
    const msg = { msg: 'result', id: id };
    if (result instanceof Error) {
      msg.error = this._getErrorMessageByObject(result);
    } else {
      msg.result = result;
    }
    this._sendMessage(msg);
  }

  sendUpdated(idOrArr) {
    const ids = _check.array(idOrArr) ? idOrArr : [idOrArr];
    this._sendMessage({
      msg: 'updated',
      methods: ids,
    });
  }

  sendAdded(collName, objId, fields) {
    const msg = { msg: 'added', collection: collName, id: objId };
    if (_check.object(fields)) {
      msg.fields = fields;
      this._sendMessage(msg);
    }
  }

  sendChanged(collName, objId, fields, cleared) {
    const msg = { msg: 'changed', collection: collName, id: objId };
    if (_check.object(fields) && _keys(fields).length > 0) {
      msg.fields = fields;
    }
    if (_check.assigned(cleared) && cleared.length > 0) {
      msg.cleared = _check.array(cleared) ? cleared : [cleared];
    }
    if (msg.fields || msg.cleared) {
      this._sendMessage(msg);
    }
  }

  sendRemoved(collName, objId) {
    this._sendMessage({
      msg: 'removed',
      collection: collName,
      id: objId,
    });
  }

  _sendMessage(msgObj) {
    if (!this._closed) {
      _try(() => this._rawConn.send(EJSON.stringify(msgObj)));
    }
  }

  _getErrorMessageByObject(err) {
    return { error: (err && err.message) || 'unknown error' };
  }

  _handleClose() {
    this._closed = true;
    this._heartbeat._clearTimers();
    this.emit('close');
  }

  _handleRawMessage(rawMsg) {
    return this._queue.add(() => {
      const msgObj = EJSON.parse(rawMsg);
      return this._processMessage(msgObj);
    }).then(null, err =>
      this._handleProcessingError(err)
    );
  }

  _handleProcessingError(err) {
    this._sendMessage({
      msg: 'error',
      reason: (err && err.message) || 'unknown error',
    });
  }

  _processMessage(msg) {
    switch (msg.msg) {
      case 'connect': return this._handleConnectMessage(msg);
      case 'ping': return this._heartbeat.handlePing(msg);
      case 'pong': return this._heartbeat.handlePong(msg);
      case 'method':
      case 'sub':
      case 'unsub':
        if (!this._connected) {
          throw new Error('You are not connected yet');
        }
        return this.emitAsync(`message:${msg.msg}`, msg);
      default:
        throw new Error(`Unknown message type ${msg.msg}`);
    }
  }

  _handleHearbeatTimeout() {
    this._rawConn.close();
  }

  _handleConnectMessage() {
    if (!this._connected) {
      this._connected = true;
      this._sessionId = Random.default().id();
      this._heartbeat.waitPing();
      this._sendMessage({
        msg: 'connected',
        session: this._sessionId,
      });
    }
  }
}
