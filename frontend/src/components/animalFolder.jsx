import React, { useState, useEffect } from 'react';
import Folder from './folder';
import General from './general';
import Medical from './medical';
import BreedingFitness from './breedingFitness';
import Sales from './sales';

function AnimalFolder() {
    const [allCows, setAllCows] = useState([]);
    const [hasSeriousIssues, setHasSeriousIssues] = useState(false);

    // Define tabs configuration
    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'medical', label: 'Medical' },
        { id: 'breeding', label: 'Breeding Fitness' },
        { id: 'sales', label: `Purchase & Sales` }
    ];

    // Search configuration
    const searchConfig = {
        enabled: true,
        placeholder: "Search by tag",
        options: allCows
    };

    // Fetch all cows for autocomplete
    useEffect(() => {
        const fetchAllCows = async () => {
            try {
                const response = await fetch('/api/cows/by-herd', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    setAllCows(data.cows || []);
                }
            } catch (error) {
                console.error('Error fetching all cows:', error);
            }
        };
        fetchAllCows();
    }, []);

    // Function to fetch data for each tab
    const handleDataFetch = async (searchTag, tab) => {
        if (!searchTag || searchTag.trim() === '') return null;

        try {
            let endpoint = `/api/cow/${searchTag}`;
            if (tab === 'medical') { 
                endpoint = `/api/cow/${searchTag}/medical`;
            } else if (tab === 'breeding') {
                // Use the same general endpoint since breeding fitness uses the same cow data
                // EPDs will be fetched separately by the BreedingFitness component
                endpoint = `/api/cow/${searchTag}`;
            }

            const response = await fetch(endpoint, {
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return null;
                }
                throw new Error(`Failed to fetch ${tab} data`);
            }

            const data = await response.json();
            //console.log(`Received cow data for endpoint ${endpoint}:`, data);

            // Check for serious issues in medical data
            if (tab === 'medical' && data.medicalRecords && data.medicalRecords.issues) {
                const hasSeriousIssue = data.medicalRecords.issues.some(record => record.IssueSerious);
                setHasSeriousIssues(hasSeriousIssue);
            }

            return data;
        } catch (error) {
            console.error(`Error fetching ${tab} data:`, error);
            return null;
        }
    };

    // Function to render tab content
    const renderTab = (tabConfig, data, searchTerm, helpers) => {
        if (!tabConfig || !searchTerm) return null;

        switch (tabConfig.id) {
            case 'general':
                return (
                    <General
                        cowTag={searchTerm}
                        cowData={data}
                        allCows={allCows}
                        onRefresh={helpers.onRefresh}
                        onNavigate={helpers.onNavigate}
                        hideSearchBar={helpers.hideSearchBar}
                    />
                );
            case 'medical':
                return (
                    <Medical
                        cowTag={searchTerm}
                        cowData={data}
                        loading={helpers.loading}
                        hideSearchBar={helpers.hideSearchBar}
                        onDataUpdate={helpers.onRefresh}
                    />
                );
            case 'breeding':
                return (
                    <BreedingFitness
                        cowTag={searchTerm}
                        cowData={data}
                        loading={helpers.loading}
                        onNavigate={helpers.onNavigate}
                    />
                );
            case 'sales':
                return (
                    <Sales
                        cowTag={searchTerm}
                    />
                );
            default:
                return null;
        }
    };


    return (
        <Folder
            title="Animal Records"
            tabs={tabs}
            searchConfig={searchConfig}
            defaultTab="general"
            defaultSearch="36"
            enableDefaultSearch={true}
            onDataFetch={handleDataFetch}
            renderTab={renderTab}
            alertStates={{medical: hasSeriousIssues/*, sales: true*/}}
            alertColors={{medical: '#cf7b79'/*, sales: '#fcc858ff'*/}}
        />
    );
}

export default AnimalFolder;