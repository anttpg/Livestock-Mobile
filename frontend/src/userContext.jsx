import React, { createContext, useContext, useState, useEffect } from 'react';
import { setSessionExpiredCallback } from './apiInterceptor';

const UserContext = createContext();

export function UserProvider({ children }) {
    const [authState, setAuthState] = useState('checking');
    const [authData, setAuthData] = useState(null);
    const [user, setUser] = useState(null);
    const [showSessionExpired, setShowSessionExpired] = useState(false);

    const checkAuthStatus = async () => {
        try {
            const sessionResponse = await fetch('/api/check-auth', {
                credentials: 'include'
            });

            if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                if (sessionData.authenticated) {
                    setUser(sessionData.user);
                    setAuthState('authenticated');
                    return;
                }
            }

            const authCheckResponse = await fetch('/api/auth/check', {
                credentials: 'include'
            });

            if (authCheckResponse.ok) {
                const authCheckData = await authCheckResponse.json();
                
                if (authCheckData.blocked) {
                    setAuthState('blocked');
                    setAuthData(authCheckData);
                } else if (authCheckData.needsRegistration) {
                    setAuthState('needsRegistration');
                    setAuthData(authCheckData);
                } else if (authCheckData.needsPasswordSetup) {
                    setAuthState('needsPasswordSetup');
                    setAuthData(authCheckData);
                } else if (authCheckData.needsLogin) {
                    setAuthState('needsLogin');
                    setAuthData(authCheckData);
                } else {
                    setAuthState('needsLogin');
                }
            } else {
                setAuthState('needsLogin');
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setAuthState('needsLogin');
        }
    };

    useEffect(() => {
        checkAuthStatus();

        setSessionExpiredCallback(() => {
            setAuthState('needsLogin');
            setUser(null);
            setShowSessionExpired(true);
        });
    }, []);

    const handleSessionExpiredClose = () => {
        setShowSessionExpired(false);
    };

    const value = {
        user,
        authState,
        authData,
        showSessionExpired,
        handleSessionExpiredClose,
        checkAuthStatus
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within UserProvider');
    }
    return context;
}