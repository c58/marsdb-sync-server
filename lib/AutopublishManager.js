import _each from 'fast.js/forEach';
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
    ddpConn.once('connected', () => {
      _each(_publishers, (name) => {
        const id = Random.default().id();
        ddpConn.subManager._handleSubscribe({ id, name });
      })
    });
  }

  static configure(options = {}) {
    const _defaultDelegate = Collection.defaultDelegate();
    class RegisterCollectoinDelegate {
      constructor(...args) {
        super(...args);

        // Register publisher for collection
        const publisherName = `_autopublish/${this.db.modelName}`;
        const allDocsCursor = this.db.find();
        publish(publisherName, () => allDocsCursor);
        _publishers.push(publisherName);
      }
    }
    Collection.defaultDelegate(RegisterCollectoinDelegate);
  }
}
