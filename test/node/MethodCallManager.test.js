import MethodCallManager, { method, _cleanMethods } from '../../lib/MethodCallManager';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('MethodCallManager', function () {
  beforeEach(function () {
    _cleanMethods();
  });

  describe('#method', function () {
    it('should set new method', function () {
      const cb = sinon.spy();
      method('test', cb);
      cb.should.have.callCount(0);
    });

    it('should rise an exception if method already defined', function () {
      const cb = sinon.spy();
      method('test', cb);
      (() => method('test', cb)).should.throw(Error);
      cb.should.have.callCount(0);
    });

    it('should rise an exception if method is not a function', function () {
      (() => method('test', 'ssdf')).should.throw(Error);
      (() => method('test', 3123)).should.throw(Error);
      (() => method('test', {})).should.throw(Error);
    });
  });

  describe('#_handleMethodCall', function () {
    it('should call registered method and return method result', function () {
      const cb = sinon.spy();
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        emit: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const manager = new MethodCallManager(connMock);
      method('test', (...args) => {
        cb(...args);
        return 'passed';
      });

      connMock.on.should.have.callCount(1);
      cb.should.have.callCount(0);
      connMock.on.getCall(0).args[0].should.be.equal('message:method');
      connMock.on.getCall(0).args[1].should.be.a('function');
      const handler = connMock.on.getCall(0).args[1];

      const res = handler({
        method: 'test',
        params: [1, 2, 3],
        id: 'my_id',
      });
      cb.should.have.callCount(1);
      cb.getCall(0).args.should.have.length(4);
      cb.getCall(0).args.should.be.deep.equal([{
        connection: connMock,
        randomSeed: undefined,
      }, 1, 2, 3]);

      res.should.be.instanceof(Promise);
      return res.then((res) => {
        res.should.be.equal('passed');
        connMock.sendResult.should.have.callCount(1);
        connMock.sendUpdated.should.have.callCount(1);
        connMock.sendResult.getCall(0).args.should.be.deep.equal(['my_id', 'passed']);
        connMock.sendUpdated.getCall(0).args.should.be.deep.equal(['my_id']);
      })
    });

    it('should rise an exception if given method not exists', function () {
      const connMock = {
        on: sinon.spy(),
        emit: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() }
      };
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];

      (() => handler({method: 'no'})).should.throw(Error);
      (() => handler({method: null})).should.throw(Error);
      (() => handler({method: undefined})).should.throw(Error);
      (() => handler({})).should.throw(Error);
      (() => handler()).should.throw(Error);
      (() => handler('123')).should.throw(Error);
    });

    it('should work without params and id', function () {
      const cb = sinon.spy();
      const connMock = { on: sinon.spy() };
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      const ctx = {
        connection: connMock,
        randomSeed: undefined,
      };
      method('test', cb);

      handler({method: 'test'});
      cb.getCall(0).args.should.be.deep.equal([ctx]);
      handler({method: 'test', params: []});
      cb.getCall(0).args.should.be.deep.equal([ctx]);
      handler({method: 'test', params: undefined});
      cb.getCall(0).args.should.be.deep.equal([ctx]);
    });

    it('should resolve returned by method promise', function () {
      const cb = () => new Promise((resolve, reject) => resolve(123));
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      method('test', cb);
      return handler({method: 'test'}).then((res) => {
        res.should.be.equal(123);
      });
    });

    it('should resolve returned by method array of promises', function () {
      const cb = () => [
        new Promise((resolve, reject) => resolve(123)),
        new Promise((resolve, reject) => resolve(321)),
      ];
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      method('test', cb);
      return handler({method: 'test'}).then((res) => {
        res.should.be.deep.equal([123, 321]);
      });
    });

    it('should send any error as result and update', function () {
      const cb = sinon.stub().throws();
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        emit: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      method('test', cb);
      method('test2', () => {
        return new Promise(() => {
          throw new Error();
        });
      })

      handler({method: 'test_no'});
      connMock.sendResult.getCall(0).args[1].should.be.instanceof(Error);
      connMock.sendUpdated.getCall(0).args.should.be.deep.equal(['']);
      handler({method: 'test'});
      connMock.sendResult.getCall(1).args[1].should.be.instanceof(Error);
      connMock.sendUpdated.getCall(1).args.should.be.deep.equal(['']);
      handler({method: 'test2'}).then(() => {
        connMock.sendResult.getCall(2).args[1].should.be.instanceof(Error);
        connMock.sendUpdated.getCall(2).args.should.be.deep.equal(['']);
      });
    });
  });
});
