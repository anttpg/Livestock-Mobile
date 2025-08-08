import React, { useState, useEffect } from 'react';
import Minimap from './minimap';
import Popup from './popup';
import MultiCowTable from './multiCowTable';

// TimeSinceLabel Component - Reusable time display
function TimeSinceLabel({ date }) {
    if (!date) return 'never';

    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;

    // If within 5 minutes, show "just now"
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
    } else if (diffWeeks <= 3) {
        return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    } else if (diffMonths <= 11) {
        return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    } else {
        return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
    }
}

// Mobile Action Popup Component
function MobileActionPopup({ isOpen, onClose, feedType, onRefill, onNotEmpty, onEmpty, disabled }) {
    if (!isOpen) return null;

    return (
        <Popup
            isOpen={isOpen}
            onClose={onClose}
            title={`Update ${feedType}`}
            width="350px"
            height="250px"
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                padding: '20px 0'
            }}>
                <button
                    onClick={onRefill}
                    disabled={disabled}
                    style={{
                        padding: '12px 20px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        opacity: disabled ? 0.6 : 1
                    }}
                >
                    Refilled
                </button>
                <button
                    onClick={onNotEmpty}
                    disabled={disabled}
                    style={{
                        padding: '12px 20px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        opacity: disabled ? 0.6 : 1
                    }}
                >
                    Checked: Not empty
                </button>
                <button
                    onClick={onEmpty}
                    disabled={disabled}
                    style={{
                        padding: '12px 20px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        opacity: disabled ? 0.6 : 1
                    }}
                >
                    Checked: Empty
                </button>
            </div>
        </Popup>
    );
}

