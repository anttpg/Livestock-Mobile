import React, { useState, useEffect, Fragment } from 'react';
import Minimap from './minimap';
import Popup from './popup';
import MultiCowTable from './multiCowTable';
import HerdLog from './herdLog';
import PastureLog from './pastureLog';
import HerdSplitter from './herdSplitter';
import ConfirmPopup from './popupConfirm';

const UseLegacyHerdFeed = false; // Toggle for legacy inputs (Buttons)

const buttonStyles = {
    base: {
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 'normal'
    },
    small: {
        padding: '6px 10px',
        fontSize: '12px',
        borderRadius: '3px',
        minWidth: '55px',
        textAlign: 'center',
        flexShrink: 0
    },
    medium: {
        padding: '8px 16px',
        fontSize: '14px'
    },
    large: {
        padding: '10px 20px',
        fontSize: '16px'
    },
    xl: {
        padding: '12px 20px',
        fontSize: '16px'
    },
    actionButton: {
        width: '90%',
        margin: '0 auto',
        padding: '10px',
        fontSize: '18px',
        fontWeight: 'bold'
    }
};

const buttonColors = {
    primary: '#007bff',
    success: '#28a745',
    danger: '#dc3545',
    secondary: '#6c757d',
    warning: '#ffc107'
};

const layoutStyles = {
    flexCenter: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    flexBetween: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    flexColumn: {
        display: 'flex',
        flexDirection: 'column'
    },
    flexGap: (gap) => ({
        display: 'flex',
        gap: gap
    }),
    gridThreeColumn: {
        display: 'grid',
        gridTemplateColumns: 'max-content max-content 1fr',
        alignItems: 'center',
        gap: '0 15px',
        boxSizing: 'border-box',
        maxWidth: '100%',
        overflow: 'hidden',
    }
};

const inputStyles = {
    base: {
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '3px'
    },
    fullWidth: {
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '3px',
        width: '100%'
    },
    flex: {
        flex: 1,
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '3px'
    }
};

const containerStyles = {
    bubble: {
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '5px',
        border: '1px solid #ddd',
        boxSizing: 'border-box',
        maxWidth: '100%'
    },
    section: {
        borderTop: '1px solid #ddd',
        paddingTop: '15px',
        marginTop: '15px'
    },
    popup: {
        textAlign: 'center'
    }
};

const getButtonStyle = (size = 'large', color = 'primary', disabled = false, loading = false, customStyles = {}) => ({
    ...buttonStyles.base,
    ...buttonStyles[size],
    backgroundColor: buttonColors[color],
    cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
    opacity: (disabled || loading) ? 0.6 : 1,
    ...customStyles
});

function TimeSinceLabel({ date }) {
    if (!date) return 'never';

    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;

    if (diffMs < 5 * 60 * 1000) {
        return 'just now';
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMinutes <= 59) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours <= 23) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays <= 6) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else if (diffMonths < 1) {
        return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    } else if (diffYears < 1) {
        return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    } else {
        return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
    }
}

