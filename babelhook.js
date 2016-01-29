require("babel-register")();

var Collection = require("marsdb").Collection;
var createCollectionManager = require('./lib/CollectionManager').createCollectionManager;
Collection.defaultDelegate(createCollectionManager());