import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AutoCombobox from './autoCombobox';


function SearchBar({
    placeholder = "Search by tag",
    buttonImage = "/images/search-icon.png",
    value = "",
    herdFilter = null
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [cowOptions, setCowOptions] = useState([]);
    const [searchValue, setSearchValue] = useState(value);
    const [history, setHistory] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);

    useEffect(() => {
        try {
            const savedHistory = sessionStorage.getItem('cowSearchHistory');
            const savedIndex = sessionStorage.getItem('cowSearchCurrentIndex');
            if (savedHistory) {
                setHistory(JSON.parse(savedHistory));
                if (savedIndex !== null) {
                    setCurrentIndex(parseInt(savedIndex, 10));
                }
            }
        } catch (error) {
            console.error('Error loading search history:', error);
        }
    }, []);

    useEffect(() => {
        const fetchCows = async () => {
            try {
                const response = await fetch('/api/animals', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setCowOptions(data.cows || []);
                }
            } catch (error) {
                console.error('Error fetching cow options:', error);
            }
        };
        fetchCows();
    }, []);

    useEffect(() => {
        setSearchValue(value);
    }, [value]);

    useEffect(() => {
        if (value && value.trim() !== '' && value !== history[currentIndex]) {
            const newHistory = [...history];
            if (currentIndex < history.length - 1) {
                newHistory.splice(currentIndex + 1);
            }
            newHistory.push(value);
            const newIndex = newHistory.length - 1;
            try {
                sessionStorage.setItem('cowSearchHistory', JSON.stringify(newHistory));
                sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
            } catch (error) {
                console.error('Error saving search history:', error);
            }
            setHistory(newHistory);
            setCurrentIndex(newIndex);
        }
    }, [value]);


    const STATUS_COLORS = {
        'Current': { bg: '#d4edda', color: '#155724' },
        'Target Sale': { bg: '#fff3cd', color: '#636e1f' },
        'CULL LIST, Current': { bg: '#f8d7da', color: '#590e60' },
        'Missing': { bg: '#f8d7da', color: '#721c24' },
        'Sold': { bg: '#c89807', color: '#fdfdfd' },
        'Dead': { bg: '#343a40', color: '#ffffff' },
        'Undefined': { bg: '#e2e3e5', color: '#383d41' },
    };

    const getFilteredOptions = () => {
        let filteredCows = cowOptions;
        if (herdFilter) {
            filteredCows = cowOptions.filter(cow =>
                cow.HerdName === herdFilter ||
                (!cow.HerdName && herdFilter === 'Unassigned')
            );
        }
        return filteredCows.map(cow => ({
            name: cow.CowTag,
            value: cow.CowTag,
            status: cow.Status,       // pass status through as metadata
        }));
    };

    const renderStatusBubble = (option) => {
        if (!option.status) return null;
        const colors = STATUS_COLORS[option.status] || { bg: '#e2e3e5', color: '#383d41' };
        return (
            <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '10px',
                fontWeight: '600',
                backgroundColor: colors.bg,
                color: colors.color,
                whiteSpace: 'nowrap',
            }}>
                {option.status}
            </span>
        );
    };

    const handleAutoComboboxBlur = (blurredValue) => {
        if (blurredValue?.trim()) {
            handleNavigation(blurredValue.trim());
        }
    };



    const handleNavigation = useCallback((newCow) => {
        if (!newCow || newCow.trim() === '') return;

        const newHistory = [...history];
        if (currentIndex < history.length - 1) {
            newHistory.splice(currentIndex + 1);
        }

        if (newCow !== history[currentIndex]) {
            newHistory.push(newCow);
            const newIndex = newHistory.length - 1;
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
        setSearchParams({ search: newCow, tab: searchParams.get('tab') || 'general' });
    }, [history, currentIndex, searchParams, setSearchParams]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (searchValue.trim()) {
            handleNavigation(searchValue.trim());
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleOptionSelect = (selectedValue) => {
        setSearchValue(selectedValue);
        handleNavigation(selectedValue);
    };

    const handleComboboxChange = (newValue) => {
        setSearchValue(newValue);
    };

    const handleBack = () => {
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            const previousCow = history[newIndex];
            try {
                sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
            } catch (error) {
                console.error('Error saving search index:', error);
            }
            setCurrentIndex(newIndex);
            setSearchValue(previousCow);
            setSearchParams({ search: previousCow, tab: searchParams.get('tab') || 'general' });
        }
    };

    const handleForward = () => {
        if (currentIndex < history.length - 1) {
            const newIndex = currentIndex + 1;
            const nextCow = history[newIndex];
            try {
                sessionStorage.setItem('cowSearchCurrentIndex', newIndex.toString());
            } catch (error) {
                console.error('Error saving search index:', error);
            }
            setCurrentIndex(newIndex);
            setSearchValue(nextCow);
            setSearchParams({ search: nextCow, tab: searchParams.get('tab') || 'general' });
        }
    };

    const canGoBack = currentIndex > 0;
    const canGoForward = currentIndex < history.length - 1;
    const showNavigation = history.length > 1;
    const useAutoComplete = cowOptions.length > 0;

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
        <div id="search-container">
            <div id="search-bar-container">
                <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                    {useAutoComplete ? (
                        <AutoCombobox
                            options={getFilteredOptions()}
                            value={searchValue}
                            onChange={handleComboboxChange}
                            onBlur={handleAutoComboboxBlur}
                            onSelect={handleOptionSelect}
                            placeholder={placeholder}
                            allowCustomValue={true}
                            style={{ fontSize: '20px', padding: '8px 7px', outline: 'none' }}
                            searchPlaceholder={`Search ${herdFilter ? `in ${herdFilter}` : 'all cows'}...`}
                            emptyMessage={`No animals found${herdFilter ? ` in ${herdFilter}` : ''}`}
                            onKeyDown={handleKeyDown}
                            renderOptionRight={renderStatusBubble}
                        />
                    ) : (
                        <input
                            id="search-bar"
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder={placeholder}
                            style={{
                                fontSize: '20px',
                                padding: '8px 12px',
                                border: '1px solid #ccc',
                                borderRadius: '4px 0 0 4px',
                                outline: 'none'
                            }}
                            required
                        />
                    )}
                    <button
                        id="search-button"
                        type="submit"
                        style={{
                            padding: '8px 12px',
                            border: '1px solid #ccc',
                            borderLeft: 'none',
                            borderRadius: '0 4px 4px 0',
                            backgroundColor: '#7dbdce',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <img src={buttonImage} alt="Search" style={imageStyle} />
                    </button>
                </form>

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
        </div>
    );
}

export default SearchBar;