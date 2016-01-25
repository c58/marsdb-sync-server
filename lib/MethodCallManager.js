import _check from 'check-types';
import _bind from 'fast.js/function/bind';
import invariant from 'invariant';


// Internals
const _methods = {};

/**
 * Register a method in a global methods registry
 */
export function method(name, fn) {
  invariant(
    !_methods[name],
    'method(...): method with name \'%s\' already defined',
    name
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
    ddpConn.on('message:method', _bind(this, this._handleMethodCall));
  }

  _handleMethodCall({ method, params, id, randomSeed }) { //eslint-disable-line no-shadow
    invariant(
      _methods[method],
      'There is no method with name \'%s\'',
      method
    );

    const fn = _methods[method];
    const connection = this._ddpConn;
    const result = fn(...params, { randomSeed, connection });
    const resultPromise = _check.array(result)
      ? Promise.all(result) : Promise.resolve(result);

    return resultPromise.then((fnResult) => {
      connection.sendResult(id, fnResult);
      connection.sendUpdated(id);
    });
  }
}
