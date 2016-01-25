module.exports = {
  method: require('./dist/MethodCallManager').method,
  publish: require('./dist/SubscriptionManager').publish,
  configure: require('./dist').configure
};
