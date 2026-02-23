import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Folder from './folder';
import SearchBar from './searchBar';
import General from './general';
import Medical from './medical';
import BreedingFitness from './breedingFitness';
import Sales from './sales';

function AnimalFolder() {
    const [hasSeriousIssues, setHasSeriousIssues] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || '36';

    const tabs = useMemo(() => [
        { id: 'general', label: 'General' },
        { id: 'medical', label: 'Medical' },
        { id: 'breeding', label: 'Breeding Fitness' },
        { id: 'sales', label: 'Purchase & Sales' }
    ], []);

    const handleDataFetch = async (tab) => {
        if (!searchTerm || searchTerm.trim() === '') return null;

        try {
            let endpoint = `/api/cow/${encodeURIComponent(searchTerm)}`;
            if (tab === 'medical') {
                endpoint = `/api/medical/${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(endpoint, { credentials: 'include' });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return null;
                }
                throw new Error(`Failed to fetch ${tab} data`);
            }

            const data = await response.json();

            if (tab === 'medical' && data.medicalRecords?.issues) {
                setHasSeriousIssues(data.medicalRecords.issues.some(r => r.IssueSerious));
            }

            return data;
        } catch (error) {
            console.error(`Error fetching ${tab} data:`, error);
            return null;
        }
    };

    const renderTab = (tabConfig, data, helpers) => {
        if (!tabConfig || !searchTerm) return null;

        switch (tabConfig.id) {
            case 'general':
                return <General 
                            cowTag={searchTerm} 
                            cowData={data} 
                            onRefresh={helpers.onRefresh} 
                        />;
            case 'medical':
                return <Medical 
                            cowTag={searchTerm} 
                            cowData={data} 
                            loading={helpers.loading}
                            onRefresh={helpers.onRefresh} 
                        />;
            case 'breeding':
                return <BreedingFitness 
                            cowTag={searchTerm} 
                            cowData={data} 
                            loading={helpers.loading} 
                        />;
            case 'sales':
                return <Sales 
                            cowTag={searchTerm} 
                        />;
            default:
                return null;
        }
    };

    return (
        <div>
            <SearchBar
                value={searchTerm}
                placeholder="Search by tag"
            />
            <Folder
                title="Animal Records"
                tabs={tabs}
                defaultTab="general"
                fetchKey={searchTerm}
                onDataFetch={handleDataFetch}
                renderTab={renderTab}
                alertStates={{ medical: hasSeriousIssues }}
                alertColors={{ medical: '#cf7b79' }}
            />
        </div>
    );
}

export default AnimalFolder;