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

      return Promise.all([
        collA.insert({a: 1}),
        collB.insert({b: 1}),
      ]).then(() => {
        const cursor = collA.find({a: 1}).join(() => [
          collB.find({b: 1}).observe()
        ]);
        return cursor.observe(() => {}).then(() => {
          const docsMap = utils._getDocumentsByCursor(cursor);
          docsMap.should.have.ownProperty('a');
          docsMap.should.have.ownProperty('b');
          Object.keys(docsMap.a).should.have.length(1);
          Object.keys(docsMap.b).should.have.length(1);
        });
      })
    });
  });

  describe('#_diffDocumentsMap', function () {

  });

  describe('#_handleCursorChange', function () {

  });

  describe('#start', function () {

  });

  describe('#stop', function () {

  });

  describe('#getDocumentsMap', function () {

  });
});
