import _map from 'fast.js/map';
import _each from 'fast.js/forEach';
import invariant from 'invariant';
import Collection from 'marsdb';
import { Server as WebSocketServer } from 'ws';
import DDPConnection from './DDPConnection';
import MethodCallManager from './MethodCallManager';
import SubscriptionManager from './SubscriptionManager';
import ErrorManager from './ErrorManager';
import { createCollectionManager } from './CollectionManager';
import AutopublishManager from './AutopublishManager';


// Internals
let _sockjsServer = null;
let _customManagers = [];

/**
 * Wrap a connection with DDPConnection wrapper
 * and start handling connection with managers
 * (Collection, Subscription and MethodCall)
 * @param  {WebSocketConnection} connection
 * @return {DDPConnection}
 */
export function _handleNewConnection(connection) {
  const ddpConn = new DDPConnection(connection);
  ddpConn.customManagers = _map(_customManagers, (m) => new m(ddpConn));
  ddpConn.methodsManager = new MethodCallManager(ddpConn);
  ddpConn.subManager = new SubscriptionManager(ddpConn);
  ddpConn.errorManager = new ErrorManager(ddpConn);
  return ddpConn;
}


/**
 * Configure MarsDB for registering new collection in a registry
 * and create SockJS server with given prefix endpoint.
 */
export function configure({ server, options = {} }) {
  invariant(
    !_sockjsServer,
    'configure(...): sync server already configured'
  );

  // Setup connectino
  Collection.defaultDelegate(createCollectionManager());
  _sockjsServer = new WebSocketServer({ ...options, server });
  _sockjsServer.on('connection', _handleNewConnection);
  _customManagers = options.managers || [];

  // Add AutopublishManager to the managers list.
  // It also can be added manually.
  if (options.autoPublish) {
    _customManagers.push(AutopublishManager);
  }

  // Configure custom managers
  _each(_customManagers, (man) => {
    if (man.configure) {
      man.configure(server, options);
    }
  });
}
