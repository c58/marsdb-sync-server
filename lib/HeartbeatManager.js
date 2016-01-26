import AsyncEventEmitter from 'marsdb/dist/AsyncEventEmitter';


// Internals
const HEARTBEAT_PING_TIMEOUT = 17500;
const HEARTBEAT_PONG_TIMEOUT = 10000;

/**
 * Manages a heartbeat with a client
 */
export default class HeartbeatManager extends AsyncEventEmitter {
  waitPing() {
    this._clearTimers();
    this.waitPingTimer = setTimeout(
      () => {
        this.emit('ping');
        this.waitPong();
      },
      HEARTBEAT_PING_TIMEOUT
    );
  }

  waitPong() {
    this._clearTimers();
    this.waitPongTimer = setTimeout(
      () => this.emit('timeout'),
      HEARTBEAT_PONG_TIMEOUT
    );
  }

  handlePing(id) {
    this._clearTimers();
    this.emit('pong', id);
    this.waitPing();
  }

  handlePong() {
    this._clearTimers();
    this.waitPing();
  }

  _clearTimers() {
    clearTimeout(this.waitPingTimer);
    clearTimeout(this.waitPongTimer);
  }
}
