import _map from 'fast.js/map';
import memoize from 'memoizee';
import { Collection, Random } from 'marsdb';
import { publish } from './SubscriptionManager';


// Internals
const _publishers = [];

/**
 * Automatically publish all documents in all collections
 * to each client
 */
export default class AutopublishManager {
  constructor(ddpConn) {
    // Subscribe to all registered publisher
    // on client connected
    ddpConn.once('connected', () =>
      _map(_publishers, (name) => {
        const id = Random.default().id();
        return ddpConn.subManager._handleSubscribe({ id, name });
      })
    );
  }

  static configure() {
    const _defaultDelegate = Collection.defaultDelegate();

    class RegisterCollectoinDelegate extends _defaultDelegate {
      constructor(...args) {
        super(...args);

        // Register publisher for collection
        const publisherName = `_autopublish/${this.db.modelName}`;
        _publishers.push(publisherName);
        publish(publisherName, memoize(() => {
          return this.db.find();
        }));
      }
    }
    Collection.defaultDelegate(RegisterCollectoinDelegate);
  }
}
