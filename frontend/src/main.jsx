import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './cow-data.css';

// This is the entry point - like main() in Java
// It tells React to render our App component into the HTML element with id="root"
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);