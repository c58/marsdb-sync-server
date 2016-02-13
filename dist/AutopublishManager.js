'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _memoizee = require('memoizee');

var _memoizee2 = _interopRequireDefault(_memoizee);

var _marsdb = require('marsdb');

var _SubscriptionManager = require('./SubscriptionManager');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Internals
var _publishers = [];

/**
 * Automatically publish all documents in all collections
 * to each client
 */

var AutopublishManager = function () {
  function AutopublishManager(ddpConn) {
    _classCallCheck(this, AutopublishManager);

    // Subscribe to all registered publisher
    // on client connected
    ddpConn.once('connected', function () {
      return (0, _map3.default)(_publishers, function (name) {
        var id = _marsdb.Random.default().id();
        return ddpConn.subManager._handleSubscribe({ id: id, name: name });
      });
    });
  }

  _createClass(AutopublishManager, null, [{
    key: 'configure',
    value: function configure() {
      var _defaultDelegate = _marsdb.Collection.defaultDelegate();

      var RegisterCollectoinDelegate = function (_defaultDelegate2) {
        _inherits(RegisterCollectoinDelegate, _defaultDelegate2);

        function RegisterCollectoinDelegate() {
          var _Object$getPrototypeO;

          _classCallCheck(this, RegisterCollectoinDelegate);

          for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }

          // Register publisher for collection

          var _this = _possibleConstructorReturn(this, (_Object$getPrototypeO = Object.getPrototypeOf(RegisterCollectoinDelegate)).call.apply(_Object$getPrototypeO, [this].concat(args)));

          var publisherName = '_autopublish/' + _this.db.modelName;
          _publishers.push(publisherName);
          (0, _SubscriptionManager.publish)(publisherName, (0, _memoizee2.default)(function () {
            return _this.db.find();
          }));
          return _this;
        }

        return RegisterCollectoinDelegate;
      }(_defaultDelegate);

      _marsdb.Collection.defaultDelegate(RegisterCollectoinDelegate);
    }
  }]);

  return AutopublishManager;
}();

exports.default = AutopublishManager;