// src/App.js
import React from 'react';
import AddWebsiteForm from './AddWebsiteForm';
import MonitoredSitesList from './MonitoredSitesList';

const App = () => {
    return (
        <div className="container">
            <h1>Perseus Website Monitor</h1>
            <AddWebsiteForm />
            <MonitoredSitesList />
        </div>
    );
};

export default App;
