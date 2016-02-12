'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _keys2 = require('fast.js/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _try2 = require('fast.js/function/try');

var _try3 = _interopRequireDefault(_try2);

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _marsdb = require('marsdb');

var _PromiseQueue = require('marsdb/dist/PromiseQueue');

var _PromiseQueue2 = _interopRequireDefault(_PromiseQueue);

var _AsyncEventEmitter2 = require('marsdb/dist/AsyncEventEmitter');

var _AsyncEventEmitter3 = _interopRequireDefault(_AsyncEventEmitter2);

var _HeartbeatManager = require('./HeartbeatManager');

var _HeartbeatManager2 = _interopRequireDefault(_HeartbeatManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Internals
var HEARTBEAT_INTERVAL = 15000;
var HEARTBEAT_TIMEOUT = 15000;

/**
 * WebSocket connection wrapper, that handles incoming messages
 * and emits an appropriate events.
 * While one message is asynchronously processed, another
 * message can't be processed.
 */

var DDPConnection = function (_AsyncEventEmitter) {
  _inherits(DDPConnection, _AsyncEventEmitter);

  function DDPConnection(rawConn) {
    _classCallCheck(this, DDPConnection);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(DDPConnection).call(this));

    _this.data = {};
    _this._rawConn = rawConn;
    _this._queue = new _PromiseQueue2.default(1);
    _this._connected = false;
    _this._sessionId = null;
    _this._heartbeat = new _HeartbeatManager2.default(HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT);

    _this._heartbeat.on('timeout', (0, _bind3.default)(_this._handleHearbeatTimeout, _this));
    _this._heartbeat.on('sendPing', (0, _bind3.default)(_this.sendPing, _this));
    _this._heartbeat.on('sendPong', (0, _bind3.default)(_this.sendPong, _this));
    _this._rawConn.on('message', (0, _bind3.default)(_this._handleRawMessage, _this));
    _this._rawConn.on('close', (0, _bind3.default)(_this._handleClose, _this));
    return _this;
  }

  _createClass(DDPConnection, [{
    key: 'sendPing',
    value: function sendPing() {
      this._sendMessage({
        msg: 'ping',
        id: _marsdb.Random.default().hexString(20)
      });
    }
  }, {
    key: 'sendPong',
    value: function sendPong(id) {
      this._sendMessage({
        msg: 'pong',
        id: id
      });
    }
  }, {
    key: 'sendReady',
    value: function sendReady(idOrArr) {
      var ids = _checkTypes2.default.array(idOrArr) ? idOrArr : [idOrArr];
      this._sendMessage({
        msg: 'ready',
        subs: ids
      });
    }
  }, {
    key: 'sendNoSub',
    value: function sendNoSub(subId, error) {
      var msg = { msg: 'nosub', id: subId };
      if (error && error instanceof Error) {
        msg.error = this._getErrorMessageByObject(error);
      }
      this._sendMessage(msg);
    }
  }, {
    key: 'sendResult',
    value: function sendResult(id, result) {
      var msg = { msg: 'result', id: id };
      if (result instanceof Error) {
        msg.error = this._getErrorMessageByObject(result);
      } else {
        msg.result = result;
      }
      this._sendMessage(msg);
    }
  }, {
    key: 'sendUpdated',
    value: function sendUpdated(idOrArr) {
      var ids = _checkTypes2.default.array(idOrArr) ? idOrArr : [idOrArr];
      this._sendMessage({
        msg: 'updated',
        methods: ids
      });
    }
  }, {
    key: 'sendAdded',
    value: function sendAdded(collName, objId, fields) {
      var msg = { msg: 'added', collection: collName, id: objId };
      if (_checkTypes2.default.object(fields)) {
        msg.fields = fields;
        this._sendMessage(msg);
      }
    }
  }, {
    key: 'sendChanged',
    value: function sendChanged(collName, objId, fields, cleared) {
      var msg = { msg: 'changed', collection: collName, id: objId };
      if (_checkTypes2.default.object(fields) && (0, _keys3.default)(fields).length > 0) {
        msg.fields = fields;
      }
      if (_checkTypes2.default.assigned(cleared) && cleared.length > 0) {
        msg.cleared = _checkTypes2.default.array(cleared) ? cleared : [cleared];
      }
      if (msg.fields || msg.cleared) {
        this._sendMessage(msg);
      }
    }
  }, {
    key: 'sendRemoved',
    value: function sendRemoved(collName, objId) {
      this._sendMessage({
        msg: 'removed',
        collection: collName,
        id: objId
      });
    }
  }, {
    key: '_sendMessage',
    value: function _sendMessage(msgObj) {
      var _this2 = this;

      if (!this._closed) {
        (0, _try3.default)(function () {
          return _this2._rawConn.send(_marsdb.EJSON.stringify(msgObj));
        });
      }
    }
  }, {
    key: '_getErrorMessageByObject',
    value: function _getErrorMessageByObject(err) {
      return { error: err && err.message || 'unknown error' };
    }
  }, {
    key: '_handleClose',
    value: function _handleClose() {
      this._closed = true;
      this._heartbeat._clearTimers();
      this.emit('close');
    }
  }, {
    key: '_handleRawMessage',
    value: function _handleRawMessage(rawMsg) {
      var _this3 = this;

      return this._queue.add(function () {
        var msgObj = _marsdb.EJSON.parse(rawMsg);
        return _this3._processMessage(msgObj);
      }).then(null, function (err) {
        return _this3._handleProcessingError(err);
      });
    }
  }, {
    key: '_handleProcessingError',
    value: function _handleProcessingError(err) {
      this.emit('error', err);
      this._sendMessage({
        msg: 'error',
        reason: err && err.message || 'unknown error'
      });
    }
  }, {
    key: '_processMessage',
    value: function _processMessage(msg) {
      switch (msg.msg) {
        case 'connect':
          return this._handleConnectMessage(msg);
        case 'ping':
          return this._heartbeat.handlePing(msg);
        case 'pong':
          return this._heartbeat.handlePong(msg);
        case 'method':
        case 'sub':
        case 'unsub':
          if (!this._connected) {
            throw new Error('You are not connected yet');
          }
          return this.emitAsync('message:' + msg.msg, msg);
        default:
          throw new Error('Unknown message type ' + msg.msg);
      }
    }
  }, {
    key: '_handleHearbeatTimeout',
    value: function _handleHearbeatTimeout() {
      this._rawConn.close();
    }
  }, {
    key: '_handleConnectMessage',
    value: function _handleConnectMessage() {
      if (!this._connected) {
        this._connected = true;
        this._sessionId = _marsdb.Random.default().id();
        this._heartbeat.waitPing();
        this._sendMessage({
          msg: 'connected',
          session: this._sessionId
        });
        this.emit('connected');
      }
    }
  }]);

  return DDPConnection;
}(_AsyncEventEmitter3.default);

exports.default = DDPConnection;