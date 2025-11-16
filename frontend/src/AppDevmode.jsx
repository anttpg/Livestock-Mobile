import React, { useState } from 'react';
import SearchBar from './components/searchBar';
// Import other components as you create them
// import CowInfoCard from './components/CowInfoCard';
// import ObservationForm from './components/ObservationForm';

function AppDevMode() {
  const [lastSearched, setLastSearched] = useState('');
  const [componentToShow, setComponentToShow] = useState('searchbar');

  // Mock data for testing
  const mockCowData = {
    CowTagMain: 'COW-123',
    DateOfBirth: '2020-05-15',
    Weight: '650 kg',
    Description: 'Brown cow with white spots'
  };

  // Component showcase sections
  const components = {
    searchbar: (
      <div className="component-showcase">
        <h2>SearchBar Component</h2>
        <div className="demo-box">
          <h3>Default SearchBar:</h3>
          <SearchBar onSearch={(value) => setLastSearched(value)} />
          <p>Last searched: {lastSearched}</p>
        </div>

        <div className="demo-box">
          <h3>Custom Placeholder:</h3>
          <SearchBar 
            onSearch={(value) => console.log('Searched:', value)} 
            placeholder="Enter animal ID"
          />
        </div>

        <div className="demo-box">
          <h3>Custom Button Image:</h3>
          <SearchBar 
            onSearch={(value) => console.log('Searched:', value)} 
            buttonImage="/images/custom-search.png"
          />
        </div>
      </div>
    ),
    
    // Add more components here as you build them
    // cowinfo: (
    //   <div className="component-showcase">
    //     <h2>CowInfoCard Component</h2>
    //     <CowInfoCard 
    //       title="Date of Birth" 
    //       value={mockCowData.DateOfBirth} 
    //       defaultText="No date available" 
    //     />
    //   </div>
    // ),
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Component Development Mode</h1>
      
      {/* Navigation */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '10px', 
        backgroundColor: '#f0f0f0',
        borderRadius: '5px'
      }}>
        <button 
          onClick={() => setComponentToShow('searchbar')}
          style={{ marginRight: '10px', padding: '5px 10px' }}
        >
          SearchBar
        </button>
        {/* Add more buttons as you create components */}
        {/* <button onClick={() => setComponentToShow('cowinfo')}>CowInfoCard</button> */}
      </div>

      {/* Component Display Area */}
      <div style={{ 
        border: '2px dashed #ccc', 
        padding: '20px', 
        borderRadius: '10px',
        backgroundColor: '#fafafa'
      }}>
        {components[componentToShow] || <p>Select a component to preview</p>}
      </div>

      {/* Console Output */}
      <div style={{ 
        marginTop: '20px', 
        padding: '10px', 
        backgroundColor: '#1e1e1e',
        color: '#fff',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        <h3>Console Output:</h3>
        <p>Check browser console for component interactions</p>
      </div>

      <style>{`
        .component-showcase {
          max-width: 800px;
        }
        
        .demo-box {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          borderRadius: 5px;
          backgroundColor: white;
        }
        
        .demo-box h3 {
          margin-top: 0;
          color: #333;
        }
      `}</style>
    </div>
  );
}

export default AppDevMode;