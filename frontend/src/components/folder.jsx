import React, { useState, useEffect } from 'react';
import SearchBar from './searchBar';
import '../cow-data.css';

const FolderTabs = ({ activeTab, onTabChange, tabs = [], alertStates = {}, selectedTabColor = 'white' }) => {
    const tabWidth = '140px';

    return (
        <div style={{
            display: 'flex',
            marginBottom: '-3px',
            marginLeft: 'var(--folder-offset)',
            zIndex: 5,
            position: 'relative'
        }}>
            {tabs.map((tab, index) => (
                <div
                    key={tab.id}
                    onClick={() => !tab.disabled && onTabChange(tab.id)}
                    style={{
                        width: tabWidth,
                        background: activeTab === tab.id ? 
                            (alertStates[tab.id] ? `linear-gradient(to bottom, #cf7b79, ${selectedTabColor})` : selectedTabColor) :
                            (alertStates[tab.id] ? 'linear-gradient(to bottom, #cf7b79, #cf7b79)' : 'linear-gradient(to bottom, #e8e8e8, #c0c0c2)'),
                        border: '1px solid rgb(232, 232, 232)',
                        borderBottom: activeTab === tab.id ? 'none' : '1px solid #ccc',
                        height: activeTab === tab.id ? '43px' : '40px',
                        borderTopLeftRadius: '5px',
                        borderTopRightRadius: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: tab.disabled ? 'not-allowed' : 'pointer',
                        color: tab.disabled ? '#999' :
                            activeTab === tab.id ? 'rgb(28, 28, 66)' : 'black',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        opacity: tab.disabled ? 0.5 : 1,
                        zIndex: activeTab === tab.id ? 12 : 11,
                        marginRight: index < tabs.length - 1 ? 'var(--folder-gap)' : 'var(--folder-offset)',
                        transition: 'color 0.3s ease'
                    }}
                >
                    {tab.label}
                </div>
            ))}
        </div>
    );
};

function Folder({
    title,
    tabs = [],
    searchConfig = null, // { enabled: true, placeholder: "Search...", options: [] }
    defaultTab = null,
    defaultSearch = null,
    enableDefaultSearch = false,
    onDataFetch = null, // Function to fetch data for a tab: (searchTerm, tab) => Promise<data>
    onTabChange = null, // Optional callback for tab changes
    renderTab = null, // Function to render tab content: (tab, data, searchTerm, helpers) => Component
    alertStates = {}, // Object mapping tab IDs to alert boolean states
    selectedTabColor = 'white'
}) {
    const [activeTab, setActiveTab] = useState(defaultTab || (tabs.length > 0 ? tabs[0].id : ''));
    const [searchTerm, setSearchTerm] = useState('');
    const [tabData, setTabData] = useState({});
    const [loadingStates, setLoadingStates] = useState({});

    // Initialize tabs data structure
    useEffect(() => {
        if (tabs.length > 0) {
            const initialData = {};
            const initialLoading = {};
            tabs.forEach(tab => {
                initialData[tab.id] = null;
                initialLoading[tab.id] = false;
            });
            setTabData(initialData);
            setLoadingStates(initialLoading);
        }
    }, [tabs]);

    // Handle URL parameters and default search
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search');
        const tabParam = urlParams.get('tab');

        // Set tab first
        if (tabParam && tabs.find(t => t.id === tabParam)) {
            setActiveTab(tabParam);
        }

        // Then handle search if present
        if (searchParam) {
            handleSearch(searchParam);
        } else if (enableDefaultSearch && defaultSearch) {
            handleSearch(defaultSearch);
        }
    }, [tabs, enableDefaultSearch, defaultSearch]);

    // Function to fetch/refresh data
    const fetchData = async (searchValue, tab) => {
        if (!searchValue || searchValue.trim() === '' || !onDataFetch) return null;

        setLoadingStates(prev => ({ ...prev, [tab]: true }));

        try {
            const data = await onDataFetch(searchValue, tab);
            return data;
        } catch (error) {
            console.error(`Error fetching ${tab} data:`, error);
            return null;
        } finally {
            setLoadingStates(prev => ({ ...prev, [tab]: false }));
        }
    };

    const handleSearch = async (searchValue) => {
        if (!searchValue || searchValue.trim() === '') return;

        setSearchTerm(searchValue);

        // Update URL without causing a page reload
        const url = new URL(window.location);
        url.searchParams.set('search', searchValue);
        url.searchParams.set('tab', activeTab);
        window.history.pushState({}, '', url);

        if (onDataFetch) {
            // Fetch current tab data first
            const currentData = await fetchData(searchValue, activeTab);
            if (currentData) {
                setTabData(prev => ({ ...prev, [activeTab]: currentData }));

                // Then fetch other tabs data
                const otherTabs = tabs.filter(tab => tab.id !== activeTab);
                for (const tab of otherTabs) {
                    const data = await fetchData(searchValue, tab.id);
                    if (data) {
                        setTabData(prev => ({ ...prev, [tab.id]: data }));
                    }
                }
            } else {
                alert(`Search term "${searchValue}" not found`);
            }
        }
    };

    const handleTabChangeInternal = async (newTab) => {
        setActiveTab(newTab);

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('tab', newTab);
        if (searchTerm) url.searchParams.set('search', searchTerm);
        window.history.pushState({}, '', url);

        // If we don't have data for this tab and we have a search term, fetch it
        if (searchTerm && tabData[newTab] === null && onDataFetch) {
            const data = await fetchData(searchTerm, newTab);
            if (data) {
                setTabData(prev => ({ ...prev, [newTab]: data }));
            }
        }

        // Call external callback if provided
        if (onTabChange) {
            onTabChange(newTab);
        }
    };

    const renderCurrentTab = () => {
        if (!renderTab || !tabs.length) return null;

        const currentTabConfig = tabs.find(t => t.id === activeTab);
        const currentData = tabData[activeTab];
        const isLoading = loadingStates[activeTab];

        const helpers = {
            loading: isLoading,
            onRefresh: () => handleSearch(searchTerm),
            onNavigate: handleSearch,
            hideSearchBar: true
        };

        return renderTab(currentTabConfig, currentData, searchTerm, helpers);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
            <h1 style={{ marginTop: '0px' }}>{title}</h1>

            {searchConfig && searchConfig.enabled && (
                <div id="search-container">
                    <SearchBar
                        onSearch={handleSearch}
                        value={searchTerm}
                        cowOptions={searchConfig.options || []}
                        placeholder={searchConfig.placeholder || "Search..."}
                    />
                </div>
            )}

            <FolderTabs
                activeTab={activeTab}
                onTabChange={handleTabChangeInternal}
                tabs={tabs}
                alertStates={alertStates}
                selectedTabColor={selectedTabColor}
            />

            <div style={{ position: 'relative', zIndex: 1 }}>
                {renderCurrentTab()}
            </div>
        </div>
    );
}

export default Folder;