[MarsDB DDP Server](https://github.com/c58/marsdb-sync-server)
=========

[![Build Status](https://travis-ci.org/c58/marsdb-sync-server.svg?branch=master)](https://travis-ci.org/c58/marsdb-sync-server)
[![npm version](https://badge.fury.io/js/marsdb-sync-server.svg)](https://www.npmjs.com/package/marsdb-sync-server)
[![Coverage Status](https://coveralls.io/repos/github/c58/marsdb-sync-server/badge.svg?branch=master)](https://coveralls.io/github/c58/marsdb-sync-server?branch=master)
[![Dependency Status](https://david-dm.org/c58/marsdb-sync-server.svg)](https://david-dm.org/c58/marsdb-sync-server)

It's a Meteor compatible [DDP](https://github.com/meteor/meteor/blob/devel/packages/ddp/DDP.md) server, based on [MarsDB](https://github.com/c58/marsdb), but with major [improvements](https://github.com/c58/marsdb-sync-server#features). It supports **methods**, **pub/sub** and **collection operations**. It have very similar to the original Meteor interface, so, you really knows how to use it, if you are familiar with Meteor. But it also highly customizable, because it can be used with any server, that you passed to a `configure` function. Check out a basic [example](https://github.com/c58/marsdb-sync-server#basic-expresswebpack-example) with express and webpack.

## Features

* **Asynchonous server** – no Fibers
* **Reactive joins in publish** – out of the box
* **Framework agnostic** – configured upon node.js's http server
* **Easy to test and play** – no MongoDB needed, MarsDB works with memory by default

## WARNING

It's only a concept until 1.0. Use it for your own risk.
It does not support scaling, handled only changes happened on one instance. Scaling will be handled by [MarsDB-Mongo](https://github.com/c58/marsdb-mongo) module.

## Examples

### Basic Express/Webpack example
The repository comes with a simple example. To try it out:

```
git clone https://github.com/c58/marsdb-sync-server.git
cd marsdb-sync-server/example && npm install
npm start
```

Then, just point your browser at `http://localhost:3000`.

### Configure a server
```javascript
import http from 'http';
import MarsSync from 'marsdb-sync-server';
import requireDir from 'require-dir';

// Some server configuration
// ...
const server = http.createServer();

// Setup marsdb-sync-server
MarsSync.configure({ server });

// You must require all your models, publishers and methods.
// They will be registered in MarsSync server.
requireDir('./js/models');
requireDir('./js/publishers');
requireDir('./js/methods');

```

### Auto-publish
```javascript
// ...
// Setup marsdb-sync-server with autoPublish enabled
MarsSync.configure({ server, autoPublish: true });

// With {autoPublish: true} all documents in each
// collection will be sent to each newly connected client
```

### Publising
```javascript
import UserModel from '../models/User.model';
import TodoModel from '../models/Todo.model';
import { publish } from 'marsdb-sync-server';

// Publish all todos in a collection and all users,
// who have created todos
publish('allTodos', (ctx, arg1, arg2) => {
  // Publisher always receive first `ctx` arguments,
  // that contains `connection` field for now.
  // In next versions it would be extended by other modules
  return TodoModel.find().join((todo) => [
    // Define joins for each todo, it's not reactive
    // (changed user will not be changed in clients)
    UserModel.find(todo.authorId),

    // ...and this reactive. All changed users will be
    // sended the clients.
    UserModel.find(todo.authorId).observe(),
  ]);

  // Must return a cursor or array of cursors.
});
```

### Methods
```javascript
import { method } from 'marsdb-sync-server';

// Defines a method named 'seyHello'
method('sayHello', (ctx, name = 'unknown') => {
  // First argument the same as in `publish`
  const msg = 'Hello, ' + name;
  return msg;

  // Might return something.
  // If returned promise or array of promises, then an
  // `updated` message sended to a client when all promises
  // will be resolved.
});
```

### Using with MongoDB (and other storages)
By default MarsDB uses memory to store collections. You can easily configure it for using MongoDB (or other [storages](https://github.com/c58/marsdb#plugins)) as a backend.
Just configure MarsDB to use MongoDB **before** any instance of a Collection class created
```javascript
// server.js
import MarsMongo from 'marsdb-mongo';
// DO NOT import Colllection releted modules here
// ...other imports

// ...some server configuration
MarsMongo.configure({ url: 'mongodb://127.0.0.1:27017' });
MarsSync.configure({ server: server });

// Require all Collection releted modules
requireDir('./js/models');
requireDir('./js/publishers');
requireDir('./js/methods');
```

## Roadmap
* Context customization by other modules
* Documentation

## Contributing
I'm waiting for your pull requests and issues.
Don't forget to execute `gulp lint` before requesting. Accepted only requests without errors.

## License
See [License](LICENSE)
