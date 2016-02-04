import DDPConnection from '../../lib/DDPConnection';
import { Collection, Random, EJSON } from 'marsdb';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('DDPConnection', function () {
  let rawConn, conn;
  beforeEach(function () {
    rawConn = { send: sinon.spy(), on: sinon.spy(), close: sinon.spy() };
    conn = new DDPConnection(rawConn);
  });

  describe('#constructor', function () {
    it('should wait heartbeat ping', function () {

    });
  });

  describe('#_sendMessage', function () {
    it('should send json encoded message', function () {
      conn._sendMessage({a: 1, b: 2});
      rawConn.send.should.have.callCount(1);
      rawConn.send.getCall(0).args[0].should.be.equals(EJSON.stringify({a: 1, b: 2}));
    });

    it('should send message only when not closed', function () {
      conn._sendMessage({a: 1, b: 2});
      rawConn.send.should.have.callCount(1);
      conn._handleClose();
      conn._sendMessage({a: 1, b: 2});
      rawConn.send.should.have.callCount(1);
    });
  });

  describe('Senders', function () {
    beforeEach(function () {
      conn._sendMessage = sinon.spy();
    });

    describe('#sendPing', function () {
      it('should send ping message with newly generated ID', function () {
        conn.sendPing();
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.have.length(20);
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('ping');
      });
    });

    describe('#sendPong', function () {
      it('should send pong with provided id', function () {
        conn.sendPong('123');
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('123');
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('pong');
      });
    });

    describe('#sendUpdated', function () {
      it('should send updated message with given id', function () {
        conn.sendUpdated('123');
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].methods.should.be.deep.equals(['123']);
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('updated');
      });

      it('should accept array of ids', function () {
        conn.sendUpdated(['123', '321']);
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].methods.should.be.deep.equals(['123', '321']);
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('updated');
      });
    });

    describe('#sendResult', function () {
      it('should send result of method with given id', function () {
        conn.sendResult('123', 'some result');
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('123');
        conn._sendMessage.getCall(0).args[0].result.should.be.equals('some result');
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('result');
      });

      it('should send an error if result is Error instance', function () {
        conn.sendResult('123', new Error('some error'));
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('123');
        conn._sendMessage.getCall(0).args[0].should.not.have.ownProperty('result');
        conn._sendMessage.getCall(0).args[0].error.should.be.deep.equals({error: 'some error'});
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('result');
      });
    });

    describe('#sendNoSub', function () {
      it('should send nosub message with provided id', function () {
        conn.sendNoSub('123');
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('123');
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('nosub');
      });

      it('should send nosub with error if second argument is error', function () {
        conn.sendNoSub('123', 'some error text');
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('123');
        conn._sendMessage.getCall(0).args[0].should.not.have.ownProperty('error');
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('nosub');

        conn.sendNoSub('123', new Error('some error'));
        conn._sendMessage.should.have.callCount(2);
        conn._sendMessage.getCall(1).args[0].id.should.be.equals('123');
        conn._sendMessage.getCall(1).args[0].error.should.be.deep.equals({error: 'some error'});
        conn._sendMessage.getCall(1).args[0].msg.should.be.equals('nosub');
      });
    });

    describe('#sendRemoved', function () {
      it('should send removed message with provided id and collection name', function () {
        conn.sendRemoved('my_coll', '123');
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('123');
        conn._sendMessage.getCall(0).args[0].collection.should.be.equals('my_coll');
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('removed');
      });
    });

    describe('#sendReady', function () {
      it('should send ready message with given id', function () {
        conn.sendReady('123');
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].subs.should.be.deep.equals(['123']);
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('ready');
      });

      it('should accept array of ids', function () {
        conn.sendReady(['123', '321']);
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].subs.should.be.deep.equals(['123', '321']);
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('ready');
      });
    });

    describe('#sendChanged', function () {
      it('should send fields and no cleared if not presented', function () {
        conn.sendChanged('coll_name', 'id1', {a: 1});
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('id1');
        conn._sendMessage.getCall(0).args[0].collection.should.be.equals('coll_name');
        conn._sendMessage.getCall(0).args[0].fields.should.be.deep.equals({a: 1});
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('changed');
        conn._sendMessage.getCall(0).args[0].should.not.have.ownProperty('cleared');

        conn.sendChanged('coll_name', 'id1', {});
        conn._sendMessage.should.have.callCount(1);
        conn.sendChanged('coll_name', 'id1', null);
        conn._sendMessage.should.have.callCount(1);
        conn.sendChanged('coll_name', 'id1', undefined);
        conn._sendMessage.should.have.callCount(1);
      });

      it('should send cleared and no fields if not presented', function () {
        conn.sendChanged('coll_name', 'id1', null, ['a', 'b']);
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('id1');
        conn._sendMessage.getCall(0).args[0].collection.should.be.equals('coll_name');
        conn._sendMessage.getCall(0).args[0].cleared.should.be.deep.equals(['a', 'b']);
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('changed');
        conn._sendMessage.getCall(0).args[0].should.not.have.ownProperty('fields');

        conn.sendChanged('coll_name', 'id1', {}, []);
        conn._sendMessage.should.have.callCount(1);
        conn.sendChanged('coll_name', 'id1', null, null);
        conn._sendMessage.should.have.callCount(1);
        conn.sendChanged('coll_name', 'id1', undefined, undefined);
        conn._sendMessage.should.have.callCount(1);

        conn.sendChanged('coll_name', 'id1', {}, 'c');
        conn._sendMessage.should.have.callCount(2);
        conn._sendMessage.getCall(1).args[0].cleared.should.be.deep.equals(['c']);
      });
    });

    describe('#sendAdded', function () {
      it('should send added message with given id', function () {
        conn.sendAdded('coll_name', 'id1', {a: 1});
        conn._sendMessage.getCall(0).args[0].id.should.be.equals('id1');
        conn._sendMessage.getCall(0).args[0].collection.should.be.equals('coll_name');
        conn._sendMessage.getCall(0).args[0].fields.should.be.deep.equals({a: 1});
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('added');
      });

      it('should send message only if given argument is object', function () {
        conn.sendAdded('coll_name', 'id1', '23123');
        conn._sendMessage.should.have.callCount(0);
        conn.sendAdded('coll_name', 'id1', undefined);
        conn._sendMessage.should.have.callCount(0);
        conn.sendAdded('coll_name', 'id1', null);
        conn._sendMessage.should.have.callCount(0);
        conn.sendAdded('coll_name', 'id1', 123123);
        conn._sendMessage.should.have.callCount(0);
        conn.sendAdded('coll_name', 'id1', {});
        conn._sendMessage.should.have.callCount(1);
      });
    });

    describe('#_handleClose', function () {
      it('should emit `close` event and set _closed field', function () {
        const cb = sinon.spy();
        conn.once('close', cb);
        conn._handleClose();
        cb.should.have.callCount(1);
        conn._closed.should.be.true;
      });
    });

    describe('#_getErrorMessageByObject', function () {
      it('should create error object for nosub and result', function () {
        conn._getErrorMessageByObject(null).should.be.deep.equals({error: 'unknown error'});
        conn._getErrorMessageByObject(undefined).should.be.deep.equals({error: 'unknown error'});
        conn._getErrorMessageByObject({}).should.be.deep.equals({error: 'unknown error'});
        conn._getErrorMessageByObject('asd').should.be.deep.equals({error: 'unknown error'});
        conn._getErrorMessageByObject(new Error('some error')).should.be.deep.equals({error: 'some error'});
      });
    });

    describe('#_handleRawMessage', function () {
      it('should return a promise that resolved when message processed', function () {
        conn._processMessage = sinon.spy(() => Promise.resolve());
        const p = conn._handleRawMessage(EJSON.stringify('{"msg": "ping", "id": "123"}'));
        const p1 = conn._handleRawMessage(EJSON.stringify('{"msg": "ping", "id": "123"}'));
        const p2 = conn._handleRawMessage(EJSON.stringify('{"msg": "ping", "id": "123"}'));
        conn._processMessage.should.have.callCount(0);
        return Promise.resolve().then(() => {
          conn._processMessage.should.have.callCount(1);
          return p1.then(() => {
            conn._processMessage.should.have.callCount(3);
          })
        });
      });

      it('should send an error message if error rised while proccessing', function () {
        return conn._handleRawMessage('{"a": 1').then(() => {
              conn._sendMessage.getCall(0).args[0].msg.should.be.equals('error');
              return conn._handleRawMessage('{"msg": "unknown_type"}').then(() => {
                conn._sendMessage.getCall(1).args[0].msg.should.be.equals('error');
                conn._sendMessage.should.have.callCount(2);
              })
          });
      });
    });

    describe('#_handleProcessingError', function () {
      it('should send error message with reason', function () {
        conn._handleProcessingError(null);
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('error');
        conn._sendMessage.getCall(0).args[0].reason.should.be.equals('unknown error');
        conn._handleProcessingError('asda');
        conn._sendMessage.getCall(1).args[0].msg.should.be.equals('error');
        conn._sendMessage.getCall(1).args[0].reason.should.be.equals('unknown error');
        conn._handleProcessingError(new Error('some error'));
        conn._sendMessage.getCall(2).args[0].msg.should.be.equals('error');
        conn._sendMessage.getCall(2).args[0].reason.should.be.equals('some error');
      });
    });

    describe('#_processMessage', function () {
      it('should rise exception if not connected', function () {
        conn.emitAsync = sinon.spy();
        (() => conn._processMessage({msg: 'sub'})).should.throw(Error);
        (() => conn._processMessage({msg: 'ping'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'pong'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'connect'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'sub'})).should.not.throw(Error);
      });
      it('should throw an error if message type is not supported', function () {
        conn.emitAsync = sinon.spy();
        (() => conn._processMessage({msg: 'connect'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'subbbbbb'})).should.throw(Error);
      });
      it('should support only DDP message types', function () {
        conn.emitAsync = sinon.spy();
        (() => conn._processMessage({msg: 'connect'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'sub'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'ping'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'pong'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'method'})).should.not.throw(Error);
        (() => conn._processMessage({msg: 'unsub'})).should.not.throw(Error);
      });
    });

    describe('#_handleHearbeatTimeout', function () {
      it('should close raw socket', function () {
        conn._handleHearbeatTimeout();
        rawConn.close.should.have.callCount(1);
      });
    });

    describe('#_handleConnectMessage', function () {
      it('should set connection as conected and set sessionId', function () {
        conn._handleConnectMessage();
        conn._sendMessage.should.have.callCount(1);
        conn._sendMessage.getCall(0).args[0].msg.should.be.equals('connected');
        conn._sendMessage.getCall(0).args[0].session.should.be.equals(conn._sessionId);
        conn._sessionId.should.have.length(17);
        conn._connected.should.be.true;
        conn._handleConnectMessage();
        conn._sendMessage.should.have.callCount(1);
      });

      it('should wait ping in heartbeat', function () {
        conn._heartbeat = {waitPing: sinon.spy()};
        conn._handleConnectMessage();
        conn._heartbeat.waitPing.should.have.callCount(1);
      });
    });
  });
});
