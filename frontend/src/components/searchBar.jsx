import React, { useState } from 'react';


function SearchBar({ onSearch, placeholder = "Search by tag", buttonImage = "/images/search-icon.png" }) {
  const [searchValue, setSearchValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(searchValue);
  };

  const imageStyle = {
    position: 'absolute',
    top: '0%',
    left: '0%',
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
      <input 
        id="search-bar"
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={placeholder}
        required
      />
      <button
        id="search-button"
        type="submit"
      >
        <img src={buttonImage} alt="Search" style={imageStyle} />
      </button>
    </form>
  );
}

export default SearchBar;