import AsyncEventEmitter from 'marsdb/dist/AsyncEventEmitter';


/**
 * Manages a heartbeat with a client
 */
export default class HeartbeatManager extends AsyncEventEmitter {
  constructor(pingTimeout = 17500, pongTimeout = 10000) {
    this.pingTimeout = pingTimeout;
    this.pongTimeout = pongTimeout;
  }

  waitPing() {
    this._clearTimers();
    this.waitPingTimer = setTimeout(
      () => {
        this.emit('ping');
        this.waitPong();
      },
      this.pingTimeout
    );
  }

  waitPong() {
    this._clearTimers();
    this.waitPongTimer = setTimeout(
      () => this.emit('timeout'),
      this.pongTimeout
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
