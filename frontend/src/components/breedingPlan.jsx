import React, { useState, useEffect } from 'react';
import Folder from './folder';
import PregCheck from './pregCheck';
import CalvingTracker from './calvingTracker';
import WeanlingTracker from './weanlingTracker';
import '../screenSizing.css';

function BreedingPlan() {
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState('');
    const [planOverview, setPlanOverview] = useState(null);
    const [loading, setLoading] = useState(false);

    // Define tabs configuration for breeding plan
    const tabs = [
        { id: 'plan', label: 'Plan' },
        { id: 'pregnancy', label: 'Pregnancy' },
        { id: 'calves', label: 'Calves' },
        { id: 'weanlings', label: 'Weanlings' }
    ];

    // Fetch breeding plans on component mount
    useEffect(() => {
        fetchBreedingPlans();
    }, []);

    // Fetch plan overview when plan is selected
    useEffect(() => {
        if (selectedPlan) {
            fetchPlanOverview();
        }
    }, [selectedPlan]);

    const fetchBreedingPlans = async () => {
        try {
            const response = await fetch('/api/breeding-plans', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const plans = data.plans || [];

                // Sort by year (descending)
                const sortedPlans = plans.sort((a, b) => b.PlanYear - a.PlanYear);
                setBreedingPlans(sortedPlans);

                // Select most recent plan by default
                if (sortedPlans.length > 0) {
                    setSelectedPlan(sortedPlans[0].ID);
                }
            } else {
                console.error('Failed to fetch breeding plans');
                setBreedingPlans([]);
            }
        } catch (error) {
            console.error('Error fetching breeding plans:', error);
            setBreedingPlans([]);
        }
    };

    const fetchPlanOverview = async () => {
        if (!selectedPlan) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/breeding-plan/${selectedPlan}/overview`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setPlanOverview(data);
            } else {
                console.error('Failed to fetch plan overview');
                setPlanOverview(null);
            }
        } catch (error) {
            console.error('Error fetching plan overview:', error);
            setPlanOverview(null);
        } finally {
            setLoading(false);
        }
    };

    // Function to render tab content
    const renderTab = (tabConfig, data, searchTerm, helpers) => {
        if (!tabConfig) return null;

        // Get the selected plan data for year context
        const selectedPlanData = breedingPlans.find(p => p.ID === parseInt(selectedPlan));
        const breedingYear = selectedPlanData?.PlanYear;

        switch (tabConfig.id) {
            case 'plan':
                return renderPlanOverview();
            case 'pregnancy':
                return <PregCheck breedingPlanId={selectedPlan} breedingYear={breedingYear} />;
            case 'calves':
                return <CalvingTracker breedingPlanId={selectedPlan} breedingYear={breedingYear} />;
            case 'weanlings':
                return <WeanlingTracker breedingPlanId={selectedPlan} breedingYear={breedingYear} />;
            default:
                return null;
        }
    };

    function BullAssignmentComponent({ selectedPlan, unassignedAnimals, onAssignmentComplete }) {
        const [breedingAnimalStatus, setBreedingAnimalStatus] = useState(null);
        const [selectedBull, setSelectedBull] = useState('');
        const [selectedCows, setSelectedCows] = useState(new Set());
        const [exposureStartDate, setExposureStartDate] = useState('');
        const [exposureEndDate, setExposureEndDate] = useState('');
        const [assigning, setAssigning] = useState(false);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            fetchBreedingAnimalStatus();
            // Set default dates (current date to 45 days later)
            const today = new Date();
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() + 45);

            setExposureStartDate(today.toISOString().split('T')[0]);
            setExposureEndDate(endDate.toISOString().split('T')[0]);
        }, []);

        const fetchBreedingAnimalStatus = async () => {
            try {
                const response = await fetch('/api/breeding-animal-status', {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    setBreedingAnimalStatus(data);
                } else {
                    console.error('Failed to fetch breeding animal status');
                }
            } catch (error) {
                console.error('Error fetching breeding animal status:', error);
            } finally {
                setLoading(false);
            }
        };

        const handleCowSelection = (cowTag, selected) => {
            const newSelected = new Set(selectedCows);
            if (selected) {
                newSelected.add(cowTag);
            } else {
                newSelected.delete(cowTag);
            }
            setSelectedCows(newSelected);
        };

        const handleSelectAll = (selected) => {
            if (selected && breedingAnimalStatus) {
                setSelectedCows(new Set(breedingAnimalStatus['unassigned-cows'].map(animal => animal.CowTag)));
            } else {
                setSelectedCows(new Set());
            }
        };

        const handleAssignment = async () => {
            if (!selectedBull || selectedCows.size === 0 || !exposureStartDate || !exposureEndDate) {
                alert('Please select a bull, cows, and exposure dates');
                return;
            }

            setAssigning(true);
            try {
                const response = await fetch('/api/assign-breeding-records', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        planId: selectedPlan,
                        primaryBull: selectedBull,
                        cowTags: Array.from(selectedCows),
                        exposureStartDate,
                        exposureEndDate
                    })
                });

                if (response.ok) {
                    alert(`Successfully assigned ${selectedCows.size} cows to ${selectedBull}`);
                    setSelectedCows(new Set());
                    setSelectedBull('');
                    onAssignmentComplete(); // Refresh the overview
                    fetchBreedingAnimalStatus(); // Refresh the animal status
                } else {
                    const error = await response.text();
                    alert(`Failed to assign breeding records: ${error}`);
                }
            } catch (error) {
                console.error('Error assigning breeding records:', error);
                alert('Error assigning breeding records');
            } finally {
                setAssigning(false);
            }
        };

        if (loading) {
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    Loading breeding animal status...
                </div>
            );
        }

        if (!breedingAnimalStatus) {
            return (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    Failed to load breeding animal status
                </div>
            );
        }

        const unassignedCows = unassignedAnimals || [];
        const bulls = breedingAnimalStatus.bulls || [];

        return (
            <div>
                {/* Bull Selection */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                        Select Bull:
                    </label>
                    <select
                        value={selectedBull}
                        onChange={(e) => setSelectedBull(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }}
                    >
                        <option value="">Choose a bull...</option>
                        {bulls.map((bull) => {
                            const ageYears = Math.floor(bull.AgeInMonths / 12);
                            const ageMonths = bull.AgeInMonths % 12;
                            const ageDisplay = ageYears > 0
                                ? `${ageYears}y ${ageMonths}m`
                                : `${ageMonths}m`;

                            return (
                                <option key={bull.CowTag} value={bull.CowTag}>
                                    {bull.CowTag} - {bull.Description || 'No description'} ({ageDisplay})
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* Exposure Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Exposure Start:
                        </label>
                        <input
                            type="date"
                            value={exposureStartDate}
                            onChange={(e) => setExposureStartDate(e.target.value)}
                            style={{
                                width: '95%',
                                padding: '8px',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Exposure End:
                        </label>
                        <input
                            type="date"
                            value={exposureEndDate}
                            onChange={(e) => setExposureEndDate(e.target.value)}
                            style={{
                                width: '95%',
                                padding: '8px',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}
                        />
                    </div>
                </div>

                {/* Animal Status Summary */}
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>Current Animal Status:</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px', fontSize: '12px' }}>
                        <div>Bulls: {bulls.length}</div>
                        <div>Calfs: {breedingAnimalStatus.calfs?.length || 0}</div>
                        <div>Yearlings: {breedingAnimalStatus.yearlings?.length || 0}</div>
                        <div>Assigned: {breedingAnimalStatus['assigned-cow']?.length || 0}</div>
                        <div>Unassigned: {unassignedCows.length}</div>
                    </div>
                </div>


                {/* Assignment Button */}
                <button
                    onClick={handleAssignment}
                    disabled={assigning || !selectedBull || selectedCows.size === 0 || unassignedCows.length === 0}
                    style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: assigning || unassignedCows.length === 0 ? '#ccc' : '#7b1fa2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        marginBottom: '12px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: assigning || unassignedCows.length === 0 ? 'not-allowed' : 'pointer'
                    }}
                >
                    {assigning ? 'Assigning...' : 
                     unassignedCows.length === 0 ? 'No Unassigned Cows Available' :
                     `Assign ${selectedCows.size} Cows to Bull`}
                </button>


                {/* Cow Selection */}
                <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <label style={{ fontWeight: 'bold' }}>Select Unassigned Cows:</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="checkbox"
                                checked={selectedCows.size === unassignedCows.length && unassignedCows.length > 0}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                            Select All
                        </label>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                            ({selectedCows.size} selected)
                        </span>
                    </div>

                    <div style={{
                        // maxHeight: '200px',
                        // overflowY: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '10px',
                        backgroundColor: 'white'
                    }}>
                        {unassignedCows.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                No unassigned cows available for breeding assignment
                            </div>
                        ) : (
                            unassignedCows.map((animal) => {
                                const ageYears = Math.floor(animal.AgeInMonths / 12);
                                const ageMonths = animal.AgeInMonths % 12;

                                return (
                                    <label
                                        key={animal.CowTag}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '5px 0',
                                            borderBottom: '1px solid #f0f0f0'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedCows.has(animal.CowTag)}
                                            onChange={(e) => handleCowSelection(animal.CowTag, e.target.checked)}
                                        />
                                        <span style={{ fontWeight: 'bold' }}>{animal.CowTag}</span>
                                        {animal.CurrentHerd && (
                                            <span style={{ color: '#666', fontSize: '14px' }}>
                                                ({animal.CurrentHerd})
                                            </span>
                                        )}
                                        <span style={{ color: '#888', fontSize: '12px', marginLeft: 'auto' }}>
                                            {ageYears > 0 ? `${ageYears}y ${ageMonths}m` : `${ageMonths}m`}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        );
    }

    const renderPlanOverview = () => {
        const selectedPlanData = breedingPlans.find(p => p.ID === parseInt(selectedPlan));

        return (
            <div className="bubble-container" style={{ padding: '0px', paddingTop: '40px', background: '#f8f9fa' }}>
                <div style={{ borderTop: '1px solid rgb(221, 221, 221)', padding: '10px', background: 'white' }}>
                    <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>
                        {selectedPlanData ? `${selectedPlanData.PlanName} - ${selectedPlanData.PlanYear}` : 'Plan Overview'}
                    </h2>

                    {loading ? (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '200px',
                            fontSize: '18px',
                            color: '#666'
                        }}>
                            Loading plan overview...
                        </div>
                    ) : planOverview ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '20px'
                        }}>

                            {/* Plan Details Card */}
                            <div style={{
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                padding: '20px',
                                backgroundColor: '#f3e5f5'
                            }}>
                                <h3 style={{ margin: '0 0 15px 0', color: '#7b1fa2' }}>
                                    Plan Details
                                </h3>
                                {selectedPlanData && (
                                    <div>
                                        <p><strong>Plan Name:</strong> {selectedPlanData.PlanName}</p>
                                        <p><strong>Year:</strong> {selectedPlanData.PlanYear}</p>
                                        <p><strong>Status:</strong> {selectedPlanData.IsActive ? 'Active' : 'Inactive'}</p>
                                        {selectedPlanData.Notes && (
                                            <p><strong>Notes:</strong> {selectedPlanData.Notes}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Pregnant Cows Card */}
                            <div style={{
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                padding: '20px',
                                backgroundColor: '#e8f5e8'
                            }}>
                                <h3 style={{
                                    margin: '0 0 15px 0',
                                    color: '#2e7d32',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    Pregnant Cows
                                    <span style={{
                                        fontSize: '24px',
                                        fontWeight: 'bold',
                                        color: '#1b5e20'
                                    }}>
                                        {planOverview.pregnantCount || 0}
                                    </span>
                                </h3>
                                <p style={{ margin: '0', color: '#666' }}>
                                    Cows confirmed pregnant through pregnancy checks
                                </p>
                                {planOverview.pregnancyRate && (
                                    <div style={{ marginTop: '10px' }}>
                                        <strong>Pregnancy Rate: {planOverview.pregnancyRate}%</strong>
                                    </div>
                                )}
                            </div>

                            {/* Calves Born Card */}
                            <div style={{
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                padding: '20px',
                                backgroundColor: '#e3f2fd'
                            }}>
                                <h3 style={{
                                    margin: '0 0 15px 0',
                                    color: '#1976d2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    Calves Born This Year
                                    <span style={{
                                        fontSize: '24px',
                                        fontWeight: 'bold',
                                        color: '#0d47a1'
                                    }}>
                                        {planOverview.calvesCount || 0}
                                    </span>
                                </h3>
                                <p style={{ margin: '0', color: '#666' }}>
                                    Calves born in {selectedPlanData?.PlanYear || 'current year'}
                                </p>
                                {planOverview.calvingSeason && (
                                    <div style={{ marginTop: '10px' }}>
                                        <strong>Calving Season: {planOverview.calvingSeason}</strong>
                                    </div>
                                )}
                            </div>

                            {/* Unassigned Animals Card */}
                            <div style={{
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                padding: '20px',
                                backgroundColor: '#fff8e1'
                            }}>
                                <h3 style={{
                                    margin: '0 0 15px 0',
                                    color: '#f57c00',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    Unassigned Animals
                                    <span style={{
                                        fontSize: '24px',
                                        fontWeight: 'bold',
                                        color: '#e65100'
                                    }}>
                                        {planOverview.unassignedCount || 0}
                                    </span>
                                </h3>
                                <p style={{ margin: '0 0 10px 0', color: '#666' }}>
                                    Active breeding-age animals not assigned to a bull
                                </p>
                                {planOverview.unassignedAnimals && planOverview.unassignedAnimals.length > 0 && (
                                    <details style={{ marginTop: '10px' }}>
                                        <summary style={{
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            color: '#f57c00'
                                        }}>
                                            View Animals ({planOverview.unassignedAnimals.length})
                                        </summary>
                                        <div style={{
                                            marginTop: '10px',
                                            padding: '10px',
                                            backgroundColor: '#fff',
                                            borderRadius: '4px',
                                            border: '1px solid #e0e0e0'
                                        }}>
                                            {planOverview.unassignedAnimals.map((animal, index) => (
                                                <div key={index} style={{
                                                    padding: '5px 0',
                                                    borderBottom: index < planOverview.unassignedAnimals.length - 1 ? '1px solid #eee' : 'none'
                                                }}>
                                                    <span style={{ fontWeight: 'bold' }}>{animal.CowTag}</span>
                                                    {animal.CurrentHerd && (
                                                        <span style={{ marginLeft: '10px', color: '#666' }}>
                                                            ({animal.CurrentHerd})
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>

                            {/* Bull Assignment Card - Only show if there are unassigned animals */}
                            {planOverview?.unassignedCount > 0 && (
                                <div style={{
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    padding: '20px',
                                    backgroundColor: '#ccdee2ff',
                                    gridColumn: '1 / -1' // Span from first to last column
                                }}>
                                    <h3 style={{
                                        margin: '0 0 15px 0',
                                        color: '#587880ff'
                                    }}>
                                        Assign Cows to Bulls
                                    </h3>
                                    <BullAssignmentComponent
                                        selectedPlan={selectedPlan}
                                        unassignedAnimals={planOverview.unassignedAnimals}
                                        onAssignmentComplete={fetchPlanOverview}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            color: '#666',
                            fontSize: '16px'
                        }}>
                            No plan data available. Please select a breeding plan.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTitle = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <span>Breeding Plan</span>
            <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                style={{
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                    minWidth: '200px',
                    backgroundColor: 'white'
                }}
            >
                <option value="">Select a plan...</option>
                {breedingPlans.map((plan) => (
                    <option key={plan.ID} value={plan.ID}>
                        {plan.PlanYear} - {plan.PlanName}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderTitle()}
            <Folder
                title=""
                tabs={tabs}
                defaultTab="plan"
                renderTab={renderTab}
                selectedTabColor='#f8f9fa'
            />
        </div>
    );
}

export default BreedingPlan;