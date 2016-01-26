import MethodCallManager, { _cleanMethods } from '../../lib/MethodCallManager';
import { createCollectionManager, _registerCollection,
  _clearRegisteredCollections } from '../../lib/CollectionManager';
import Subscription, * as utils from '../../lib/Subscription';
import { Collection, Random } from 'marsdb';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('Subscription', function () {
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

  describe('#_getDocumentsByCursor', function () {
    it('should return all documents by cursor tree', function () {
      const collA = new Collection('a');
      const collB = new Collection('b');
      const collC = new Collection('c');

      return Promise.all([
        collA.insert({a: 1}),
        collB.insert({b: 1}),
        collC.insert({c: 1}),
      ]).then(() => {
        const cursor = collA.find({a: 1}).join(() => [
          collB.find({b: 1}).join(() => [
            collC.find({c: 1}).join(() => [
              collA.find({a: 1}).observe()
            ]).observe()
          ]).observe()
        ]);
        return cursor.observe(() => {}).then(() => {
          const docsMap = utils._getDocumentsByCursor(cursor);
          docsMap.should.have.ownProperty('a');
          docsMap.should.have.ownProperty('b');
          docsMap.should.have.ownProperty('c');
          Object.keys(docsMap.a).should.have.length(1);
          Object.keys(docsMap.b).should.have.length(1);
          Object.keys(docsMap.c).should.have.length(1);
        });
      })
    });
  });

  describe('#_diffDocumentsMap', function () {
    it('should track added in existing collection', function () {
      utils._diffDocumentsMap(
        {a: {asd: {_id: 'asd', tmpField: 1}}},
        {a: {asd_1: {_id: 'asd_1', tmpField: 1}}},
      ).added.a.asd.should.be.deep.equals({_id: 'asd', tmpField: 1});
    });

    it('should track added in NOT existing collection', function () {
      utils._diffDocumentsMap(
        {b: {asd: {_id: 'asd', tmpField: 1}}},
        {a: {asd_1: {_id: 'asd_1', tmpField: 1}}},
      ).added.b.asd.should.be.deep.equals({_id: 'asd', tmpField: 1});
    });

    it('should track added with empty collection', function () {
      utils._diffDocumentsMap(
        {b: {asd: {_id: 'asd', tmpField: 1}}},
        {},
      ).added.b.asd.should.be.deep.equals({_id: 'asd', tmpField: 1});
      utils._diffDocumentsMap(
        {b: {asd: {_id: 'asd', tmpField: 1}}},
        undefined,
      ).added.b.asd.should.be.deep.equals({_id: 'asd', tmpField: 1});
      utils._diffDocumentsMap(
        {b: {asd: {_id: 'asd', tmpField: 1}}}
      ).added.b.asd.should.be.deep.equals({_id: 'asd', tmpField: 1});
    });

    it('should track changed docs', function () {
      utils._diffDocumentsMap(
        {a: {asd: {_id: 'asd', tmpField: 1}}},
        {a: {asd: {_id: 'asd', tmpField: 2}}},
      ).changed.a.asd.should.be.deep.equals({_id: 'asd', tmpField: 1});
      utils._diffDocumentsMap(
        {a: {asd: {_id: 'asd'}}},
        {a: {asd: {_id: 'asd', tmpField: 2}}},
      ).changed.a.asd.should.be.deep.equals({_id: 'asd'});
    });

    it('should track removed docs', function () {
      const a = utils._diffDocumentsMap(
        {},
        {a: {asd: {_id: 'asd', tmpField: 2}}},
      );
      a.removed.a.asd.should.be.deep.equals({_id: 'asd', tmpField: 2});
      a.added.a.should.be.deep.equals({});
      a.changed.a.should.be.deep.equals({});
      const b = utils._diffDocumentsMap(
        undefined,
        {a: {asd: {_id: 'asd', tmpField: 2}}},
      );
      b.removed.a.asd.should.be.deep.equals({_id: 'asd', tmpField: 2});
      b.added.a.should.be.deep.equals({});
      b.changed.a.should.be.deep.equals({});
    });

    it('should return empty diff if nothing changed', function () {
      utils._diffDocumentsMap(
        {a: {asd: {_id: 'asd'}}},
        {a: {asd: {_id: 'asd'}}},
      ).should.be.deep.equals({
        added: {a: {}},
        changed: {a: {}},
        removed: {a: {}},
      });
    });
  });

  describe('#_handleCursorChange', function () {
    it('should invoke callback with diff result and set latest result', function () {
      const collA = new Collection('a');
      const collB = new Collection('b');
      const collC = new Collection('c');

      return Promise.all([
        collA.insert({a: 1, _id: '1'}),
        collB.insert({b: 1, _id: '1'}),
        collC.insert({c: 1, _id: '1'}),
      ]).then(() => {
        const cursor = collA.find({a: 1}).join(() => [
          collB.find({b: 1}).join(() => [
            collC.find({c: 1}).join(() => [
              collA.find({a: 1}).observe()
            ]).observe()
          ]).observe()
        ]);
        return cursor.observe(() => {}).then(() => {
          const cb = sinon.spy();
          const sub = new Subscription([cursor], cb);
          return sub._handleCursorChange(cursor).then(() => {
            cb.should.have.callCount(1);
            cb.getCall(0).args[0].should.be.deep.equal({
              added: {
                a: {'1': {a: 1, _id: '1'}},
                b: {'1': {b: 1, _id: '1'}},
                c: {'1': {c: 1, _id: '1'}},
              },
              changed: {a: {}, b: {}, c: {}},
              removed: {a: {}, b: {}, c: {}},
            });

            const docsMap = sub.getDocumentsMap();
            docsMap.should.have.ownProperty('a');
            docsMap.should.have.ownProperty('b');
            docsMap.should.have.ownProperty('c');
            Object.keys(docsMap.a).should.have.length(1);
            Object.keys(docsMap.b).should.have.length(1);
            Object.keys(docsMap.c).should.have.length(1);
          });
        });
      })
    });
  });

  describe('#start', function () {
    it('should start observing all cursors', function () {
      const collA = new Collection('a');
      const collB = new Collection('b');
      const collC = new Collection('c');

      return Promise.all([
        collA.insert({a: 1, _id: '1'}),
        collB.insert({b: 1, _id: '1'}),
        collC.insert({c: 1, _id: '1'}),
      ]).then(() => {
        const cb = sinon.spy();
        const cursors = [
          collA.find({a: 1}),
          collB.find({b: 1}),
          collC.find({c: 1}),
        ];
        const sub = new Subscription(cursors, cb);
        return sub.start().then((res) => {
          res.should.have.length(3);
          res.should.be.deep.equal([
            [{a: 1, _id: '1'}],
            [{b: 1, _id: '1'}],
            [{c: 1, _id: '1'}],
          ]);
          cb.should.have.callCount(1);
        });
      });
    });

    it('should rise an exception if observing already started', function () {
      const sub = new Subscription();
      sub._stoppers = [];
      (() => sub.start()).should.throw(Error);
    });
  });

  describe('#stop', function () {
    it('should rise an exception if observing NOT started', function () {
      const sub = new Subscription();
      (() => sub.stop()).should.throw(Error);
    });

    it('should stop all observers', function () {
      const sub = new Subscription();
      const stoppers = [
        {stop: sinon.spy()},
        {stop: sinon.spy()},
        {stop: sinon.spy()},
      ];
      sub._latestResult = {a: {}};
      sub._stoppers = stoppers;
      sub.stop();
      expect(sub._stoppers).to.be.undefined;
      expect(sub._latestResult).to.be.undefined;
      stoppers[0].stop.should.have.callCount(1);
      stoppers[1].stop.should.have.callCount(1);
      stoppers[2].stop.should.have.callCount(1);
    });
  });
});
