import React from 'react';
import ReactDOM from 'react-dom/client';
import AppDevMode from './AppDevmode';
import './cow-data.css';

// Development mode entry point - no authentication needed
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppDevMode />
  </React.StrictMode>
);