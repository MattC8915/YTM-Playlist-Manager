import React from 'react';
import ReactDOM from 'react-dom';
import './css/index.css';
import 'antd/dist/antd.css';
import App from './js/App';
import ErrorBoundary from "./js/util/ErrorBoundary";
import {Router} from "@reach/router";

ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary>
        <Router>
            <App path={"/*"}/>
        </Router>
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root')
);

