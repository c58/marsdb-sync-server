[MarsDB DDP Server](https://github.com/c58/marsdb-sync-server)
=========

[![Build Status](https://travis-ci.org/c58/marsdb-sync-server.svg?branch=master)](https://travis-ci.org/c58/marsdb-sync-server)
[![npm version](https://badge.fury.io/js/marsdb-sync-server.svg)](https://www.npmjs.com/package/marsdb-sync-server)
[![Coverage Status](https://coveralls.io/repos/c58/marsdb-sync-server/badge.svg?branch=master&service=github)](https://coveralls.io/github/c58/marsdb-sync-server?branch=master)
[![Dependency Status](https://david-dm.org/c58/marsdb-sync-server.svg)](https://david-dm.org/c58/marsdb-sync-server)

MarsDB DDP server based on a [DDP](https://github.com/meteor/meteor/blob/devel/packages/ddp/DDP.md) protocol, introduced in Meteor. It supports **methods**, **pub/sub** and **collection operations** (insert/update/remove).

## Features

* **Asynchonous server** – no Fibers
* **Reactive joins in publish** – out of the box
* **Framework agnostic** – configured upon node.js's http server
* **Easy to test and play** – no MongoDB needed, MarsDB works with memory by default

## WARNING

It's only a concept until 1.0. Use it for your own risk.

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
MarsSync.configure({ server: server });

// You must require all your models, publishers and methods.
// They will be registered in MarsSync server.
requireDir('./js/models');
requireDir('./js/publishers');
requireDir('./js/methods');

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

## Roadmap
* Context customization by other modules
* Documentation

## Contributing
I'm waiting for your pull requests and issues.
Don't forget to execute `gulp lint` before requesting. Accepted only requests without errors.

## License
See [License](LICENSE)
