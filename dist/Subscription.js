'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._getDocumentsByCursors = _getDocumentsByCursors;
exports._diffDocumentsMap = _diffDocumentsMap;

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _values2 = require('fast.js/object/values');

var _values3 = _interopRequireDefault(_values2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _marsdb = require('marsdb');

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Internal utils
function _getDocumentsByCursors(cursors) {
  var result = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  (0, _forEach2.default)(cursors, function (cursor) {
    var modelName = cursor.db.modelName;

    if (cursor._latestResult) {
      (0, _forEach2.default)(cursor._latestResult, function (doc) {
        result[modelName] = result[modelName] || {};
        result[modelName][doc._id] = doc;
      });
    }

    var childrenCursors = (0, _values3.default)(cursor._childrenCursors);
    _getDocumentsByCursors(childrenCursors, result);
  });

  return result;
}

function _diffDocumentsMap() {
  var newDocs = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var oldDocs = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var added = {};
  var removed = {};
  var changed = {};

  var ensureModelName = function ensureModelName(modelName) {
    added[modelName] = added[modelName] || {};
    removed[modelName] = removed[modelName] || {};
    changed[modelName] = changed[modelName] || {};
  };

  (0, _forEach2.default)(newDocs, function (docsMap, modelName) {
    ensureModelName(modelName);
    (0, _forEach2.default)(docsMap, function (doc, id) {
      if (!oldDocs[modelName] || !oldDocs[modelName][id]) {
        added[modelName][id] = doc;
      } else if (oldDocs[modelName] && oldDocs[modelName][id] && !_marsdb.EJSON.equals(doc, oldDocs[modelName][id])) {
        changed[modelName][id] = doc;
      }
    });
  });

  (0, _forEach2.default)(oldDocs, function (docsMap, modelName) {
    ensureModelName(modelName);
    (0, _forEach2.default)(docsMap, function (doc, id) {
      if (!newDocs[modelName] || !newDocs[modelName][id]) {
        removed[modelName][id] = doc;
      }
    });
  });

  return { added: added, removed: removed, changed: changed };
}

/**
 * Observe cursors for change and invoke given callback
 * with added and removed documents.
 */

var Subscription = function () {
  function Subscription() {
    var cursorsArr = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];
    var updateCallback = arguments[1];

    _classCallCheck(this, Subscription);

    this._callback = updateCallback;
    this._cursors = cursorsArr;
    this._latestResult = {};
    this._stoppers = [];
    this._handleCursorChange = (0, _marsdb.debounce)((0, _bind3.default)(this._handleCursorChange, this), 1000 / 30, 0);
  }

  _createClass(Subscription, [{
    key: 'getDocumentsMap',
    value: function getDocumentsMap() {
      return this._latestResult;
    }
  }, {
    key: 'stop',
    value: function stop() {
      (0, _forEach2.default)(this._stoppers, function (stopper) {
        return stopper.stop();
      });
      this._stoppers = [];
      this._latestResult = {};
    }
  }, {
    key: 'start',
    value: function start() {
      var _this = this;

      (0, _invariant2.default)(!this._stoppers || this._stoppers.length === 0, 'start(...): subscription is already started');
      var stopeprs = (0, _map3.default)(this._cursors, function (cursor) {
        return cursor.observe(function () {
          return _this._handleCursorChange();
        });
      });
      this._stoppers = stopeprs;
      return Promise.all(stopeprs);
    }
  }, {
    key: '_handleCursorChange',
    value: function _handleCursorChange() {
      var docsMap = _getDocumentsByCursors(this._cursors);
      var diff = _diffDocumentsMap(docsMap, this._latestResult);
      this._latestResult = docsMap;
      this._callback(diff);
    }
  }]);

  return Subscription;
}();

exports.default = Subscription;