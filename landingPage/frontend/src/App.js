import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './index.jsx'; 
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

function App() {
  return(
    <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<HomePage />} />
      </Routes>
  );
}


export default App;