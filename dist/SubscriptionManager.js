'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._noop = _noop;
exports._diffObjects = _diffObjects;
exports._diffAddedWithRemote = _diffAddedWithRemote;
exports._diffChangedWithRemote = _diffChangedWithRemote;
exports._diffRemovedWithRemote = _diffRemovedWithRemote;
exports._clearPublishers = _clearPublishers;
exports.publish = publish;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _values2 = require('fast.js/object/values');

var _values3 = _interopRequireDefault(_values2);

var _keys2 = require('fast.js/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _filter2 = require('fast.js/array/filter');

var _filter3 = _interopRequireDefault(_filter2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _try2 = require('fast.js/function/try');

var _try3 = _interopRequireDefault(_try2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _Subscription = require('./Subscription');

var _Subscription2 = _interopRequireDefault(_Subscription);

var _marsdb = require('marsdb');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Internals
var _publishers = {};
function _noop() {}

/**
 * General helper for diff-ing two objects.
 * @param  {Object} left
 * @param  {Object} right
 * @param  {Function} options.both
 * @param  {Function} options.leftOnly
 * @param  {Function} options.rightOnly
 */
function _diffObjects() {
  var left = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var right = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
  var _ref = arguments[2];
  var _ref$both = _ref.both;
  var both = _ref$both === undefined ? _noop : _ref$both;
  var _ref$leftOnly = _ref.leftOnly;
  var leftOnly = _ref$leftOnly === undefined ? _noop : _ref$leftOnly;
  var _ref$rightOnly = _ref.rightOnly;
  var rightOnly = _ref$rightOnly === undefined ? _noop : _ref$rightOnly;

  (0, _forEach2.default)(left, function (leftValue, key) {
    if (Object.prototype.hasOwnProperty.call(right, key)) {
      both(key, leftValue, right[key]);
    } else {
      leftOnly(key, leftValue);
    }
  });
  (0, _forEach2.default)(right, function (rightValue, key) {
    if (!Object.prototype.hasOwnProperty.call(left, key)) {
      rightOnly(key, rightValue);
    }
  });
}

/**
 * By given documents map added to a subscription and
 * given remote documents map create an object of documents
 * that must be added to the remote.
 * @param  {Object} subAdded
 * @param  {Object} remoteDocs
 * @return {Object}
 */
function _diffAddedWithRemote(subAdded, remoteDocs, subId) {
  var added = {};

  (0, _forEach2.default)(subAdded, function (docs, collName) {
    remoteDocs[collName] = remoteDocs[collName] || {};
    added[collName] = added[collName] || {};
    (0, _forEach2.default)(docs, function (d) {
      var remDoc = remoteDocs[collName][d._id];
      if (!remDoc) {
        added[collName][d._id] = d;
        remoteDocs[collName][d._id] = { count: 1, doc: d, subId: subId };
      } else if (remDoc.subId !== subId) {
        if ((0, _keys3.default)(remDoc.doc).length < (0, _keys3.default)(d).length) {
          remDoc.subId = subId;
          remDoc.doc = d;
          added[collName][d._id] = d;
        }
        remoteDocs[collName][d._id].count += 1;
      }
    });
  });

  return added;
}

/**
 * By given changed documents in a subscription and given
 * remotly available docuemnts create an object with changes
 * that must be changed on the remote
 * @param  {Object} subChanged
 * @param  {Object} remoteDocs
 * @return {Object}
 */
function _diffChangedWithRemote(subChanged, remoteDocs, subId) {
  var changed = {};

  (0, _forEach2.default)(subChanged, function (docs, collName) {
    changed[collName] = changed[collName] || {};
    (0, _forEach2.default)(docs, function (d) {
      var remDoc = remoteDocs[collName] && remoteDocs[collName][d._id];
      if (remDoc && (remDoc.subId === subId || !remDoc.subId)) {
        (function () {
          var remoteDoc = remoteDocs[collName][d._id].doc;
          var changes = { fields: {}, cleared: [] };

          _diffObjects(d, remoteDoc, {
            leftOnly: function leftOnly(k, v) {
              return changes.fields[k] = d[k];
            },
            rightOnly: function rightOnly(k, v) {
              return changes.cleared.push(k);
            },
            both: function both(k, v) {
              if (!_marsdb.EJSON.equals(d[k], remoteDoc[k])) {
                changes.fields[k] = d[k];
              }
            }
          });

          remDoc.subId = subId;
          changed[collName][d._id] = changes;
          remoteDocs[collName][d._id].doc = d;
        })();
      }
    });
  });

  return changed;
}

/**
 * By given list of removed docuements from subscription
 * and given remotly available doucments create a list of
 * documents that must be removed on the remote.
 * @param  {Object} subRemoved
 * @param  {Object} remoteDocs
 * @return {Object}
 */
function _diffRemovedWithRemote(subRemoved, remoteDocs, subId) {
  var removed = {};

  (0, _forEach2.default)(subRemoved, function (docs, collName) {
    removed[collName] = removed[collName] || {};
    (0, _forEach2.default)(docs, function (d) {
      var remDoc = remoteDocs[collName] && remoteDocs[collName][d._id];
      if (remDoc) {
        remDoc.count -= 1;

        if (remDoc.subId === subId) {
          delete remDoc.subId;
        }
        if (remDoc.count <= 0) {
          removed[collName][d._id] = d;
          delete remoteDocs[collName][d._id];
        }
      }
    });
  });

  return removed;
}

/**
 * Remove all registered publishers
 */
function _clearPublishers() {
  (0, _forEach2.default)(_publishers, function (fn, name) {
    delete _publishers[name];
  });
}

/**
 * Register a publisher in a global registry
 */
function publish(name, fn) {
  (0, _invariant2.default)(!_publishers[name], 'publish(...): publisher with name \'%s\' already defined', name);
  (0, _invariant2.default)(_checkTypes2.default['function'](fn), // eslint-disable-line
  'publish(...): publish \'%s\' must be a function');

  _publishers[name] = fn;
}

/**
 * Per-connection manager of subscriptions to publishers
 * Use given connection to listen subscription and
 * unsubscription requests.
 */

var SubscriptionManager = function () {
  function SubscriptionManager(ddpConn) {
    _classCallCheck(this, SubscriptionManager);

    this._ddpConn = ddpConn;
    this._subscribed = {};
    this._remoteDocs = {};

    ddpConn.on('message:sub', (0, _bind3.default)(this._handleSubscribe, this));
    ddpConn.on('message:unsub', (0, _bind3.default)(this._handleUnsubscribe, this));
    ddpConn.once('close', (0, _bind3.default)(this._handleClose, this));
  }

  _createClass(SubscriptionManager, [{
    key: 'whenAllCursorsUpdated',
    value: function whenAllCursorsUpdated() {
      var promises = [];
      (0, _forEach2.default)(this._subscribed, function (sub) {
        return (0, _forEach2.default)(sub._cursors, function (cursor) {
          return promises.push(cursor._updatePromise);
        });
      });
      return Promise.all(promises);
    }
  }, {
    key: 'updateSubscriptions',
    value: function updateSubscriptions() {
      var _this = this;

      return Promise.all((0, _map3.default)((0, _values3.default)(this._subscribed), function (sub) {
        var newCursors = _this._callPublisher(sub.name, sub.params);
        return sub.replaceCursors(newCursors);
      }));
    }
  }, {
    key: '_callPublisher',
    value: function _callPublisher(name, params) {
      var fn = _publishers[name];
      var connection = this._ddpConn;
      var ctx = { data: connection.data, connection: connection };
      var result = fn.apply(undefined, [ctx].concat(_toConsumableArray(params)));
      var resultArr = _checkTypes2.default.array(result) ? result : [result];
      return (0, _filter3.default)(resultArr, function (x) {
        return x;
      });
    }
  }, {
    key: '_handleClose',
    value: function _handleClose() {
      (0, _forEach2.default)(this._subscribed, function (sub) {
        return sub.stop();
      });
      this._subscribed = {};
      this._remoteDocs = {};
    }
  }, {
    key: '_handleSubscribe',
    value: function _handleSubscribe(_ref2) {
      var _this2 = this;

      var id = _ref2.id;
      var name = _ref2.name;
      var _ref2$params = _ref2.params;
      var params = _ref2$params === undefined ? [] : _ref2$params;

      var callResult = (0, _try3.default)(function () {
        (0, _invariant2.default)(_publishers[name], 'There is no publisher with name \'%s\'', name);

        if (!_this2._subscribed[id]) {
          var _ret2 = function () {
            var connection = _this2._ddpConn;
            var cursors = _this2._callPublisher(name, params);
            var callback = (0, _bind3.default)(_this2._handleSubscriptionUpdate, _this2, id);
            var sub = new _Subscription2.default(cursors, callback, name, params);
            _this2._subscribed[id] = sub;

            return {
              v: sub.start().then(function () {
                connection.sendReady(id);
              })
            };
          }();

          if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
        } else {
          return Promise.resolve();
        }
      });

      if (callResult instanceof Error) {
        this._ddpConn.emit('error', { error: callResult, name: name, params: params, id: id });
        this._ddpConn.sendNoSub(id, callResult);
        return Promise.resolve();
      } else {
        return callResult;
      }
    }
  }, {
    key: '_handleUnsubscribe',
    value: function _handleUnsubscribe(_ref3) {
      var _this3 = this;

      var id = _ref3.id;

      if (this._subscribed[id]) {
        var _ret3 = function () {
          var sub = _this3._subscribed[id];
          var connection = _this3._ddpConn;
          var docsMap = sub.getDocumentsMap();
          var removed = _this3._removeDocuments(docsMap);

          delete _this3._subscribed[id];
          sub.stop();

          (0, _forEach2.default)(removed, function (docs, collName) {
            (0, _forEach2.default)(docs, function (d) {
              connection.sendRemoved(collName, d._id);
            });
          });

          connection.sendNoSub(id);
          return {
            v: true
          };
        }();

        if ((typeof _ret3 === 'undefined' ? 'undefined' : _typeof(_ret3)) === "object") return _ret3.v;
      }
      return false;
    }
  }, {
    key: '_handleSubscriptionUpdate',
    value: function _handleSubscriptionUpdate(subId, res) {
      var _appendDocuments2 = this._appendDocuments(res.added, res.changed, subId);

      var added = _appendDocuments2.added;
      var changed = _appendDocuments2.changed;

      var removed = this._removeDocuments(res.removed, subId);
      var connection = this._ddpConn;

      (0, _forEach2.default)(added, function (docs, collName) {
        (0, _forEach2.default)(docs, function (d, id) {
          connection.sendAdded(collName, id, d);
        });
      });
      (0, _forEach2.default)(changed, function (docs, collName) {
        (0, _forEach2.default)(docs, function (d, id) {
          connection.sendChanged(collName, id, d.fields, d.cleared);
        });
      });
      (0, _forEach2.default)(removed, function (docs, collName) {
        (0, _forEach2.default)(docs, function (d, id) {
          connection.sendRemoved(collName, id);
        });
      });
    }
  }, {
    key: '_handleAcceptedRemoteInsert',
    value: function _handleAcceptedRemoteInsert(doc, collName) {
      this._remoteDocs[collName] = this._remoteDocs[collName] || {};
      this._remoteDocs[collName][doc._id] = { count: 0, doc: doc };
    }
  }, {
    key: '_appendDocuments',
    value: function _appendDocuments(subAdded, subChanged, subId) {
      return {
        added: _diffAddedWithRemote(subAdded, this._remoteDocs, subId),
        changed: _diffChangedWithRemote(subChanged, this._remoteDocs, subId)
      };
    }
  }, {
    key: '_removeDocuments',
    value: function _removeDocuments(subRemoved, subId) {
      return _diffRemovedWithRemote(subRemoved, this._remoteDocs, subId);
    }
  }]);

  return SubscriptionManager;
}();

exports.default = SubscriptionManager;