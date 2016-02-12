'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._clearRegisteredCollections = _clearRegisteredCollections;
exports._registerCollection = _registerCollection;
exports.createCollectionManager = createCollectionManager;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _marsdb = require('marsdb');

var _MethodCallManager = require('./MethodCallManager');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Internals
var _definedCollections = {};

/**
 * Remove all defined collections from registry
 * (for testing)
 */
function _clearRegisteredCollections() {
  (0, _forEach2.default)(_definedCollections, function (fn, name) {
    delete _definedCollections[name];
  });
}

/**
 * Register a collection in an internal collection registry
 * This registry will be used for insert/update/remove
 * operations received from clients.
 * @param  {Collection} coll
 */
function _registerCollection(coll, manager) {
  (0, _invariant2.default)(!_definedCollections[coll.modelName], '_registerCollection(...): collection is already registered');

  var modelName = coll.modelName;
  _definedCollections[modelName] = 1;
  (0, _MethodCallManager.method)('/' + modelName + '/insert', (0, _bind3.default)(manager._remoteInsert, manager));
  (0, _MethodCallManager.method)('/' + modelName + '/update', (0, _bind3.default)(manager._remoteUpdate, manager));
  (0, _MethodCallManager.method)('/' + modelName + '/remove', (0, _bind3.default)(manager._remoteRemove, manager));
  (0, _MethodCallManager.method)('/' + modelName + '/sync', (0, _bind3.default)(manager._remoteSync, manager));
}

/**
 * Creates a CollectionManager class that extends current default
 * collection delegate class
 * @return {Class[CollectionManager]}
 */
function createCollectionManager() {
  var _currentDelegateClass = _marsdb.Collection.defaultDelegate();

  /**
   * Per-connection manager for handling messages with
   * insert/remove/update some collection.
   */

  var CollectionManager = function (_currentDelegateClass2) {
    _inherits(CollectionManager, _currentDelegateClass2);

    function CollectionManager(db) {
      var _Object$getPrototypeO;

      _classCallCheck(this, CollectionManager);

      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      var _this = _possibleConstructorReturn(this, (_Object$getPrototypeO = Object.getPrototypeOf(CollectionManager)).call.apply(_Object$getPrototypeO, [this, db].concat(args)));

      _registerCollection(db, _this);
      return _this;
    }

    _createClass(CollectionManager, [{
      key: '_remoteInsert',
      value: function _remoteInsert(_ref, doc) {
        var randomSeed = _ref.randomSeed;
        var connection = _ref.connection;
        var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

        var isIdValid = this._ensureDocumentId(doc, connection, randomSeed);
        if (!options.waitReady && isIdValid) {
          connection.subManager._handleAcceptedRemoteInsert(doc, this.db.modelName);
        }
        return this.db.insert(doc, options);
      }
    }, {
      key: '_remoteUpdate',
      value: function _remoteUpdate(_ref2, query, modifier, options) {
        var randomSeed = _ref2.randomSeed;
        var connection = _ref2.connection;

        this._ensureDocumentId(modifier, connection, randomSeed);
        return this.db.update(query, modifier, options);
      }
    }, {
      key: '_remoteRemove',
      value: function _remoteRemove(ctx, query, options) {
        return this.db.remove(query, options);
      }
    }, {
      key: '_remoteSync',
      value: function _remoteSync(ctx, remoteIds) {
        return this.db.ids({ _id: { $in: remoteIds } }).then(function (dbIds) {
          remoteIds = new Set(remoteIds);
          (0, _forEach2.default)(dbIds, function (id) {
            return remoteIds.delete(id);
          });
          return [].concat(_toConsumableArray(remoteIds));
        });
      }
    }, {
      key: '_ensureDocumentId',
      value: function _ensureDocumentId(doc, connection, randomSeed) {
        if (doc._id) {
          var acceptId = false;
          if (_checkTypes2.default.string(randomSeed) && randomSeed.length === 20) {
            var sequenceSeed = [randomSeed, '/collection/' + this.db.modelName];
            var seededID = _marsdb.Random.createWithSeeds.apply(null, sequenceSeed).id(17);
            acceptId = doc._id === seededID;
          }

          if (!acceptId) {
            connection.sendRemoved(doc._id);
            delete doc._id;
          } else {
            return true;
          }
        }
        return false;
      }
    }]);

    return CollectionManager;
  }(_currentDelegateClass);

  return CollectionManager;
}