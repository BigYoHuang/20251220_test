import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 取得 HTML 中的掛載點
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 初始化 React 應用程式
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);