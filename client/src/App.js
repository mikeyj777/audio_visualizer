import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import MikeDropViz from './components/MikeDropViz';
import './App.css';
import './styles/global.css';

const App = () => {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mikedropviz" element={<MikeDropViz />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;