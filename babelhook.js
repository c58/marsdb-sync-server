require("babel-register")();

var configure = require('./lib').configure;
configure({
  url: (
    process.env.TEST_MONGO_ADDR
    ? process.env.TEST_MONGO_ADDR
    : 'mongodb://10.211.55.5/mars_mongo_tests'
  )
});