// Individual Herd Component
function Herd({ herdData, onHerdUpdate }) {
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
    const [narrowScreen, setnarrowScreen] = useState(false);

    // Check if screen is mobile size
    useEffect(() => {
        const checkMobile = () => {
            setnarrowScreen(window.innerWidth < 730);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Define columns for the animal table
    const animalColumns = [
        {
            key: 'CowTag',
            header: 'Cow Tag',
            width: '120px',
            type: 'text'
        },
        {
            key: 'DOB',
            header: 'DOB',
            type: 'date'
        }
    ];

    // Get current user when component mounts
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetch('/api/check-auth', {
                    credentials: 'include'
                });
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

    // Fetch feed status and available pastures when component mounts or herd changes
    useEffect(() => {
        const fetchHerdData = async () => {
            try {
                // Fetch feed status
                const feedResponse = await fetch(`/api/herd/${encodeURIComponent(herdData.herdName)}/feed-status`, {
                    credentials: 'include'
                });
                if (feedResponse.ok) {
                    const feedData = await feedResponse.json();
                    setFeedStatus(feedData.feedStatus || []);
                }

                // Fetch available pastures
                const pasturesResponse = await fetch('/api/pastures', {
                    credentials: 'include'
                });
                if (pasturesResponse.ok) {
                    const pasturesData = await pasturesResponse.json();
                    setAvailablePastures(pasturesData.pastures || []);
                }
            } catch (error) {
                console.error('Error fetching herd data:', error);
            }
        };

        fetchHerdData();
    }, [herdData.herdName]);

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
                headers: {
                    'Content-Type': 'application/json',
                },
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
                // Refresh feed status
                const feedResponse = await fetch(`/api/herd/${encodeURIComponent(herdData.herdName)}/feed-status`, {
                    credentials: 'include'
                });
                if (feedResponse.ok) {
                    const feedData = await feedResponse.json();
                    setFeedStatus(feedData.feedStatus || []);
                }
                onHerdUpdate(); // Refresh parent component
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
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    herdName: herdData.herdName,
                    feedType: item,
                    activityType: activityType,
                    username: currentUser
                })
            });

            if (response.ok) {
                // Refresh feed status
                const feedResponse = await fetch(`/api/herd/${encodeURIComponent(herdData.herdName)}/feed-status`, {
                    credentials: 'include'
                });
                if (feedResponse.ok) {
                    const feedData = await feedResponse.json();
                    setFeedStatus(feedData.feedStatus || []);
                }
                onHerdUpdate(); // Refresh parent component
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

    const handlePastureChange = async (newPasture) => {
        if (newPasture === currentPasture) return;

        setLoading(true);
        try {
            const response = await fetch('/api/move-herd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    herdName: herdData.herdName,
                    newPastureName: newPasture,
                    username: currentUser
                })
            });

            if (response.ok) {
                setCurrentPasture(newPasture);
                onHerdUpdate(); // Refresh parent component
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
            <div className="bubble-container" style={{ opacity: loading ? 0.7 : 1, padding: '0px' }}>
                {/* Navigation Bar - Clickable entire bar */}
                <div
                    onClick={handleMinimizeExpand}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
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

                {/* Content Window */}
                {isExpanded && (
                    <div style={{
                        display: 'flex',
                        padding: '15px',
                        gap: '20px',
                        minHeight: '400px',
                        overflow: 'hidden'
                    }}>
                        {/* Left Half - Fixed width */}
                        <div style={{
                            width: '200px',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '15px'
                        }}>
                            {/* Minimap */}
                            <div style={{
                                width: '200px',
                                height: '200px',
                                borderRadius: '5px',
                                overflow: 'hidden'
                            }}>
                                <Minimap
                                    cowTag=""
                                    pastureName={currentPasture}
                                />
                            </div>

                            {/* Pasture Selection */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '90%',
                                margin: '0 auto'
                            }}>
                                <select
                                    value={currentPasture}
                                    onChange={(e) => handlePastureChange(e.target.value)}
                                    disabled={loading}
                                    style={{
                                        flex: 1,
                                        padding: '5px',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px'
                                    }}
                                >
                                    <option value="">Select Pasture</option>
                                    {availablePastures.map((pasture, index) => (
                                        <option key={index} value={pasture}>
                                            {pasture}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Action Buttons */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                alignItems: 'center'
                            }}>
                                <button style={{
                                    width: '90%',
                                    margin: '0 auto',
                                    padding: '10px',
                                    backgroundColor: '#ffc107',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '18px'
                                }}>
                                    Split Herd
                                </button>

                                <button style={{
                                    width: '90%',
                                    margin: '0 auto',
                                    padding: '10px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '18px'
                                }}>
                                    New event
                                </button>

                                <button
                                    onClick={() => setShowAnimalList(!showAnimalList)}
                                    style={{
                                        width: '90%',
                                        margin: '0 auto',
                                        padding: '10px',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '18px'
                                    }}
                                >
                                    {showAnimalList ? 'Hide' : 'See'} full animal list...
                                </button>
                            </div>
                        </div>

                        {/* Right Half - Remaining space */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '15px',
                            minWidth: 0,
                            overflow: 'hidden'
                        }}>
                            {/* Animal Counts */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '23px', fontWeight: 'bold', marginBottom: '5px' }}>
                                    {herdData.cowCount} cows
                                </div>
                                <div style={{ fontSize: '23px', fontWeight: 'bold' }}>
                                    {herdData.goatCount} goats
                                </div>
                            </div>

                            {/* Status Information */}
                            <div style={{ marginTop: '20px' }}>
                                {/* Been on pasture - outside the table */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: '20px',
                                    padding: '10px',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '5px',
                                    border: '1px solid #ddd',
                                    boxSizing: 'border-box',
                                    maxWidth: '100%'
                                }}>
                                    <div style={{
                                        width: '140px',
                                        textAlign: 'right',
                                        paddingRight: '15px',
                                        fontWeight: 'bold',
                                        flexShrink: 0
                                    }}>
                                        On pasture since
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        textAlign: 'left',
                                        color: '#666',
                                        fontSize: '16px'
                                    }}>
                                        {herdData.daysOnPasture !== null ?
                                            <TimeSinceLabel date={new Date(Date.now() - herdData.daysOnPasture * 24 * 60 * 60 * 1000)} /> :
                                            'Unknown'
                                        }
                                    </div>
                                </div>

                                {/* Dynamic Status Table */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'max-content max-content 1fr',
                                    alignItems: 'center',
                                    gap: '0 15px', // Only horizontal gap
                                    boxSizing: 'border-box',
                                    maxWidth: '100%',
                                    overflow: 'hidden'
                                }}>
                                    {feedStatus.map((feed, index) => (
                                        <StatusRow
                                            key={index}
                                            label={feed.feedType}
                                            lastActivityDate={feed.lastActivityDate}
                                            onRefill={() => handleRefill(feed.feedType)}
                                            onAction={(action) => handleActionButton(feed.feedType, action)}
                                            onMobileAction={() => handleMobileAction(feed.feedType)}
                                            disabled={loading}
                                            narrowScreen={narrowScreen}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Animal List Section */}
                {showAnimalList && (
                    <div style={{ padding: '0 15px 15px 15px' }}>
                        <MultiCowTable
                            data={herdData.cows || []}
                            columns={animalColumns}
                            onViewClick={handleAnimalView}
                            title={`Animals in ${herdData.herdName}`}
                            emptyMessage="No animals in this herd"
                        />
                    </div>
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
                <div style={{ textAlign: 'center' }}>
                    <p style={{ marginBottom: '20px' }}>
                        Was the {refillItem.toLowerCase()} empty when you refilled it?
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button
                            onClick={() => handleRefillConfirm(true)}
                            disabled={loading}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            Yes, it was empty
                        </button>
                        <button
                            onClick={() => handleRefillConfirm(false)}
                            disabled={loading}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
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
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    padding: '20px 0'
                }}>
                    <button
                        onClick={() => handleRefill(refillItem)}
                        disabled={loading}
                        style={{
                            padding: '12px 20px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        Refilled
                    </button>
                    <button
                        onClick={() => handleActionButton(refillItem, 'Checked: not empty')}
                        disabled={loading}
                        style={{
                            padding: '12px 20px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        Checked: Not empty
                    </button>
                    <button
                        onClick={() => handleActionButton(refillItem, 'Checked: empty')}
                        disabled={loading}
                        style={{
                            padding: '12px 20px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        Checked: Empty
                    </button>
                </div>
            </Popup>
        </>
    );
}




function StatusRow({ label, lastActivityDate, onRefill, onAction, onMobileAction, disabled, narrowScreen }) {
    if (narrowScreen) {
        // On narrow screens, break out of the grid and use a 2-row layout
        return (
            <div style={{
                gridColumn: '1 / -1', // Span all columns
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderBottom: '1px solid #eee',
                paddingBottom: '8px',
                marginBottom: '12px'
            }}>
                {/* First row: Label and Button */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: 1,
                        gap: '2px'
                    }}>
                        <div style={{
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                        }}>
                            {label}
                        </div>
                        <div style={{
                            textAlign: 'center',
                            color: '#666',
                            fontSize: '14px'
                        }}>
                            <TimeSinceLabel date={lastActivityDate} />
                        </div>
                    </div>
                    <button
                        onClick={onMobileAction}
                        disabled={disabled}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            minWidth: '80px',
                            textAlign: 'center',
                            flexShrink: 0,
                            opacity: disabled ? 0.6 : 1,
                            alignSelf: 'center'
                        }}
                    >
                        Update
                    </button>
                </div>
            </div>
        );
    }

    // On wider screens, use the normal 3-column grid layout
    return (
        <>
            <div style={{
                textAlign: 'right',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
            }}>
                {label}
            </div>
            <div style={{
                textAlign: 'left',
                color: '#666',
                whiteSpace: 'nowrap'
            }}>
                <TimeSinceLabel date={lastActivityDate} />
            </div>
            <div style={{
                display: 'flex',
                gap: '5px',
                justifyContent: 'flex-start',
                borderBottom: '1px solid #eee',
                paddingBottom: '8px',
                marginBottom: '12px'
            }}>
                <button
                    onClick={onRefill}
                    disabled={disabled}
                    style={{
                        padding: '6px 10px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        minWidth: '60px',
                        textAlign: 'center',
                        flexShrink: 0,
                        opacity: disabled ? 0.6 : 1
                    }}
                >
                    Refilled
                </button>
                <button
                    onClick={() => onAction('Checked: not empty')}
                    disabled={disabled}
                    style={{
                        padding: '6px 10px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        minWidth: '70px',
                        textAlign: 'center',
                        flexShrink: 0,
                        opacity: disabled ? 0.6 : 1
                    }}
                >
                    Not empty
                </button>
                <button
                    onClick={() => onAction('Checked: empty')}
                    disabled={disabled}
                    style={{
                        padding: '6px 10px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        minWidth: '55px',
                        textAlign: 'center',
                        flexShrink: 0,
                        opacity: disabled ? 0.6 : 1
                    }}
                >
                    Empty
                </button>
            </div>
        </>
    );
}

// Main Herds Container Component
function Herds() {
    const [herds, setHerds] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHerds = async () => {
        try {
            const response = await fetch('/api/herds', {
                credentials: 'include'
            });

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
        // Refresh all herd data when any herd is updated
        fetchHerds();
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
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
            <h1>Herd Management</h1>

            {herds.length > 0 ? (
                herds.map((herdData, index) => (
                    <Herd
                        key={index}
                        herdData={herdData}
                        onHerdUpdate={handleHerdUpdate}
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
        </div>
    );
}

export default Herds;