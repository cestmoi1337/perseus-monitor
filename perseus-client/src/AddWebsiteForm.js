// src/AddWebsiteForm.js
import React, { useState } from 'react';
import axios from 'axios';

const AddWebsiteForm = ({ onAdd }) => {
    const [website, setWebsite] = useState('');
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Clear both success and error messages before making the request
        setError('');
        setSuccessMessage('');

        if (!website || !keyword) {
            setError('Both website and keyword are required.');
            return;
        }

        // Make the POST request to add the site and keyword
        axios.post('http://localhost:3001/add-site', { website_url: website, keyword })
            .then(response => {
                setSuccessMessage('Website and keyword added successfully!');
                setWebsite('');  // Clear the form fields
                setKeyword('');
                onAdd();  // Trigger the callback to refresh the list
            })
            .catch(error => {
                setError('Failed to add website and keyword.');
                console.error('Error adding site:', error);
            });
    };

    return (
        <div>
            <h3>Add Website and Keyword</h3>
            {/* Conditionally render only one message */}
            {error && <p className="text-danger">{error}</p>}
            {successMessage && <p className="text-success">{successMessage}</p>}
            
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label className="form-label">Website URL</label>
                    <input
                        type="text"
                        className="form-control"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="Enter website URL"
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Keyword</label>
                    <input
                        type="text"
                        className="form-control"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Enter keyword to monitor"
                    />
                </div>
                <button type="submit" className="btn btn-primary">Add Website</button>
            </form>
        </div>
    );
};

export default AddWebsiteForm;
