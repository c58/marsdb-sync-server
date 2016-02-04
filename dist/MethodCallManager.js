'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._cleanMethods = _cleanMethods;
exports.method = method;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _try2 = require('fast.js/function/try');

var _try3 = _interopRequireDefault(_try2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Internals
var _methods = {};

/**
 * Remove all registered methods (for testing)
 */
function _cleanMethods() {
  (0, _forEach2.default)(_methods, function (fn, name) {
    delete _methods[name];
  });
}

/**
 * Register a method in a global methods registry
 */
function method(name, fn) {
  (0, _invariant2.default)(!_methods[name], 'method(...): method with name \'%s\' already defined', name);
  (0, _invariant2.default)(_checkTypes2.default.function(fn), 'method(...): method \'%s\' must be a function');

  _methods[name] = fn;
}

/**
 * Per-connection methods invokation manager. It uses given
 * conenction to listen new incoming method invokation messages.
 */

var MethodCallManager = function () {
  function MethodCallManager(ddpConn) {
    _classCallCheck(this, MethodCallManager);

    this._ddpConn = ddpConn;
    this._handleProcessingError = (0, _bind3.default)(this._handleProcessingError, this);
    ddpConn.on('message:method', (0, _bind3.default)(this._handleMethodCall, this));
  }

  _createClass(MethodCallManager, [{
    key: '_handleMethodCall',
    value: function _handleMethodCall(_ref) {
      var _this = this;

      var method = _ref.method;
      var _ref$params = _ref.params;
      var params = _ref$params === undefined ? [] : _ref$params;
      var _ref$id = _ref.id;
      var id = _ref$id === undefined ? '' : _ref$id;
      var randomSeed = _ref.randomSeed;
      //eslint-disable-line no-shadow
      var callResult = (0, _try3.default)(function () {
        (0, _invariant2.default)(_methods[method], 'There is no method with name \'%s\'', method);

        var fn = _methods[method];
        var connection = _this._ddpConn;
        var ctx = _extends({}, connection.context, { randomSeed: randomSeed, connection: connection });
        var result = fn.apply(undefined, [ctx].concat(_toConsumableArray(params)));
        var resultPromise = _checkTypes2.default.array(result) ? Promise.all(result) : Promise.resolve(result);

        return resultPromise.then(function (fnResult) {
          connection.sendResult(id, fnResult);
          return connection.subManager.whenAllCursorsUpdated().then(function () {
            connection.sendUpdated(id);
            return fnResult;
          });
        }, function (err) {
          return _this._handleProcessingError(id, err);
        });
      });

      if (callResult instanceof Error) {
        this._ddpConn.emit('error', { error: callResult, method: method, params: params, id: id });
        this._handleProcessingError(id, callResult);
        return Promise.resolve();
      } else {
        return callResult;
      }
    }
  }, {
    key: '_handleProcessingError',
    value: function _handleProcessingError(id, err) {
      this._ddpConn.sendResult(id, err);
      this._ddpConn.sendUpdated(id);
    }
  }]);

  return MethodCallManager;
}();

exports.default = MethodCallManager;