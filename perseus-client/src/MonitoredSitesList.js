// src/MonitoredSitesList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MonitoredSitesList = () => {
    const [sites, setSites] = useState([]);
    const [error, setError] = useState('');
    const [editingSiteId, setEditingSiteId] = useState(null);
    const [editWebsite, setEditWebsite] = useState('');
    const [editKeyword, setEditKeyword] = useState('');

    useEffect(() => {
        fetchSites();  // Fetch the sites when the component loads
    }, []);

    const fetchSites = () => {
        axios.get('http://localhost:3001/sites')
            .then(response => {
                setSites(response.data);
            })
            .catch(error => {
                setError('Failed to fetch sites.');
                console.error('Error fetching sites:', error);
            });
    };

    const handleEdit = (site) => {
        setEditingSiteId(site.id);
        setEditWebsite(site.website_url);
        setEditKeyword(site.keyword);
    };

    const handleUpdate = (id) => {
        axios.put(`http://localhost:3001/sites/${id}`, { website_url: editWebsite, keyword: editKeyword })
            .then(response => {
                setEditingSiteId(null);
                fetchSites();  // Refresh the list after update
            })
            .catch(error => {
                setError('Failed to update site.');
                console.error('Error updating site:', error);
            });
    };

    const handleDelete = (id) => {
        axios.delete(`http://localhost:3001/sites/${id}`)
            .then(response => {
                fetchSites();  // Refresh the list after deletion
            })
            .catch(error => {
                setError('Failed to delete site.');
                console.error('Error deleting site:', error);
            });
    };

    return (
        <div className="mt-5">
            <h3>Monitored Websites and Keywords</h3>
            {error && <p className="text-danger">{error}</p>}
            {sites.length === 0 ? (
                <p>No websites are being monitored.</p>
            ) : (
                <ul className="list-group">
                    {sites.map((site) => (
                        <li key={site.id} className="list-group-item">
                            {editingSiteId === site.id ? (
                                <div>
                                    <input
                                        type="text"
                                        className="form-control mb-2"
                                        value={editWebsite}
                                        onChange={(e) => setEditWebsite(e.target.value)}
                                        placeholder="Edit website URL"
                                    />
                                    <input
                                        type="text"
                                        className="form-control mb-2"
                                        value={editKeyword}
                                        onChange={(e) => setEditKeyword(e.target.value)}
                                        placeholder="Edit keyword"
                                    />
                                    <button className="btn btn-success btn-sm" onClick={() => handleUpdate(site.id)}>Save</button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingSiteId(null)}>Cancel</button>
                                </div>
                            ) : (
                                <>
                                    <strong>{site.website_url}</strong> - Keyword: {site.keyword}
                                    <button className="btn btn-warning btn-sm float-end" onClick={() => handleEdit(site)}>Edit</button>
                                    <button className="btn btn-danger btn-sm float-end me-2" onClick={() => handleDelete(site.id)}>Delete</button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MonitoredSitesList;
