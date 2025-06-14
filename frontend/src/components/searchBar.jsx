import React, { useState } from 'react';


function SearchBar({ onSearch, placeholder = "Search by tag", buttonImage = "/images/search-icon.png" }) {
  const [searchValue, setSearchValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(searchValue);
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
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
          width: '250px',
          height: '20px',
          margin: 0
        }}
      />
      <button type="submit" 
        style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          padding: '0',
          border: 'none',
          cursor: 'pointer',
          overflow: 'hidden',
          backgroundColor: '#7dbdce',
          margin: 0
        }}>
        <img src={buttonImage} alt="Search" style={imageStyle} />
      </button>
    </form>
  );
}

export default SearchBar;