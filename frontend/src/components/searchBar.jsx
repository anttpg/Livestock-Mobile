import React, { useState, useEffect, useCallback } from 'react';

function SearchBar({ 
  onSearch, 
  placeholder = "Search by tag", 
  buttonImage = "/images/search-icon.png",
  value = "" // NEW: Add controlled value prop
}) {
  const [searchValue, setSearchValue] = useState(value);
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // GLOBAL HISTORY: Load from sessionStorage on mount
  useEffect(() => {
    try {
      const savedHistory = sessionStorage.getItem('cowSearchHistory');
      const savedIndex = sessionStorage.getItem('cowSearchCurrentIndex');
      
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);
        
        if (savedIndex !== null) {
          setCurrentIndex(parseInt(savedIndex, 10));
        }
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }, []);

  // NEW: Update searchValue when value prop changes
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // NEW: Add current cow to history when value prop changes (from URL navigation)
  useEffect(() => {
    if (value && value.trim() !== '' && value !== history[currentIndex]) {
      // This cow came from outside the SearchBar (like URL parameter or table click)
      // Add it to history without going through handleNavigation
      const newHistory = [...history];
      
      // If we're not at the end of history, remove everything after current position
      if (currentIndex < history.length - 1) {
        newHistory.splice(currentIndex + 1);
      }
      
      newHistory.push(value);
      const newIndex = newHistory.length - 1;
      
      // GLOBAL HISTORY: Save to sessionStorage
      try {
        sessionStorage.setItem('cowSearchHistory', JSON.stringify(newHistory));
        sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
      } catch (error) {
        console.error('Error saving search history:', error);
      }
      
      setHistory(newHistory);
      setCurrentIndex(newIndex);
    }
  }, [value, history, currentIndex]);

  const handleNavigation = useCallback((newCow) => {
    // Don't add empty/null/undefined values to history
    if (!newCow || newCow.trim() === '') {
      return;
    }
    
    // Create new history array
    const newHistory = [...history];
    
    // If we're not at the end of history, remove everything after current position
    if (currentIndex < history.length - 1) {
      newHistory.splice(currentIndex + 1);
    }
    
    // Add new cow if it's different from current
    if (newCow !== history[currentIndex]) {
      newHistory.push(newCow);
      const newIndex = newHistory.length - 1;
      
      // GLOBAL HISTORY: Save to sessionStorage
      try {
        sessionStorage.setItem('cowSearchHistory', JSON.stringify(newHistory));
        sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
      } catch (error) {
        console.error('Error saving search history:', error);
      }
      
      setHistory(newHistory);
      setCurrentIndex(newIndex);
    }
    
    setSearchValue(newCow);
    onSearch(newCow);
  }, [history, currentIndex, onSearch]);

  // Expose handleNavigation to parent components
  useEffect(() => {
    // Attach the navigation function to the search bar element for external access
    const searchBarElement = document.getElementById('search-bar');
    if (searchBarElement) {
      searchBarElement.navigate = handleNavigation;
    }
  }, [handleNavigation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      handleNavigation(searchValue.trim());
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const previousCow = history[newIndex];
      
      // GLOBAL HISTORY: Save current index to sessionStorage
      try {
        sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
      } catch (error) {
        console.error('Error saving search index:', error);
      }
      
      setCurrentIndex(newIndex);
      setSearchValue(previousCow);
      onSearch(previousCow);
    }
  };

  const handleForward = () => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      const nextCow = history[newIndex];
      
      // GLOBAL HISTORY: Save current index to sessionStorage
      try {
        sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
      } catch (error) {
        console.error('Error saving search index:', error);
      }
      
      setCurrentIndex(newIndex);
      setSearchValue(nextCow);
      onSearch(nextCow);
    }
  };

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;
  const showNavigation = history.length > 1;

  const imageStyle = {
    position: 'absolute',
    top: '0%',
    left: '0%',
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  };

  const buttonStyle = {
    padding: '5px 10px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    minWidth: '80px'
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  };

  return (
    <div>
      {/* Search form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
        <input 
          id="search-bar"
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={placeholder}
          style={{
            fontSize: '20px', // Prevent iOS zoom
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px 0 0 4px',
            outline: 'none'
          }}
          required
        />
        <button
          id="search-button"
          type="submit"
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderLeft: 'none',
            borderRadius: '0 4px 4px 0',
            backgroundColor: '#7dbdce', // Restored original blue color
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img src={buttonImage} alt="Search" style={imageStyle} />
        </button>
      </form>
      
      {/* Navigation buttons underneath */}
      {showNavigation && (
        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={handleBack}
            disabled={!canGoBack}
            style={canGoBack ? buttonStyle : disabledButtonStyle}
          >
            ← {canGoBack ? history[currentIndex - 1] : 'Back'}
          </button>
          <button
            type="button"
            onClick={handleForward}
            disabled={!canGoForward}
            style={canGoForward ? buttonStyle : disabledButtonStyle}
          >
            {canGoForward ? history[currentIndex + 1] : 'Fwd'} →
          </button>
        </div>
      )}
    </div>
  );
}

export default SearchBar;