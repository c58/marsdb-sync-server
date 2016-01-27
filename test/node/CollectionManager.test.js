import MethodCallManager, { _cleanMethods } from '../../lib/MethodCallManager';
import { createCollectionManager, _registerCollection,
  _clearRegisteredCollections } from '../../lib/CollectionManager';
import { Collection, Random } from 'marsdb';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('CollectionManager', function () {
  let oldDlegate;
  beforeEach(function () {
    oldDlegate = Collection.defaultDelegate();
    _clearRegisteredCollections();
    _cleanMethods();
    Collection.defaultDelegate(createCollectionManager());
  });

  afterEach(function () {
    Collection.defaultDelegate(oldDlegate);
  });

  describe('#_registerCollection', function () {
    it('should register a collection and rise an exception on duplicate', function () {
      const coll = new Collection('test');
      (() => new Collection('test')).should.throw(Error);
    });
  });

  describe('#_remoteInsert', function () {
    it('should insert a document on remote message and return promise', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      return handler({
        method: '/test/insert',
        params: [{a: 1}]
      }).then((docId) => {
        docId.should.be.a('string');
        return coll.findOne({a: 1});
      }).then((doc) => {
        doc.a.should.be.equal(1);
      });
    });

    it('should handle accepted remote insert', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: {
          whenAllCursorsUpdated: () => Promise.resolve(),
          _handleAcceptedRemoteInsert: sinon.spy(),
        },
      };
      const seed = Random.default().id(20);
      const sequenceSeed = [seed, `/collection/test`];
      const seededID = Random.createWithSeeds.apply(null, sequenceSeed).id(17);
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      return handler({
        method: '/test/insert',
        params: [{a: 1, _id: seededID}],
        randomSeed: seed,
      }).then((docId) => {
        connMock.subManager._handleAcceptedRemoteInsert.should.have.callCount(1);
        connMock.subManager._handleAcceptedRemoteInsert.getCall(0)
          .args[0].should.be.deep.equal({a: 1, _id: seededID});
        connMock.subManager._handleAcceptedRemoteInsert.getCall(0)
          .args[1].should.be.deep.equal('test');
      });
    });
  });

  describe('#_remoteUpdate', function () {
    it('should update a document on remote message and return promise', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];

      return coll.insert({a: 1}).then(() => {
        return handler({
          method: '/test/update',
          params: [{a: 1}, {$set: {a: 2}}]
        });
      }).then((res) => {
        return Promise.all([
          coll.findOne({a: 1}),
          coll.findOne({a: 2}),
        ]);
      }).then((res) => {
        expect(res[0]).to.be.undefined;
        res[1].a.should.be.equal(2);
      });
    });
  });

  describe('#_remoteRemove', function () {
    it('should remove a document on remote message and return promise', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];

      return coll.insert({a: 1}).then(() => {
        return handler({
          method: '/test/remove',
          params: [{a: 1}]
        });
      }).then((res) => {
        return coll.findOne({a: 1});
      }).then((res) => {
        expect(res).to.be.undefined;
      });
    });
  });

  describe('#_ensureDocumentId', function () {
    it('should ignore ensuring if no id or no seed provided', function () {
      const connMock = { sendRemoved: sinon.spy() };
      const coll = new Collection('test');
      const doc = {a: 1};
      coll.delegate._ensureDocumentId(doc);
      expect(doc._id).to.be.undefined;
      connMock.sendRemoved.should.have.callCount(0);
    });

    it('should remove id if no randomSeed provided', function () {
      const connMock = { sendRemoved: sinon.spy() };
      const coll = new Collection('test');
      const testIt = (randomSeed) => {
        let doc = {a: 1, _id: '1'};
        coll.delegate._ensureDocumentId(doc, connMock, randomSeed);
        expect(doc._id).to.be.undefined;
      };

      testIt('');
      testIt('13');
      testIt(1234);
      testIt({});
      testIt(new Date());
      testIt('hfkgjhsdlkfhjgslkdjhgsljhlakhdflakdjsf');
      testIt(Random.default().id(20));
    });

    it('should accept id if generated id is equal', function () {
      const seed = Random.default().id(20);
      const sequenceSeed = [seed, `/collection/test`];
      const seededID = Random.createWithSeeds.apply(null, sequenceSeed).id(17);
      const connMock = { sendRemoved: sinon.spy() };
      const coll = new Collection('test');
      const doc = {a: 1, _id: seededID};
      coll.delegate._ensureDocumentId(doc, connMock, seed);
      expect(doc._id).to.be.equal(seededID);
      connMock.sendRemoved.should.have.callCount(0);
    });
  });
});
