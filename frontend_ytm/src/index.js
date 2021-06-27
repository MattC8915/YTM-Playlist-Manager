import React from 'react';
import ReactDOM from 'react-dom';
import './css/index.css';
import 'antd/dist/antd.css';
import App from './js/App';
import ErrorBoundary from "./js/util/ErrorBoundary";
import {Router} from "@reach/router";
import { Provider } from 'react-redux'
import {store} from "./js/redux/store";

ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary>
        <Provider store={store}>
            <Router>
                <App path={"/*"}/>
            </Router>
        </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root')
);

