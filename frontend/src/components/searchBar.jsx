import React, { useState } from 'react';

// This is a reusable component - like a class you can instantiate multiple times
function SearchBar({ onSearch, placeholder = "Search by cow tag", buttonImage = "/images/search-icon.png" }) {
  const [searchValue, setSearchValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Call the parent's callback function with the search value
    onSearch(searchValue);
  };

  const buttonStyle = {
    position: 'relative',
    width: '40px',
    height: '40px',
    padding: '0',
    border: 'none',
    cursor: 'pointer',
    overflow: 'hidden',
    backgroundColor: '#28a745'
  };

  const imageStyle = {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '80%',
    height: '80%',
    objectFit: 'contain'
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <input 
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={placeholder}
        required
        style={{
          padding: '8px 12px',
          fontSize: '14px',
          border: '2px solid #ccc',
          borderRadius: '4px',
          width: '250px'
        }}
      />
      <button type="submit" style={buttonStyle}>
        <img src={buttonImage} alt="Search" style={imageStyle} />
      </button>
    </form>
  );
}

export default SearchBar;