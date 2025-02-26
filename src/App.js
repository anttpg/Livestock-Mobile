import React from "react";
import { useState, useEffect } from "react";
import Popup from './components/Popup';
import Search from './components/search';
import Medical from "./Medical";
import Calf from './components/calf';
import "./App.css";
import Essentials from "./components/essentials";

function App() {
  const [issuesPopup, setIssuesPopup] = useState(false);
  const [cowIssues, setCowIssues] = useState(false);

  const [notesPopup, setNotesPopup] = useState(false);
  // Checks if there are any issues with the cow, for the button
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
    <div className="app">
      <Search />  
      {/* Only appears IF there are issues */}
      {cowIssues && 
        (<button onClick={() => setIssuesPopup(true)}>Issues Found</button>)
      }
      <main className="content">
        <div id="image-container">
          <img id="body-image" src="/images/example-cow.jpg" width="200" height="200" alt="cow" />
          <img id="headshot-image" src="/images/cow-headshot.jpg" width="200" height="200" alt="cow" />
        </div>
        <Essentials />

        {/* Notes Popup */}
        <button onClick={() => setNotesPopup(true)}>Edit Notes</button>
        <Medical />
        <div id="calf-container">
          <Calf />
        </div>
      </main>

      {/* What we see if popup buttons are pressed */}
      <Popup trigger={issuesPopup} setTrigger={setIssuesPopup}>
        <h3>Issues Found</h3>
      </Popup>
      <Popup trigger={notesPopup} setTrigger={setNotesPopup}>
        <h3>Notes</h3>
      </Popup>    
    </div>
  );
};
export default App;