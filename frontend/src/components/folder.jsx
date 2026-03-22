import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const FolderTabs = ({ activeTab, onTabChange, tabs = [], alertStates = {}, alertColors = {}, selectedTabColor = 'white' }) => {
    const tabWidth = '140px';

    return (
        <div style={{ display: 'flex', marginBottom: '-3px', marginLeft: 'var(--folder-offset)', zIndex: 5, position: 'relative' }}>
            {tabs.map((tab, index) => {
                const alertColor = alertColors[tab.id] || '#cf7b79';
                const isActive = activeTab === tab.id;
                const hasAlert = alertStates[tab.id];

                return (
                    <div
                        key={tab.id}
                        onClick={() => !tab.disabled && onTabChange(tab.id)}
                        style={{
                            width: tabWidth,
                            background: isActive
                                ? (hasAlert ? `linear-gradient(to bottom, ${alertColor}, ${selectedTabColor})` : selectedTabColor)
                                : (hasAlert ? `linear-gradient(to bottom, ${alertColor}, ${alertColor})` : 'linear-gradient(to bottom, #e8e8e8, #c0c0c2)'),
                            border: '1px solid rgb(232, 232, 232)',
                            borderBottom: isActive ? 'none' : '1px solid #ccc',
                            height: isActive ? '43px' : '40px',
                            borderTopLeftRadius: '5px',
                            borderTopRightRadius: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: tab.disabled ? 'not-allowed' : 'pointer',
                            color: tab.disabled ? '#999' : isActive ? 'rgb(28, 28, 66)' : 'black',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            opacity: tab.disabled ? 0.5 : 1,
                            zIndex: isActive ? 12 : 11,
                            marginRight: index < tabs.length - 1 ? 'var(--folder-gap)' : 'var(--folder-offset)',
                            transition: 'color 0.3s ease'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%', lineHeight: '1.2' }}>
                            {tab.label}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

function Folder({
    title = "",
    tabs = [],
    defaultTab = null,
    fetchKey = null,        // When this changes, refetch all tabs
    onDataFetch = null,     // (tab) => data, caller pre-binds whatever identifier is needed
    onTabChange = null,
    renderTab = null,       // (tabConfig, data, helpers) => jsx, caller handles its own term
    alertStates = {},
    alertColors = {},
    selectedTabColor = 'white'
}) {
    const [activeTab, setActiveTab] = useState(defaultTab || (tabs.length > 0 ? tabs[0].id : ''));
    const [tabData, setTabData] = useState({});
    const [loadingStates, setLoadingStates] = useState({});
    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize tab data structure when tabs change
    useEffect(() => {
        const initialData = {};
        const initialLoading = {};
        tabs.forEach(tab => {
            initialData[tab.id] = null;
            initialLoading[tab.id] = false;
        });
        setTabData(initialData);
        setLoadingStates(initialLoading);
    }, [tabs]);

    // Sync active tab from URL
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam && tabs.find(t => t.id === tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams, tabs]);

    const fetchData = useCallback(async (tab) => {
        if (!onDataFetch) return null;
        setLoadingStates(prev => ({ ...prev, [tab]: true }));
        try {
            return await onDataFetch(tab);
        } catch (error) {
            console.error(`Error fetching ${tab} data:`, error);
            return null;
        } finally {
            setLoadingStates(prev => ({ ...prev, [tab]: false }));
        }
    }, [onDataFetch]);

    const fetchAllTabs = useCallback(async () => {
        if (!onDataFetch) return;

        setTabData(prev => Object.fromEntries(Object.keys(prev).map(k => [k, null])));

        const currentData = await fetchData(activeTab);
        if (currentData) {
            setTabData(prev => ({ ...prev, [activeTab]: currentData }));
        } else {
            alert(`Not found`);
            return;
        }

        for (const tab of tabs.filter(t => t.id !== activeTab)) {
            const data = await fetchData(tab.id);
            if (data) setTabData(prev => ({ ...prev, [tab.id]: data }));
        }
    }, [activeTab, tabs, fetchData, onDataFetch]);

    // Refetch whenever fetchKey changes
    useEffect(() => {
        if (fetchKey) {
            fetchAllTabs();
        }
    }, [fetchKey]);

    const handleTabChangeInternal = async (newTab) => {
        setActiveTab(newTab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', newTab);
            return next;
        });

        if (tabData[newTab] === null) {
            const data = await fetchData(newTab);
            if (data) setTabData(prev => ({ ...prev, [newTab]: data }));
        }

        if (onTabChange) onTabChange(newTab);
    };

    const renderCurrentTab = () => {
        if (!renderTab || !tabs.length) return null;

        const currentTabConfig = tabs.find(t => t.id === activeTab);
        const helpers = {
            loading: loadingStates[activeTab],
            onRefresh: fetchAllTabs
        };

        return renderTab(currentTabConfig, tabData[activeTab], helpers);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
            <h1 style={{ marginTop: '0px' }}>{title}</h1>
            <FolderTabs
                activeTab={activeTab}
                onTabChange={handleTabChangeInternal}
                tabs={tabs}
                alertStates={alertStates}
                alertColors={alertColors}
                selectedTabColor={selectedTabColor}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
                {renderCurrentTab()}
            </div>
        </div>
    );
}

export default Folder;