import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/main.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    React.createElement(App, { description: "Build a todo app with React" })
  );
}