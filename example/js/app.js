import 'babel-polyfill';
import {IndexRoute, Route, browserHistory, Router} from 'react-router';
import React from 'react';
import ReactDOM from 'react-dom';
import DDP from 'ddp.js';


class DDPTestComponent extends React.Component {
  state = {
    messages: ['Started'],
  };

  componentDidMount() {
    this.ddp = new DDP({
      endpoint: "ws://localhost:3000",
      SocketConstructor: WebSocket
    });
    this.ddp.on("connected", () => {
      this.setState({
        messages: [...this.state.messages, 'Connected']
      });
    });
    this.ddp.on("added", (msg) => {
      this.setState({
        messages: [
          ...this.state.messages,
          `added to "${msg.collection}" fields: ${JSON.stringify(msg.fields)}`
        ]
      });
    });
    this.ddp.on("removed", (msg) => {
      this.setState({
        messages: [
          ...this.state.messages,
          `removed from "${msg.collection}" object: ${msg.id}`
        ]
      });
    });
    this.ddp.on("result", (msg) => {
      this.setState({
        messages: [
          ...this.state.messages,
          `result for "${msg.id}": ${JSON.stringify(msg.result)}`
        ]
      });
    });
    this.ddp.on("updated", (msg) => {
      this.setState({
        messages: [
          ...this.state.messages,
          `updated after "${msg.methods}"`
        ]
      });
    });
    this.ddp.on("nosub", (msg) => {
      this.setState({
        messages: [
          ...this.state.messages,
          `nosub for "${msg.id}"`
        ]
      });
    });
    this.subId = this.ddp.sub("allTodos");
    this.ddp.on("ready", (msg) => {
      this.setState({
        messages: [
          ...this.state.messages,
          `sub "${msg.subs}" ready`
        ]
      });
    });
  }

  handleClickHello = () => {
    this.ddp.method('sayHello', [Math.random()]);
  };

  handleInsert = () => {
    this.ddp.method('/todos/insert', [{
      text: 'Todo #' + Math.random(),
      complete: false,
    }]);
  };

  handleUnsub = () => {
    this.ddp.unsub(this.subId);
  };

  render() {
    const { messages } = this.state;
    return (
      <article>
        <h1>DDP messages</h1>
        <div>
          <button onClick={this.handleClickHello}>Say "Hallo"</button>
          <button onClick={this.handleInsert}>Insert</button>
          <button onClick={this.handleUnsub}>Unsub</button>
        </div>
        <div>
          {messages.map((m, i) => <div key={i}>{m}</div>)}
        </div>
      </article>
    );
  }
}


ReactDOM.render(
  <DDPTestComponent />,
  document.getElementById('root')
);
