'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._handleNewConnection = _handleNewConnection;
exports.configure = configure;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _marsdb = require('marsdb');

var _marsdb2 = _interopRequireDefault(_marsdb);

var _ws = require('ws');

var _DDPConnection = require('./DDPConnection');

var _DDPConnection2 = _interopRequireDefault(_DDPConnection);

var _MethodCallManager = require('./MethodCallManager');

var _MethodCallManager2 = _interopRequireDefault(_MethodCallManager);

var _SubscriptionManager = require('./SubscriptionManager');

var _SubscriptionManager2 = _interopRequireDefault(_SubscriptionManager);

var _CollectionManager = require('./CollectionManager');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Internals
var _sockjsServer = null;

/**
 * Wrap a connection with DDPConnection wrapper
 * and start handling connection with managers
 * (Collection, Subscription and MethodCall)
 * @param  {WebSocketConnection} connection
 * @return {DDPConnection}
 */
function _handleNewConnection(connection) {
  var ddpConn = new _DDPConnection2.default(connection);
  ddpConn.methodsManager = new _MethodCallManager2.default(ddpConn);
  ddpConn.subManager = new _SubscriptionManager2.default(ddpConn);
  return ddpConn;
}

/**
 * Configure MarsDB for registering new collection in a registry
 * and create SockJS server with given prefix endpoint.
 */
function configure(_ref) {
  var server = _ref.server;
  var _ref$options = _ref.options;
  var options = _ref$options === undefined ? {} : _ref$options;

  (0, _invariant2.default)(!_sockjsServer, 'configure(...): sync server already configured');

  _marsdb2.default.defaultDelegate((0, _CollectionManager.createCollectionManager)());
  _sockjsServer = new _ws.Server(_extends({}, options, { server: server }));
  _sockjsServer.on('connection', _handleNewConnection);
}