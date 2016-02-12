'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._handleNewConnection = _handleNewConnection;
exports.configure = configure;

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _ws = require('ws');

var _DDPConnection = require('./DDPConnection');

var _DDPConnection2 = _interopRequireDefault(_DDPConnection);

var _MethodCallManager = require('./MethodCallManager');

var _MethodCallManager2 = _interopRequireDefault(_MethodCallManager);

var _SubscriptionManager = require('./SubscriptionManager');

var _SubscriptionManager2 = _interopRequireDefault(_SubscriptionManager);

var _ErrorManager = require('./ErrorManager');

var _ErrorManager2 = _interopRequireDefault(_ErrorManager);

var _CollectionManager = require('./CollectionManager');

var _AutopublishManager = require('./AutopublishManager');

var _AutopublishManager2 = _interopRequireDefault(_AutopublishManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Internals
var _sockjsServer = null;
var _customManagers = [];

/**
 * Wrap a connection with DDPConnection wrapper
 * and start handling connection with managers
 * (Collection, Subscription and MethodCall)
 * @param  {WebSocketConnection} connection
 * @return {DDPConnection}
 */
function _handleNewConnection() {
  var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var connection = arguments[1];

  var ddpConn = new _DDPConnection2.default(connection);
  ddpConn.data.config = config;
  ddpConn.customManagers = (0, _map3.default)(_customManagers, function (m) {
    return new m(ddpConn);
  });
  ddpConn.methodsManager = new _MethodCallManager2.default(ddpConn);
  ddpConn.subManager = new _SubscriptionManager2.default(ddpConn);
  ddpConn.errorManager = new _ErrorManager2.default(ddpConn);
  return ddpConn;
}

/**
 * Configure MarsDB for registering new collection in a registry
 * and create SockJS server with given prefix endpoint.
 */
function configure() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  (0, _invariant2.default)(!_sockjsServer, 'configure(...): sync server already configured');

  // Setup connectino
  options.collection.defaultDelegate((0, _CollectionManager.createCollectionManager)());
  _sockjsServer = new _ws.Server(options);
  _sockjsServer.on('connection', (0, _bind3.default)(_handleNewConnection, null, options));
  _customManagers = options.managers || [];

  // Add AutopublishManager to the managers list.
  // It also can be added manually.
  if (options.autoPublish) {
    _customManagers.push(_AutopublishManager2.default);
  }

  // Configure custom managers
  (0, _forEach2.default)(_customManagers, function (man) {
    if (man.configure) {
      man.configure(options);
    }
  });
}