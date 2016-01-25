import { EventEmitter } from 'marsdb';


/**
 * Extension of a regular EventEmitter that provides a method
 * that returns a Promise then resolved when all listeners of the event
 * will be resolved.
 */
export default class AsyncEventEmitter extends EventEmitter {

  /**
   * Emit an event and return a Promise that will be resolved
   * when all listeren's Promises will be resolved.
   * @param  {String} event
   * @return {Promise}
   */
  emitAsync(event, a1, a2, a3, a4, a5) {
    const prefix = EventEmitter.prefixed;
    const evt = prefix ? prefix + event : event;

    if (!this._events || !this._events[evt]) {
      return Promise.resolve();
    }

    let i;
    const listeners = this._events[evt];
    const len = arguments.length;
    const args;

    if ('function' === typeof listeners.fn) {
      if (listeners.once) {
        this.removeListener(event, listeners.fn, undefined, true);
      }

      switch (len) {
        case 1: return Promise.resolve(listeners.fn.call(listeners.context)), true;
        case 2: return Promise.resolve(listeners.fn.call(listeners.context, a1)), true;
        case 3: return Promise.resolve(listeners.fn.call(listeners.context, a1, a2)), true;
        case 4: return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3)), true;
        case 5: return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3, a4)), true;
        case 6: return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3, a4, a5)), true;
      }

      for (i = 1, args = new Array(len -1); i < len; i++) {
        args[i - 1] = arguments[i];
      }

      return Promise.resolve(listeners.fn.apply(listeners.context, args));
    } else {
      const promises = [];
      const length = listeners.length;
      let j;

      for (i = 0; i < length; i++) {
        if (listeners[i].once) {
          this.removeListener(event, listeners[i].fn, undefined, true);
        }

        switch (len) {
          case 1: promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context))); break;
          case 2: promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context, a1))); break;
          case 3: promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context, a1, a2))); break;
          default:
            if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
              args[j - 1] = arguments[j];
            }

            promises.push(Promise.resolve(listeners[i].fn.apply(listeners[i].context, args)));
        }
      }

      return Promise.all(promises);
    }
  }
}
