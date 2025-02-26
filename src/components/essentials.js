import { useEffect, useState } from "react";
import "./components/essentials.css"

export default function Essentials({ cowTag }) {
    const [cowData, setCowData] = useState(null);
    const [error, setError] = useState(null);

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    useEffect(() => {
        async function fetchCowData() {
            try {
                const response = await fetch(`/api/cow/${cowTag}`);
                const data = await response.json();

                if (data.cowData && data.cowData.length > 0) {
                    setCowData(data.cowData[0]);
                } else {
                    setError(`Cow ${cowTag} not found`);
                }
            } catch (error) {
                console.error('Error fetching cow data:', error);
                setError('Error fetching cow data');
            }
        }

        if (cowTag) {
            fetchCowData();
        }
    }, [cowTag]);

    return (
        <div>
            <h2>Date of Birth</h2>
            <i>{formatDate(cowData.DateOfBirth)}</i>
            <h2>Last Weight</h2>
            <i>{cowData.Weight}</i>
            <h2>Temperament</h2>
            <i>{cowData.Temperament}</i>
            <h2>Description</h2>
            <i>{cowData.Description}</i>
        </div>
    );
}