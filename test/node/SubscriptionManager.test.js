import SubscriptionManager, * as utils from '../../lib/SubscriptionManager';
import { Collection, Random } from 'marsdb';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('SubscriptionManager', function () {
  describe('#_noop', function () {
    it('just noooooop', function () {
      utils._noop();
    });
  });

  describe('#_diffObjects', function () {
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
        remote
      );
      result.should.be.deep.equals({a: {id_1: {_id: 'id_1', a: 1}}});
      remote.should.be.deep.equals({a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}});
    });

    it('should make a new collection in a remote if it is not exists', function () {
      const remote = {b: {}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1}}},
        remote
      );
      result.should.be.deep.equals({a: {id_1: {_id: 'id_1', a: 1}}});
      remote.should.be.deep.equals({
        b: {},
        a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}
      });
    });

    it('should increase remote counter if doc already presented', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1}}},
        remote
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {count: 2, doc: {_id: 'id_1', a: 1}}}});
    });

    it('should ignore changed document and just increase counter', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffAddedWithRemote(
        {a: {id_1: {_id: 'id_1', b: 3}}},
        remote
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {count: 2, doc: {_id: 'id_1', a: 1}}}});
    });
  });

  describe('#_diffChangedWithRemote', function () {
    it('should return changed fields only', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 2}}},
        remote
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": [], fields: {a: 2}}}});
      remote.a.id_1.should.be.deep.equals({count: 1, doc: {_id: 'id_1', a: 2}});
    });

    it('should returned cleared fields', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1'}}},
        remote
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": ['a'], fields: {}}}});
      remote.a.id_1.should.be.deep.equals({count: 1, doc: {_id: 'id_1'}});
    });

    it('should return changed and cleared fields', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1', b: 1}}},
        remote
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": ['a'], fields: {b: 1}}}});
      remote.a.id_1.should.be.deep.equals({count: 1, doc: {_id: 'id_1', b: 1}});
    });

    it('should return empty result if nothing changed', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 1}}},
        remote
      );
      result.should.be.deep.equals({a: {id_1: {"cleared": [], fields: {}}}});
      remote.a.id_1.should.be.deep.equals({count: 1, doc: {_id: 'id_1', a: 1}});
    });

    it('should ignore documents not presented in a remote', function () {
      const remote = {a: {id_1: {count: 1, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffChangedWithRemote(
        {a: {id_2: {_id: 'id_2', a: 1}}},
        remote
      );
      result.should.be.deep.equals({a: {}});
      remote.a.should.be.deep.equals({id_1: {count: 1, doc: {_id: 'id_1', a: 1}}});
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
      const remote = {a: {id_1: {count: 10, doc: {_id: 'id_1', a: 1}}}};
      const result = utils._diffRemovedWithRemote(
        {a: {id_1: {_id: 'id_1', a: 2}}},
        remote
      );
      result.should.be.deep.equals({a: {}});
      remote.should.be.deep.equals({a: {id_1: {count: 9, doc: {_id: 'id_1', a: 1}}}});
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
  });

  describe('#publish', function () {

  });

  describe('#whenAllCursorsUpdated', function () {

  });

  describe('#_handleSubscribe', function () {

  });

  describe('#_handleUnsubscribe', function () {

  });

  describe('#_handleSubscriptionUpdate', function () {

  });

  describe('#_appendDocuments', function () {

  });

  describe('#_removeDocuments', function () {

  });
});