function Herd({ herdData, userPreferences, onHerdUpdate, onHerdSplit, onShowDisplayOptions}) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showRefillPopup, setShowRefillPopup] = useState(false);
    const [showMobileActionPopup, setShowMobileActionPopup] = useState(false);
    const [refillItem, setRefillItem] = useState('');
    const [currentPasture, setCurrentPasture] = useState(herdData.currentPasture || '');
    const [showAnimalList, setShowAnimalList] = useState(false);
    const [feedStatus, setFeedStatus] = useState([]);
    const [availablePastures, setAvailablePastures] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState('');
    const [narrowScreen, setNarrowScreen] = useState(false);
    const [showFeedLevelPopup, setShowFeedLevelPopup] = useState(false);
    const [feedLevelItem, setFeedLevelItem] = useState('');
    const [feedLevel, setFeedLevel] = useState(50);

    useEffect(() => {
        const checkMobile = () => {
            if (UseLegacyHerdFeed) {
                setNarrowScreen(window.innerWidth < 730);
            } else {
                setNarrowScreen(window.innerWidth < 589);
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const animalColumns = [
        { key: 'CowTag', header: 'Cow Tag', width: '120px', type: 'text' },
        { key: 'DOB', header: 'DOB', type: 'date' }
    ];

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetch('/api/check-auth', { credentials: 'include' });
                if (response.ok) {
                    const authData = await response.json();
                    if (authData.authenticated && authData.user) {
                        setCurrentUser(authData.user.username || authData.user.name || 'Current User');
                    }
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        const fetchHerdData = async () => {
            try {
                const feedParams = userPreferences.shownFeeds && userPreferences.shownFeeds.length > 0
                    ? `?feeds=${encodeURIComponent(userPreferences.shownFeeds.join(','))}`
                    : '';
                const feedResponse = await fetch(`/api/herd/${encodeURIComponent(herdData.herdName)}/feed-status${feedParams}`, {
                    credentials: 'include'
                });
                if (feedResponse.ok) {
                    const feedData = await feedResponse.json();
                    setFeedStatus(feedData.feedStatus || []);
                }

                const pasturesResponse = await fetch('/api/pastures', { credentials: 'include' });
                if (pasturesResponse.ok) {
                    const pasturesData = await pasturesResponse.json();
                    setAvailablePastures(pasturesData.pastures || []);
                }
            } catch (error) {
                console.error('Error fetching herd data:', error);
            }
        };
        fetchHerdData();
    }, [herdData.herdName, userPreferences]);

    const handleMinimizeExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const handleRefill = (itemType) => {
        setRefillItem(itemType);
        setShowRefillPopup(true);
        setShowMobileActionPopup(false);
    };

    const handleRefillConfirm = async (wasEmpty) => {
        setLoading(true);
        try {
            const response = await fetch('/api/record-feed-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    herdName: herdData.herdName,
                    feedType: refillItem,
                    activityType: 'refilled',
                    wasEmpty: wasEmpty,
                    username: currentUser
                })
            });

            if (response.ok) {
                const feedResponse = await fetch(`/api/herd/${encodeURIComponent(herdData.herdName)}/feed-status`, {
                    credentials: 'include'
                });
                if (feedResponse.ok) {
                    const feedData = await feedResponse.json();
                    setFeedStatus(feedData.feedStatus || []);
                }
                onHerdUpdate();
            } else {
                const errorData = await response.json();
                alert(`Failed to record refill: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error recording refill:', error);
            alert('Error recording refill activity');
        } finally {
            setLoading(false);
            setShowRefillPopup(false);
            setRefillItem('');
        }
    };

    const handleActionButton = async (item, action) => {
        setLoading(true);
        try {
            const activityType = action === 'Checked: not empty' ? 'checked_not_empty' : 'checked_empty';
            const response = await fetch('/api/record-feed-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    herdName: herdData.herdName,
                    feedType: item,
                    activityType: activityType,
                    username: currentUser
                })
            });

            if (response.ok) {
                const feedResponse = await fetch(`/api/herd/${encodeURIComponent(herdData.herdName)}/feed-status`, {
                    credentials: 'include'
                });
                if (feedResponse.ok) {
                    const feedData = await feedResponse.json();
                    setFeedStatus(feedData.feedStatus || []);
                }
                onHerdUpdate();
            } else {
                const errorData = await response.json();
                alert(`Failed to record activity: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error recording activity:', error);
            alert('Error recording feed activity');
        } finally {
            setLoading(false);
            setShowMobileActionPopup(false);
        }
    };

    const handleFeedUpdate = async (item, action) => {
        if (UseLegacyHerdFeed) {
            if (action === 'refill') {
                handleRefill(item);
            } else {
                handleActionButton(item, action);
            }
        } else {
            setFeedLevelItem(item);
            setFeedLevel(0);
            setShowFeedLevelPopup(true);
        }
    };

    const handleFeedLevelSubmit = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/record-feed-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    herdName: herdData.herdName,
                    feedType: feedLevelItem,
                    activityType: 'level_check',
                    levelAtRefill: feedLevel,
                    wasEmpty: feedLevel < 5,
                    username: currentUser
                })
            });

            if (response.ok) {
                const feedResponse = await fetch(`/api/herd/${encodeURIComponent(herdData.herdName)}/feed-status`, {
                    credentials: 'include'
                });
                if (feedResponse.ok) {
                    const feedData = await feedResponse.json();
                    setFeedStatus(feedData.feedStatus || []);
                }
                onHerdUpdate();
            } else {
                const errorData = await response.json();
                alert(`Failed to record feed level: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error recording feed level:', error);
            alert('Error recording feed level');
        } finally {
            setLoading(false);
            setShowFeedLevelPopup(false);
            setFeedLevelItem('');
        }
    };

    const handlePastureChange = async (newPasture) => {
        if (newPasture === currentPasture) return;
        setLoading(true);
        try {
            const response = await fetch('/api/move-herd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    herdName: herdData.herdName,
                    newPastureName: newPasture,
                    username: currentUser
                })
            });

            if (response.ok) {
                setCurrentPasture(newPasture);
                onHerdUpdate();
            } else {
                const errorData = await response.json();
                alert(`Failed to move herd: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error moving herd:', error);
            alert('Error moving herd to new pasture');
        } finally {
            setLoading(false);
        }
    };

    const handleAnimalView = (animalData) => {
        window.location.href = `/general?search=${animalData.CowTag}`;
    };

    const handleMobileAction = (feedType) => {
        setRefillItem(feedType);
        setShowMobileActionPopup(true);
    };

    return (
        <>
            <div className="bubble-container" style={{ opacity: loading ? 0.7 : 1, padding: '0px', overflowX: 'hidden' }}>
                {/* Navigation Bar */}
                <div
                    onClick={handleMinimizeExpand}
                    style={{
                        ...layoutStyles.flexBetween,
                        padding: '10px 15px',
                        backgroundColor: '#f8f9fa',
                        borderBottom: isExpanded ? '1px solid #ccc' : 'none',
                        borderRadius: isExpanded ? '5px 5px 0 0' : '5px',
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                >
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                        Herd: {herdData.herdName}
                    </h3>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                        {isExpanded ? 'collapse_content' : 'expand_content'}
                    </span>
                </div>

                {/* Content Window  */}
                {isExpanded && (
                        <>
                        <div style={{
                            display: 'flex',
                            padding: '15px',
                            gap: '20px',
                            minHeight: '400px',
                            overflow: 'hidden'
                        }}>
                            
                            {/* Left Half */}
                            <div style={{
                                width: 'var(--herd-minimap)',
                                flexShrink: 0,
                                ...layoutStyles.flexColumn,
                                gap: '15px'
                            }}>
                                <div style={{
                                    width: 'var(--herd-minimap)',
                                    height: 'var(--herd-minimap)',
                                    borderRadius: '5px',
                                    overflow: 'hidden'
                                }}>
                                    <Minimap cowTag="" pastureName={currentPasture} />
                                </div>

                                <div style={{
                                    ...layoutStyles.flexCenter,
                                    gap: '10px',
                                    width: '90%',
                                    margin: '0 auto'
                                }}>
                                    <select
                                        value={currentPasture}
                                        onChange={(e) => handlePastureChange(e.target.value)}
                                        disabled={loading}
                                        style={{
                                            fontSize: '18px',
                                            ...inputStyles.base,
                                            flex: 1,
                                            minWidth: 0
                                        }}
                                    >
                                        <option value="">Select Pasture</option>
                                        {availablePastures.map((pasture, index) => (
                                            <option key={index} value={pasture}>{pasture}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ ...layoutStyles.flexColumn, gap: '10px', alignItems: 'center' }}>
                                    <button
                                        onClick={() => onHerdSplit(herdData.herdName)}
                                        style={{
                                            ...getButtonStyle('actionButton', 'warning', false, false, { color: 'black' }),
                                            width: '90%',
                                            fontSize: 'calc(var(--herd-minimap) * 0.09)',
                                            padding: 'calc(var(--herd-minimap) * 0.05)'
                                        }}
                                    >
                                        Split Herd
                                    </button>
                                    <button
                                        onClick={() => setShowAnimalList(true)}
                                        style={{
                                            ...getButtonStyle('actionButton', 'primary'),
                                            width: '90%',
                                            fontSize: 'calc(var(--herd-minimap) * 0.09)',
                                            padding: 'calc(var(--herd-minimap) * 0.05)'
                                        }}
                                    >
                                        See all animals...
                                    </button>
                                </div>
                            </div>

                            {/* Right Half */}
                            <div style={{
                                flex: 1,
                                ...layoutStyles.flexColumn,
                                gap: '15px',
                                minWidth: 0,
                                overflow: 'hidden',
                                maxWidth: '395px'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '23px', fontWeight: 'bold', marginBottom: '5px' }}>
                                        {herdData.cowCount} cows
                                    </div>
                                    <div style={{ fontSize: '23px', fontWeight: 'bold' }}>
                                        {herdData.goatCount} goats
                                    </div>
                                </div>

                                <div style={{ marginTop: '20px' }}>
                                    <div style={{
                                        ...layoutStyles.flexCenter,
                                        marginBottom: '20px',
                                        ...containerStyles.bubble,
                                        maxWidth: '435px'
                                    }}>
                                        <div style={{
                                            flex: '1 1 auto',
                                            textAlign: 'right',
                                            paddingRight: '15px',
                                            fontWeight: 'bold',
                                            minWidth: 0, // Allows text to wrap
                                            wordWrap: 'break-word'
                                        }}>
                                            On pasture since
                                        </div>
                                        <div style={{
                                            flex: '1 1 auto',
                                            textAlign: 'left',
                                            color: '#666',
                                            fontSize: '16px',
                                            minWidth: 0 // Allows text to wrap
                                        }}>
                                            {herdData.daysOnPasture !== null ?
                                                <TimeSinceLabel date={new Date(Date.now() - herdData.daysOnPasture * 24 * 60 * 60 * 1000)} /> :
                                                'Unknown'
                                            }
                                        </div>
                                    </div>

                                    <div style={layoutStyles.gridThreeColumn}>
                                        {feedStatus.map((feed, index) => (
                                            <StatusRow
                                                key={index}
                                                label={feed.feedType}
                                                lastActivityDate={feed.lastActivityDate}
                                                onRefill={() => handleFeedUpdate(feed.feedType, 'update')}
                                                onAction={(action) => handleFeedUpdate(feed.feedType, action)}
                                                onMobileAction={() => handleFeedUpdate(feed.feedType, 'update')}
                                                disabled={loading}
                                                narrowScreen={narrowScreen}
                                            />
                                        ))}
                                    </div>

                                    <div style={{
                                        flex: '1',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center', 
                                        maxWidth: '435px'
                                    }}>
                                        <button
                                            onClick={onShowDisplayOptions}
                                            style={getButtonStyle('medium', 'primary')}
                                        >
                                            Customize Tracked Items
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '15px', marginTop: '10px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <HerdLog herdName={herdData.herdName} maxEvents={3} showAddEvent={true} />
                            </div>
                            {/* {herdData.currentPasture && (
                                            <div style={{ marginTop: '20px' }}>
                                                <PastureLog pastureName={herdData.currentPasture} maxEvents={3} showAddEvent={true} />
                                            </div>
                                        )} */}
                        </div>
                    </>
                )}
            </div>

            {/* Refill Popup */}
            <Popup
                isOpen={showRefillPopup}
                onClose={() => setShowRefillPopup(false)}
                title={`Refill ${refillItem}`}
                width="400px"
                height="200px"
            >
                <div style={containerStyles.popup}>
                    <p style={{ marginBottom: '20px' }}>
                        Was the {refillItem.toLowerCase()} empty when you refilled it?
                    </p>
                    <div style={layoutStyles.flexGap('10px')}>
                        <button
                            onClick={() => handleRefillConfirm(true)}
                            disabled={loading}
                            style={getButtonStyle('large', 'danger', loading)}
                        >
                            Yes, it was empty
                        </button>
                        <button
                            onClick={() => handleRefillConfirm(false)}
                            disabled={loading}
                            style={getButtonStyle('large', 'success', loading)}
                        >
                            No, it had some left
                        </button>
                    </div>
                </div>
            </Popup>

            {/* Mobile Action Popup */}
            <Popup
                isOpen={showMobileActionPopup}
                onClose={() => setShowMobileActionPopup(false)}
                title={`Update ${refillItem}`}
                width="350px"
                height="250px"
            >
                <div style={{ ...layoutStyles.flexColumn, gap: '15px', padding: '20px 0' }}>
                    <button
                        onClick={() => handleFeedUpdate(refillItem, 'refill')}
                        disabled={loading}
                        style={getButtonStyle('xl', 'primary', loading)}
                    >
                        Refilled
                    </button>
                    <button
                        onClick={() => handleFeedUpdate(refillItem, 'Checked: not empty')}
                        disabled={loading}
                        style={getButtonStyle('xl', 'success', loading)}
                    >
                        Checked: Not empty
                    </button>
                    <button
                        onClick={() => handleFeedUpdate(refillItem, 'Checked: empty')}
                        disabled={loading}
                        style={getButtonStyle('xl', 'danger', loading)}
                    >
                        Checked: Empty
                    </button>
                </div>
            </Popup>

            {/* Feed Level Slider Popup */}
            {showFeedLevelPopup && (
                <Popup
                    isOpen={showFeedLevelPopup}
                    onClose={() => setShowFeedLevelPopup(false)}
                    title="Log feed level"
                    width="450px"
                    height="300px"
                >
                    <div style={{ padding: '20px 0' }}>
                        <p style={{ marginBottom: '20px' }}>
                            How much <strong>{feedLevelItem}</strong> remained before this refill?
                        </p>

                        <div style={{
                            marginBottom: '30px',
                            padding: '20px 15px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '5px'
                        }}>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={feedLevel}
                                onChange={(e) => setFeedLevel(parseInt(e.target.value))}
                                style={{
                                    width: '100%',
                                    height: '8px',
                                    borderRadius: '4px',
                                    background: `linear-gradient(to right, #4394e5 0%, #4394e5 ${feedLevel}%, #e0e0e0 ${feedLevel}%, #e0e0e0 100%)`,
                                    outline: 'none',
                                    appearance: 'none'
                                }}
                            />
                            <div style={{
                                ...layoutStyles.flexBetween,
                                marginTop: '10px',
                                fontSize: '18px',
                                color: '#666'
                            }}>
                                <span>Empty</span>
                                <span>Very little</span>
                                <span>A lot</span>
                                <span>Full</span>
                            </div>
                            <div style={{
                                textAlign: 'center',
                                marginTop: '10px',
                                fontSize: '16px',
                                fontWeight: 'bold'
                            }}>
                                {feedLevel}% remaining
                            </div>
                        </div>

                        <div style={{ ...layoutStyles.flexGap('10px'), justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowFeedLevelPopup(false)}
                                style={getButtonStyle('large', 'secondary')}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFeedLevelSubmit}
                                disabled={loading}
                                style={getButtonStyle('large', 'success', loading)}
                            >
                                {loading ? 'Saving...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </Popup>
            )}

            {/* Animal List Popup */}
            {showAnimalList && (
                <Popup
                    isOpen={showAnimalList}
                    onClose={() => setShowAnimalList(false)}
                    title={`Animals in ${herdData.herdName}`}
                    width="80vw"
                    maxHeight="80vh"
                >
                    <MultiCowTable
                        data={herdData.cows || []}
                        columns={animalColumns}
                        onViewClick={handleAnimalView}
                        title={`Animals in ${herdData.herdName}`}
                        emptyMessage="No animals in this herd"
                    />
                </Popup>
            )}
        </>
    );
}

function StatusRow({ label, lastActivityDate, onRefill, onAction, onMobileAction, disabled, narrowScreen }) {
    if (narrowScreen) {
        return (
            <div style={{
                gridColumn: '1 / -1',
                ...layoutStyles.flexColumn,
                gap: '4px',
                borderBottom: '1px solid #eee',
                paddingBottom: '8px',
                marginBottom: '12px'
            }}>
                <div style={layoutStyles.flexBetween}>
                    <div style={{
                        ...layoutStyles.flexColumn,
                        alignItems: 'center',
                        flex: 1,
                        gap: '2px'
                    }}>
                        <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {label}
                        </div>
                        <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
                            <TimeSinceLabel date={lastActivityDate} />
                        </div>
                    </div>
                    <button
                        onClick={() => onRefill()}
                        disabled={disabled}
                        style={getButtonStyle('medium', 'secondary', disabled, false, { minWidth: '80px' })}
                    >
                        Refill
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {label}
            </div>
            <div style={{ textAlign: 'left', color: '#666', whiteSpace: 'nowrap' }}>
                <TimeSinceLabel date={lastActivityDate} />
            </div>
            <div style={{
                ...layoutStyles.flexGap('5px'),
                justifyContent: 'flex-start',
                borderBottom: '1px solid #eee',
                paddingBottom: '8px',
                marginBottom: '12px'
            }}>
                {UseLegacyHerdFeed ? (
                    <>
                        <button
                            onClick={onRefill}
                            disabled={disabled}
                            style={getButtonStyle('small', 'primary', disabled, false, { minWidth: '60px' })}
                        >
                            Refilled
                        </button>
                        <button
                            onClick={() => onAction('Checked: not empty')}
                            disabled={disabled}
                            style={getButtonStyle('small', 'success', disabled, false, { minWidth: '70px' })}
                        >
                            Not empty
                        </button>
                        <button
                            onClick={() => onAction('Checked: empty')}
                            disabled={disabled}
                            style={getButtonStyle('small', 'danger', disabled)}
                        >
                            Empty
                        </button>
                    </>
                ) : (
                    <button
                        onClick={onMobileAction}
                        disabled={disabled}
                        style={getButtonStyle('small', 'secondary', disabled, false, { minWidth: '70px' })}
                    >
                        Refill
                    </button>
                )}
            </div>
        </>
    );
}

function Herds() {
    const [herds, setHerds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDisplayOptions, setShowDisplayOptions] = useState(false);
    const [userPreferences, setUserPreferences] = useState({ shownFeeds: [] });
    const [currentUser, setCurrentUser] = useState('');
    const [availableFeedTypes, setAvailableFeedTypes] = useState([]);
    const [showHerdSplitter, setShowHerdSplitter] = useState(false);
    const [herdSplitterHerd, setHerdSplitterHerd] = useState('');
    const [showAddFeedPopup, setShowAddFeedPopup] = useState(false);
    const [newFeedType, setNewFeedType] = useState('');
    const [showAddFeedInput, setShowAddFeedInput] = useState(false);
    const [addingFeedType, setAddingFeedType] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetch('/api/check-auth', { credentials: 'include' });
                if (response.ok) {
                    const authData = await response.json();
                    if (authData.authenticated && authData.user) {
                        setCurrentUser(authData.user.username || authData.user.name || 'Current User');
                    }
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        const fetchUserPreferences = async () => {
            try {
                const response = await fetch(`/api/users/${currentUser}/preferences`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    setUserPreferences(data.preferences || { shownFeeds: [] });
                }
            } catch (error) {
                console.error('Error fetching user preferences:', error);
            }
        };

        if (currentUser) {
            fetchUserPreferences();
        }
    }, [currentUser]);

    const saveUserPreferences = async (newPrefs) => {
        try {
            await fetch(`/api/users/${currentUser}/preferences`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ preferences: newPrefs })
            });
        } catch (error) {
            console.error('Error saving preferences:', error);
            alert('Error saving preferences');
        }
    };

    useEffect(() => {
        const fetchFeedTypes = async () => {
            try {
                const response = await fetch('/api/feed-types', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setAvailableFeedTypes(data.feedTypes || []);
                }
            } catch (error) {
                console.error('Error fetching feed types:', error);
                setAvailableFeedTypes(['Error fetching feed types']);
            }
        };
        fetchFeedTypes();
    }, []);

    const handleAddFeedType = async () => {
        if (!newFeedType.trim()) return;
        setAddingFeedType(true);
        try {
            setAvailableFeedTypes(prev => [...prev, newFeedType.trim()]);
            const response = await fetch('/api/feed-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ feedType: newFeedType.trim() })
            });

            if (!response.ok) {
                const errorData = await response.json();
                setAvailableFeedTypes(prev => prev.filter(f => f !== newFeedType.trim()));
                if (errorData.operationalError) {
                    alert(errorData.message);
                } else {
                    alert('Failed to add feed type');
                }
            }
            setNewFeedType('');
            setShowAddFeedInput(false);
        } catch (error) {
            console.error('Error adding feed type:', error);
            setAvailableFeedTypes(prev => prev.filter(f => f !== newFeedType.trim()));
            alert('Error adding feed type');
        } finally {
            setAddingFeedType(false);
            setShowAddFeedPopup(false);
        }
    };

    const fetchHerds = async () => {
        try {
            const response = await fetch('/api/herds', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setHerds(data.herds || []);
            } else {
                console.error('Failed to fetch herds');
                setHerds([]);
            }
        } catch (error) {
            console.error('Error fetching herds:', error);
            setHerds([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHerds();
    }, []);

    const handleHerdUpdate = () => {
        fetchHerds();
    };

    const handleHerdSplit = (herdName) => {
        setHerdSplitterHerd(herdName);
        setShowHerdSplitter(true);
    };

    if (loading) {
        return (
            <div style={{
                ...layoutStyles.flexCenter,
                height: '200px',
                fontSize: '18px',
                color: '#666'
            }}>
                Loading herds...
            </div>
        );
    }

    return (
        <div className="multibubble-column">
            <div style={{ ...layoutStyles.flexBetween, marginBottom: '20px' }}>
                <h1>Herd Management</h1>
            </div>

            {herds.length > 0 ? (
                herds.map((herdData, index) => (
                    <Herd
                        key={index}
                        herdData={herdData}
                        userPreferences={userPreferences}
                        onHerdUpdate={handleHerdUpdate}
                        onHerdSplit={handleHerdSplit}
                        onShowDisplayOptions={() => setShowDisplayOptions(true)}
                    />
                ))
            ) : (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    border: '2px dashed #ccc',
                    borderRadius: '10px',
                    color: '#666',
                    fontSize: '18px'
                }}>
                    No herds found
                </div>
            )}
            {showDisplayOptions && (
                <Popup
                    isOpen={showDisplayOptions}
                    onClose={() => setShowDisplayOptions(false)}
                    title="Feed Display Options"
                    width="400px"
                    height="400px"
                >
                    <div>
                        <p>Select which items to display:</p>
                        <div style={{ marginBottom: '20px' }}>
                            {availableFeedTypes.map(feedType => {
                                const isChecked = userPreferences.shownFeeds.includes(feedType);
                                return (
                                    <label key={feedType} style={{ display: 'block', margin: '8px 0', color: isChecked ? '#000' : '#999' }}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            style={{
                                                textDecoration: isChecked ? 'none' : 'line-through',
                                                marginRight: '8px'
                                            }}
                                            onChange={async (e) => {
                                                //console.log("Checkbox changed:", feedType, "checked?", e.target.checked);
                                                setUserPreferences(prev => {
                                                    let shownFeeds = prev.shownFeeds || [];

                                                    if (e.target.checked) {
                                                        // Add feedType immutably
                                                        if (!shownFeeds.includes(feedType)) {
                                                            shownFeeds = [...shownFeeds, feedType];
                                                        }
                                                    } else {
                                                        // Remove feedType immutably
                                                        shownFeeds = shownFeeds.filter(f => f !== feedType);
                                                    }

                                                    // console.log("Previous feeds:", prev.shownFeeds);
                                                    // console.log("Next feeds:", shownFeeds);
                                                    const updatedPrefs = { ...prev, shownFeeds };

                                                    // Save immediately and refresh display
                                                    saveUserPreferences(updatedPrefs);
                                                    fetchHerds();

                                                    return updatedPrefs;
                                                });
                                            }}
                                        />
                                        {feedType}
                                        <span>
                                            {isChecked ? '' : ' (Hidden)'}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>

                        <div style={containerStyles.section}>
                            {!showAddFeedInput ? (
                                <button
                                    onClick={() => setShowAddFeedInput(true)}
                                    style={getButtonStyle('large', 'primary', false, false, { width: '100%' })}
                                >
                                    Track new item
                                </button>
                            ) : (
                                <div style={{ ...layoutStyles.flexGap('5px'), alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        value={newFeedType}
                                        onChange={(e) => setNewFeedType(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                setShowAddFeedPopup(true);
                                            }
                                        }}
                                        placeholder="New feed type name"
                                        style={inputStyles.flex}
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => setShowAddFeedPopup(true)}
                                        disabled={!newFeedType.trim() || addingFeedType}
                                        style={getButtonStyle('medium', 'success', !newFeedType.trim() || addingFeedType)}
                                    >
                                        Add
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAddFeedInput(false);
                                            setNewFeedType('');
                                        }}
                                        style={getButtonStyle('medium', 'secondary')}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </Popup>
            )}


            {/* Add Feed Type Confirmation */}
            <ConfirmPopup
                isOpen={showAddFeedPopup}
                onClose={() => setShowAddFeedPopup(false)}
                onConfirm={handleAddFeedType}
                title="Add New Feed Type"
                message={`Are you certain you want to add a new feed? <br/><em>This cannot be undone</em>`}
                requireDelay={true}
                confirmText="Add Feed Type"
            />

            {/* HerdSplitter Popup */}
            {showHerdSplitter && (
                <Popup
                    isOpen={showHerdSplitter}
                    onClose={() => setShowHerdSplitter(false)}
                    title="Split Herd"
                    fullscreen={true}
                >
                    <HerdSplitter
                        leftHerd={herdSplitterHerd}
                        rightHerd={null}
                        isOpen={true}
                        onClose={() => setShowHerdSplitter(false)}
                        onSave={() => {
                            setShowHerdSplitter(false);
                            handleHerdUpdate();
                        }}
                    />
                </Popup>
            )}
        </div>
    );
}

export default Herds;