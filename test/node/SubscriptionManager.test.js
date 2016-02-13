import MethodCallManager, { _cleanMethods } from '../../lib/MethodCallManager';
import { createCollectionManager, _registerCollection,
  _clearRegisteredCollections } from '../../lib/CollectionManager';
import SubscriptionManager, * as utils from '../../lib/SubscriptionManager';
import { Collection, Random } from 'marsdb';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('SubscriptionManager', function () {
  let connMock;
  beforeEach(function () {
    utils._clearPublishers();
    _clearRegisteredCollections();
    _cleanMethods();
    connMock = {
      data: {},
      on: sinon.spy(),
      once: sinon.spy(),
      emit: sinon.spy(),
      sendReady: sinon.spy(),
      sendAdded: sinon.spy(),
      sendRemoved: sinon.spy(),
      sendChanged: sinon.spy(),
      sendNoSub: sinon.spy(),
      subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
    };
  });

  describe('#_noop', function () {
    it('just noooooop', function () {
      utils._noop();
    });
  });

  describe('#_diffObjects', function () {
    it('should accept any combination of callbacks', function () {
      utils._diffObjects({a: 1}, {}, { leftOnly: sinon.spy(), rightOnly: sinon.spy(), both: sinon.spy() });
      utils._diffObjects({a: 1}, {}, { leftOnly: sinon.spy(), rightOnly: sinon.spy() });
      utils._diffObjects({a: 1}, {}, { rightOnly: sinon.spy(), both: sinon.spy() });
      utils._diffObjects({a: 1}, {}, { leftOnly: sinon.spy(), both: sinon.spy() });
    });

    it('should invoke left callback if field is presented in left object', function () {
      const callbacks = { leftOnly: sinon.spy(), rightOnly: sinon.spy(), both: sinon.spy() };
      utils._diffObjects({a: 1}, {}, callbacks);
      utils._diffObjects({a: 1}, undefined, callbacks);
      callbacks.both.should.have.callCount(0);
      callbacks.leftOnly.should.have.callCount(2);
      callbacks.rightOnly.should.have.callCount(0);
    });

    it('should invoke right callback if field is presented in right object', function () {
      const callbacks = { leftOnly: sinon.spy(), rightOnly: sinon.spy(), both: sinon.spy() };
      utils._diffObjects({}, {a: 1}, callbacks);
      utils._diffObjects(undefined, {a: 1}, callbacks);
      callbacks.both.should.have.callCount(0);
      callbacks.leftOnly.should.have.callCount(0);
      callbacks.rightOnly.should.have.callCount(2);
    });

    it('should invoke right and left callbacks', function () {
      const callbacks = { leftOnly: sinon.spy(), rightOnly: sinon.spy(), both: sinon.spy() };
      utils._diffObjects({b: 1}, {a: 1}, callbacks);
      callbacks.both.should.have.callCount(0);
      callbacks.leftOnly.should.have.callCount(1);
      callbacks.rightOnly.should.have.callCount(1);
    });

    it('should invoke both if it is presented in both objects', function () {
      const callbacks = { leftOnly: sinon.spy(), rightOnly: sinon.spy(), both: sinon.spy() };
      utils._diffObjects({a: 1}, {a: 1}, callbacks);
      callbacks.both.should.have.callCount(1);
      callbacks.leftOnly.should.have.callCount(0);
      callbacks.rightOnly.should.have.callCount(0);
    });
  });

  describe('#_diffAddedWithRemote', function () {
    it('should return added document if it is not presented in remote', function () {
      const remote = {a: {}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {id_1: {_id: 'id_1', a: 1}}});
      remote.should.be.deep.equals({a: {id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1}}}});
    });

    it('should make a new collection in a remote if it is not exists', function () {
      const remote = {b: {}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {id_1: {_id: 'id_1', a: 1}}});
      remote.should.be.deep.equals({
        b: {},
        a: {id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1}}}
      });
    });

    it('should increase remote counter if doc already presented', function () {
      const remote = {a: {id_1: {subId: '321', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {count: 2, subId: '321', doc: {_id: 'id_1', a: 1}}}});
    });

    it('should ignore changed document and just increase counter', function () {
      const remote = {a: {id_1: {subId: '321', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', b: 3}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {subId: '321', count: 2, doc: {_id: 'id_1', a: 1}}}});
    });

    it('should change sub owner of a document if doc contains more fields', function () {
      const remote = {a: {id_1: {subId: '321', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1, b: 3}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {id_1: {_id: 'id_1', a: 1, b: 3}}});
      remote.should.be.deep.equals({a: {id_1: {count: 2, subId: '123', doc: {_id: 'id_1', a: 1, b: 3}}}});
    });

    it('should do nothing if doucment for same sub already added', function () {
      const remote = {a: {id_1: {subId: '321', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1}}},
        remote, '321'
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {count: 1, subId: '321', doc: {_id: 'id_1', a: 1}}}});
    });
  });

  describe('#_diffChangedWithRemote', function () {
    it('should return changed fields only', function () {
      const remote = {a: {id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 2}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": [], fields: {a: 2}}}});
      remote.a.id_1.should.be.deep.equals({subId: '123', count: 1, doc: {_id: 'id_1', a: 2}});
    });

    it('should returned cleared fields', function () {
      const remote = {a: {id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1'}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": ['a'], fields: {}}}});
      remote.a.id_1.should.be.deep.equals({subId: '123', count: 1, doc: {_id: 'id_1'}});
    });

    it('should return changed and cleared fields', function () {
      const remote = {a: {id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1', b: 1}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": ['a'], fields: {b: 1}}}});
      remote.a.id_1.should.be.deep.equals({subId: '123', count: 1, doc: {_id: 'id_1', b: 1}});
    });

    it('should return empty result if nothing changed', function () {
      const remote = {a: {id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": [], fields: {}}}});
      remote.a.id_1.should.be.deep.equals({subId: '123', count: 1, doc: {_id: 'id_1', a: 1}});
    });

    it('should ignore documents not presented in a remote', function () {
      const remote = {a: {id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_2: {_id: 'id_2', a: 1}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {}});
      remote.a.should.be.deep.equals({id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1}}});
    });

    it('should change only a document of own subscription', function () {
      const remote = {a: {id_1: {subId: '123', count: 1, doc: {_id: 'id_1', a: 1, b: 2}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 2}}},
        remote, '321'
      );
      result.should.be.deep.equals({a: {}});
      remote.a.id_1.should.be.deep.equals({subId: '123', count: 1, doc: {_id: 'id_1', a: 1, b: 2}});
    });

    it('should change object and own the sub if it have no owners', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1, b: 2}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 2}}},
        remote, '321'
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": ['b'], fields: {a: 2}}}});
      remote.a.id_1.should.be.deep.equals({subId: '321', count: 1, doc: {_id: 'id_1', a: 2}});
    });
  });

  describe('#_diffRemovedWithRemote', function () {
    it('should remove document from remote and return removed doc', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffRemovedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 2}}},
        remote
      );
      result.should.be.deep.equals({a: {id_1: {_id: 'id_1', a: 2}}});
      remote.a.should.be.deep.equals({});
    });

    it('should decrease count in remote of removed document', function () {
      const remote = {a: {id_1: {subId: '123', count: 10, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffRemovedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 2}}},
        remote, '321'
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {subId: '123', count: 9, doc: {_id: 'id_1', a: 1}}}});
    });

    it('should do nothing if document is not presented on remote', function () {
      const remote = {a: {id_1: {count: 10, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffRemovedWithRemote(
        {a: {id_2: {_id: 'id_2', a: 2}}},
        remote
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {count: 10, doc: {_id: 'id_1', a: 1}}}});
    });

    it('should remove owner of document if owner is equsl to removed', function () {
      const remote = {a: {id_1: {subId: '123', count: 10, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffRemovedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 2}}},
        remote, '123'
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {count: 9, doc: {_id: 'id_1', a: 1}}}});
    });
  });

  describe('#publish', function () {
    beforeEach(function () {
      utils._clearPublishers();
    });

    it('should register a publisher', function () {
      utils.publish('test', () => {});
    });

    it('should rise an exception if publisher is already registered', function () {
      utils.publish('test', () => {});
      (() => utils.publish('test', () => {})).should.throw(Error);
    });

    it('should rise an exception if publish is not a function', function () {
      (() => publish('test', 'ssdf')).should.throw(Error);
      (() => publish('test', 3123)).should.throw(Error);
      (() => publish('test', {})).should.throw(Error);
    });
  });

  describe('#_handleClose', function () {
    it('should stop all subs and remove links to subs and documents', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      manager._subscribed = [{stop: cb}, {stop: cb}];
      manager._remoteDocs = {a: {b: 1}};
      manager._handleClose();
      manager._subscribed.should.be.deep.equals({});
      manager._remoteDocs.should.be.deep.equals({});
      cb.should.have.callCount(2);
    });

    it('should be called once on connection emits `close` event', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      connMock.once.should.have.callCount(1);
      connMock.once.getCall(0).args[0].should.be.equals('close');
      manager._subscribed = [{stop: cb}, {stop: cb}];
      connMock.once.getCall(0).args[1]();
      manager._subscribed.should.be.deep.equals({});
      manager._remoteDocs.should.be.deep.equals({});
      cb.should.have.callCount(2);
    });
  });

  describe('#whenAllCursorsUpdated', function () {
    it('should resolve a Promise only when all observers updated', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      const collA = new Collection('a');
      const collB = new Collection('b');
      const collC = new Collection('c');

      return Promise.all([
        collA.insert({a: 1, _id: '1'}),
        collB.insert({b: 1, _id: '1'}),
        collC.insert({c: 1, _id: '1'}),
      ]).then(() => {
        const cursors = [collA.find(), collB.find(), collC.find()];
        const stoppers = cursors.map((c) => c.observe());
        manager._subscribed['1'] = {_cursors: [cursors[0]]}
        manager._subscribed['2'] = {_cursors: [cursors[1]]}
        manager._subscribed['3'] = {_cursors: [cursors[2]]}
        return Promise.all(stoppers).then(() => {
          return Promise.all([
            collA.insert({a: 2, _id: '2'}),
            collB.insert({b: 2, _id: '2'}),
            collC.insert({c: 2, _id: '2'}),
          ]).then(() => {
            return manager.whenAllCursorsUpdated();
          }).then(() => {
            cursors[0]._latestResult.should.deep.equals([{a: 1, _id: '1'}, {a: 2, _id: '2'}]);
            cursors[1]._latestResult.should.deep.equals([{b: 1, _id: '1'}, {b: 2, _id: '2'}]);
            cursors[2]._latestResult.should.deep.equals([{c: 1, _id: '1'}, {c: 2, _id: '2'}]);
          });
        });
      });
    });
  });

  describe('#_handleSubscribe', function () {
    it('should rise an exception if publisher with given name not exists', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      handler({id: '1', name: 'nopub'});
      connMock.sendNoSub.should.have.callCount(1);
      connMock.sendNoSub.getCall(0).args[1].should.be.instanceof(Error);
    });

    it('should make subscription, start it and return promise', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      const collA = new Collection('a');
      const collB = new Collection('b');
      const collC = new Collection('c');

      utils.publish('testPub', (ctx, arg1, arg2 = 'default') => {
        ctx.should.be.deep.equals({connection: connMock, data: {}});
        arg1.should.be.deep.equals('testval');
        arg2.should.be.equals('default');
        return [
          collA.find().join(() => [
            collB.find().join(() => [
              collC.find()
            ])
          ]),
          collA.find()
        ];
      });

      return Promise.all([
        collA.insert({a: 1, _id: '1'}),
        collB.insert({b: 1, _id: '1'}),
        collC.insert({c: 1, _id: '1'}),
      ]).then(() => {
        const handler = connMock.on.getCall(0).args[1];
        return handler({id: '1', name: 'testPub', params: ['testval']}).then(() => {
          connMock.sendAdded.should.have.callCount(3);
          connMock.sendReady.should.have.callCount(1);
        })
      });
    });

    it('should filter out null/undefined result from publisher', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      const collA = new Collection('a');
      const collB = new Collection('b');
      const collC = new Collection('c');

      utils.publish('testPubNull', (ctx) => null);
      utils.publish('testPubNullArr', (ctx) => [null]);
      utils.publish('testPubNullArrWithCur', (ctx) => [null, collA.find()]);
      utils.publish('testPubUndef', (ctx) => undefined);

      return Promise.all([
        collA.insert({a: 1, _id: '1'}),
        collB.insert({b: 1, _id: '1'}),
        collC.insert({c: 1, _id: '1'}),
      ]).then(() => {
        const handler = connMock.on.getCall(0).args[1];
        return handler({id: '1', name: 'testPubNull'}).then(() => {
          connMock.sendAdded.should.have.callCount(0);
          connMock.sendReady.should.have.callCount(1);
        }).then(() =>
          handler({id: '2', name: 'testPubNullArr'}).then(() => {
            connMock.sendAdded.should.have.callCount(0);
            connMock.sendReady.should.have.callCount(2);
          })
        ).then(() =>
          handler({id: '3', name: 'testPubNullArrWithCur'}).then(() => {
            connMock.sendAdded.should.have.callCount(1);
            connMock.sendReady.should.have.callCount(3);
          })
        ).then(() =>
          handler({id: '4', name: 'testPubUndef'}).then(() => {
            connMock.sendAdded.should.have.callCount(1);
            connMock.sendReady.should.have.callCount(4);
          })
        );
      });
    });

    it('should do nothing if subscription with given id already exists', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      utils.publish('testPubNull', (ctx) => null);
      const handler = connMock.on.getCall(0).args[1];
      handler({id: '1', name: 'testPubNull'});
      connMock.emit.should.have.callCount(0);
      handler({id: '1', name: 'testPubNull'});
      connMock.emit.should.have.callCount(0);
      connMock.sendNoSub.should.have.callCount(0);
    });
  });

  describe('#updateSubscriptions', function () {
    it('should recall all publishers and replace cursors for each sub', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      const collA = new Collection('a');
      let reqA = 1;
      utils.publish('testPub', (ctx) => collA.find({a: reqA}));

      return collA.insert({a: 1, _id: '1'}).then(() => {
        const handler = connMock.on.getCall(0).args[1];
        return handler({id: '1', name: 'testPub'}).then(() => {
          connMock.sendRemoved.should.have.callCount(0);
          connMock.sendAdded.should.have.callCount(1);
          connMock.sendReady.should.have.callCount(1);
          reqA = 0;
          return manager.updateSubscriptions();
        }).then(() => {
          connMock.sendRemoved.should.have.callCount(1);
          connMock.sendAdded.should.have.callCount(1);
          connMock.sendReady.should.have.callCount(1);
        });
      });
    });
  });

  describe('#_handleUnsubscribe', function () {
    it('should do nothing if sub with given id not exists', function () {
      const manager = new SubscriptionManager(connMock);
      const handler = connMock.on.getCall(1).args[1];
      handler({id: '123'}).should.be.false;
      handler({id: null}).should.be.false;
      handler({id: undefined}).should.be.false;
      handler({}).should.be.false;
      (() => handler()).should.throw(Error);
    });

    it('should stop sub, remove docs and sent nosub', function () {
      const cb = sinon.spy();
      const manager = new SubscriptionManager(connMock);
      const collA = new Collection('a');
      const collB = new Collection('b');
      const collC = new Collection('c');

      utils.publish('testPub', (ctx, arg1, arg2 = 'default') =>
        collA.find().join(() => [
          collB.find().join(() => [
            collC.find()
          ])
        ])
      );

      return Promise.all([
        collA.insert({a: 1, _id: '1'}),
        collB.insert({b: 1, _id: '1'}),
        collC.insert({c: 1, _id: '1'}),
      ]).then(() => {
        const subscribe = connMock.on.getCall(0).args[1];
        const unsubscribe = connMock.on.getCall(1).args[1];
        return subscribe({id: '1', name: 'testPub', params: ['testval']}).then(() => {
          connMock.sendAdded.should.have.callCount(3);
          connMock.sendReady.should.have.callCount(1);
          unsubscribe({id:'1'}).should.be.true;
          connMock.sendAdded.should.have.callCount(3);
          connMock.sendReady.should.have.callCount(1);
          connMock.sendRemoved.should.have.callCount(3);
          connMock.sendNoSub.should.have.callCount(1);
        })
      });
    });
  });

  describe('#_handleSubscriptionUpdate', function () {
    it('should send all updates to a client', function () {
      const manager = new SubscriptionManager(connMock);
      manager._handleSubscriptionUpdate('123', {
        added: {a: {id1: {_id:'id1', a: 1}}},
        removed: {b: {id1: {_id:'id1', a: 1}}},
        changed: {c: {id1: {_id:'id1', a: 1}}},
      });
      connMock.sendAdded.should.have.callCount(1);
      connMock.sendRemoved.should.have.callCount(0);
      connMock.sendChanged.should.have.callCount(0);

      manager._handleSubscriptionUpdate('123', {
        added: {b: {id1: {_id:'id1', a: 1}}},
        removed: {a: {id2: {_id:'id2', a: 1}}},
        changed: {a: {id1: {_id:'id1', c: 1}}},
      });
      connMock.sendAdded.should.have.callCount(2);
      connMock.sendRemoved.should.have.callCount(0);
      connMock.sendChanged.should.have.callCount(1);

      manager._handleSubscriptionUpdate('123', {
        added: {},
        removed: {b: {id1: {_id:'id1', a: 1}}},
        changed: {},
      });
      connMock.sendAdded.should.have.callCount(2);
      connMock.sendRemoved.should.have.callCount(1);
      connMock.sendChanged.should.have.callCount(1);
    });
  });

  describe('#_handleAcceptedRemoteInsert', function () {
    it('should register in remote a document with zero counter', function () {
      const manager = new SubscriptionManager(connMock);
      manager._handleAcceptedRemoteInsert({a: 1, _id: '1'}, 'test');
      manager._remoteDocs.test['1'].should.be.deep.equals(
        {count: 0, doc: {a: 1, _id: '1'}}
      );
    });
  });
});
