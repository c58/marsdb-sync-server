import AutopublishManager from '../../lib/AutopublishManager';
import SubscriptionManager, { _clearPublishers } from '../../lib/SubscriptionManager';
import { _clearRegisteredCollections } from '../../lib/CollectionManager';
import { _cleanMethods } from '../../lib/MethodCallManager';
import { Collection, Random } from 'marsdb';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('AutopublishManager', function () {
  const _defaultDelegate = Collection.defaultDelegate();
  let connMock;
  beforeEach(function() {
    connMock = {
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
  })
  afterEach(function() {
    Collection.defaultDelegate(_defaultDelegate);
    _clearPublishers();
    _clearRegisteredCollections();
    _cleanMethods();
  })

  describe('Manager', function () {
    it('should automatically subscribe to each coll pub', function () {
      AutopublishManager.configure();
      const coll1 = new Collection('test1');
      const coll2 = new Collection('test2');
      const manager = new AutopublishManager(connMock);
      const subs = new SubscriptionManager(connMock);
      connMock.subManager = subs;

      return Promise.all([
        coll1.insertAll([{a: 1}, {a: 2}]),
        coll2.insertAll([{b: 1}, {b: 2}]),
      ]).then(() => {
        connMock.once.should.have.callCount(2);
        connMock.once.getCall(0).args[0].should.be.equal('connected');
        const handler = connMock.once.getCall(0).args[1];
        return Promise.all(handler());
      }).then((res) => {
        connMock.sendNoSub.should.have.callCount(0);
        connMock.sendAdded.should.have.callCount(4);
      });
    });
  });

  describe('#configure', function () {
    it('should set new CollectionDelegate', function () {
      AutopublishManager.configure();
      Collection.defaultDelegate().should.not.be.equal(_defaultDelegate);
    });

    it('should create publisher for each created collection', function () {
      AutopublishManager.configure();
      const coll1 = new Collection('test1');
      const coll2 = new Collection('test2');
      const subs = new SubscriptionManager(connMock);

      return Promise.all([
        coll1.insertAll([{a: 1}, {a: 2}]),
        coll2.insertAll([{b: 1}, {b: 2}]),
      ]).then(() => {
        return Promise.all([
          subs._handleSubscribe({id: 1, name: '_autopublish/test1'}),
          subs._handleSubscribe({id: 2, name: '_autopublish/test2'}),
          subs._handleSubscribe({id: 3, name: '_autopublish/test3'}),
        ]).then((res) => {
          connMock.sendNoSub.should.have.callCount(1);
          connMock.sendAdded.should.have.callCount(4);
        });
      });
    });

    it('should throw an error if collection with given name already created', function () {
      AutopublishManager.configure();
      const coll1 = new Collection('test1');
      (() => new Collection('test1')).should.throw(Error);
    });

    it('should memoize cursor for each collection', function () {
      AutopublishManager.configure();
      const coll1 = new Collection('test1');
      const subs = new SubscriptionManager(connMock);
      sinon.spy(coll1, "find");

      return Promise.all([
        subs._handleSubscribe({id: 1, name: '_autopublish/test1'})
      ]).then((res) => {
        coll1.find.should.have.callCount(1);
        return subs._handleSubscribe({id: 2, name: '_autopublish/test1'});
      }).then(() => {
        coll1.find.should.have.callCount(1);
      });
    });
  });
});
