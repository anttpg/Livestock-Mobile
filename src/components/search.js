import './search.css';
import { useState } from "react";

export default function Search({ onSearch }) {
    const [inputValue, setInputValue] = useState("");

    const handleSubmit = (event) => {
        event.preventDefault();
        if (inputValue.trim()) {
            onSearch(inputValue.trim()); // Pass cowTag to parent
        } else {
            alert("Please enter a Cow Tag.");
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter Cow Tag"
                required
            />
            <button type="submit">Search</button>
        </form>
    );
}