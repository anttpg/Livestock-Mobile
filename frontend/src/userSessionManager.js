import { useState, useEffect, useCallback } from 'react';

export const useUserSessionManager = (isAuthenticated = false) => {
      const WARNING_THRESHOLD_MS = 60 * 1000; 
      const CHECK_INTERVAL_MS = 30 * 1000;
      const INITIAL_MONITORING_DELAY_MS = 58 * 60 * 1000; 

    // const WARNING_THRESHOLD_MS = 60 * 1000;        // 10 seconds
    // const CHECK_INTERVAL_MS = 2 * 1000;           // 2 seconds  
    // const INITIAL_MONITORING_DELAY_MS = 1 * 1000; // 10 seconds
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
    const [remainingTime, setRemainingTime] = useState(null);

    const checkSessionTime = useCallback(async () => {
        // Don't check if not authenticated
        if (!isAuthenticated) {
            return 0;
        }
        
        try {
            const response = await fetch('/api/session-time-remaining', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setRemainingTime(data.remainingMs);

                // Print remaining session time
                //console.log(`Session time remaining: ${Math.floor(data.remainingMs / 1000)} seconds`);

                if (data.remainingMs <= WARNING_THRESHOLD_MS && data.remainingMs > 0) {
                    setShowTimeoutWarning(true);
                }

                return data.remainingMs;
            } else {
                return 0;
            }
        } catch (error) {
            console.error('Error checking session time:', error);
            return 0;
        }
    }, [WARNING_THRESHOLD_MS, isAuthenticated]);

    useEffect(() => {
        // Don't start monitoring if not authenticated
        if (!isAuthenticated) {
            return;
        }

        let intervalId;
        const startMonitoring = () => {
            intervalId = setInterval(checkSessionTime, CHECK_INTERVAL_MS);
        };

        const initialDelay = setTimeout(() => {
            //console.log('Starting session monitoring...');
            startMonitoring();
        }, INITIAL_MONITORING_DELAY_MS);

        return () => {
            clearTimeout(initialDelay);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [checkSessionTime, CHECK_INTERVAL_MS, INITIAL_MONITORING_DELAY_MS, isAuthenticated]);

    // Reset warning when authentication status changes
    useEffect(() => {
        if (!isAuthenticated) {
            setShowTimeoutWarning(false);
            setRemainingTime(null);
        }
    }, [isAuthenticated]);

    const handleExtendSession = () => {
        setShowTimeoutWarning(false);
        // Reset the monitoring cycle
        setTimeout(() => {
            // Restart monitoring after extending session
        }, INITIAL_MONITORING_DELAY_MS);
    };

    const handleTimeoutClose = () => {
        setShowTimeoutWarning(false);
    };

    return {
        showTimeoutWarning,
        remainingTime,
        handleExtendSession,
        handleTimeoutClose,
        checkSessionTime
    };
};