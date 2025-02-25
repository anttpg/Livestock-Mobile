import React from "react";
import { BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Popup from './components/Popup';
import Search from './components/search';
import Medical from "./Medical";
import Calf from './components/calf';
import "./App.css";
import Essentials from "./components/essentials";

function App() {
  const [buttonPopup, setButtonPopup] = useState(false);
  const [cowIssues, setCowIssues] = useState(false);
  useEffect(() => {
    fetch('/api/cow')
    .then(response => response.json())
    .then(data => {
      if (data.issues && data.issues.length > 0)  {
        setCowIssues(true);
      }
      else {
        setCowIssues(false);
      }
    })
    .catch(error => console.error('Error fetching cow issues:', error))
  });
  return (
    <Router>
      <div className="app">
        <Search />
        {cowIssues && 
          (<button onClick={() => setButtonPopup(true)}>Issues Found</button>)
        }
        <main className="content">
          <div id="image-container">
            <img id="body-image" src="./public/images/example-cow.jpg" width="200" height="200" alt="cow" />
            <img id="headshot-image" src="./public/images/cow-headshot.jpg" width="200" height="200" alt="cow" />
          </div>
          <Essentials />
          <div id="calf-container">
            <Calf />
          </div>
          
        </main>
        <Popup trigger={buttonPopup} setTrigger={setButtonPopup}>
          <h3>Edit Notes</h3>
        </Popup>
        <Routes>
          <Route path="/medical" element={<Medical />} />
        </Routes>
        
      </div>
    </Router>
  );
};
export default App;