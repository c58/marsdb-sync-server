import _check from 'check-types';
import _each from 'fast.js/forEach';
import _bind from 'fast.js/function/bind';
import _try from 'fast.js/function/try';
import invariant from 'invariant';


// Internals
const _methods = {};

/**
 * Remove all registered methods (for testing)
 */
export function _cleanMethods() {
  _each(_methods, (fn, name) => {
    delete _methods[name];
  });
}

/**
 * Register a method in a global methods registry
 */
export function method(name, fn) {
  invariant(
    !_methods[name],
    'method(...): method with name \'%s\' already defined',
    name
  );
  invariant(
    _check.function(fn),
    'method(...): method \'%s\' must be a function'
  );

  _methods[name] = fn;
}

/**
 * Per-connection methods invokation manager. It uses given
 * conenction to listen new incoming method invokation messages.
 */
export default class MethodCallManager {
  constructor(ddpConn) {
    this._ddpConn = ddpConn;
    this._handleProcessingError = _bind(this._handleProcessingError, this);
    ddpConn.on('message:method', _bind(this._handleMethodCall, this));
  }

  _handleMethodCall({ method, params = [], id = '', randomSeed }) { //eslint-disable-line no-shadow
    const callResult = _try(() => {
      invariant(
        _methods[method],
        'There is no method with name \'%s\'',
        method
      );

      const fn = _methods[method];
      const connection = this._ddpConn;
      const ctx = { randomSeed, connection };
      const result = fn(ctx, ...params);
      const resultPromise = _check.array(result)
        ? Promise.all(result) : Promise.resolve(result);

      return resultPromise.then((fnResult) => {
        connection.sendResult(id, fnResult);
        return connection.subManager.whenAllCursorsUpdated().then(() => {
          connection.sendUpdated(id);
          return fnResult;
        })
      }, (err) => this._handleProcessingError(id, err));
    });

    if (callResult instanceof Error) {
      this._handleProcessingError(id, callResult);
      return Promise.resolve();
    } else {
      return callResult;
    }
  }

  _handleProcessingError(id, err) {
    this._ddpConn.sendResult(id, err);
    this._ddpConn.sendUpdated(id);
  }
}
