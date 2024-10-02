// index.js

// Import required modules
const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // For SQLite database
const path = require('path'); // To handle file paths
const app = express();
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

// Set the port for the server
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

const cors = require('cors');
app.use(cors());

// Initialize SQLite Database
const db = new sqlite3.Database('./perseus.db', (err) => {
    if (err) {
        console.error('Error opening SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create the websites table
        db.run(`
            CREATE TABLE IF NOT EXISTS websites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                website_url TEXT NOT NULL
            )
        `);

        // Create the keywords table
        db.run(`
            CREATE TABLE IF NOT EXISTS keywords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT NOT NULL
            )
        `);

        // Create a table to map websites to keywords (many-to-many)
        db.run(`
            CREATE TABLE IF NOT EXISTS website_keyword (
                website_id INTEGER,
                keyword_id INTEGER,
                PRIMARY KEY (website_id, keyword_id),
                FOREIGN KEY (website_id) REFERENCES websites(id),
                FOREIGN KEY (keyword_id) REFERENCES keywords(id)
            )
        `);
    }
});

// Test route to ensure the server is working
app.get('/', (req, res) => {
    res.send('Perseus Monitoring App API is running.');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Route to add a new website
app.post('/websites', (req, res) => {
    const { website_url } = req.body;

    if (!website_url) {
        return res.status(400).json({ error: 'Website URL is required.' });
    }

    const query = `INSERT INTO websites (website_url) VALUES (?)`;
    db.run(query, [website_url], function (err) {
        if (err) {
            console.error('Error adding website:', err.message);
            return res.status(500).json({ error: 'Error adding website.' });
        }

        return res.status(201).json({ message: 'Website added successfully.', id: this.lastID });
    });
});

// Route to get all websites
app.get('/websites', (req, res) => {
    db.all(`SELECT * FROM websites`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching websites from the database:', err.message);
            res.status(500).json({ error: 'Error fetching websites' });
        } else {
            res.json(rows);
        }
    });
});

// Route to delete a website
app.delete('/websites/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM websites WHERE id = ?`, [id], (err) => {
        if (err) {
            res.status(500).json({ error: 'Error deleting website' });
        } else {
            res.json({ message: 'Website deleted successfully' });
        }
    });
});

// Route to add a new keyword
app.post('/keywords', (req, res) => {
    const { keyword } = req.body;

    if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required.' });
    }

    const query = `INSERT INTO keywords (keyword) VALUES (?)`;
    db.run(query, [keyword], function (err) {
        if (err) {
            console.error('Error adding keyword:', err.message);
            return res.status(500).json({ error: 'Error adding keyword.' });
        }

        return res.status(201).json({ message: 'Keyword added successfully.', id: this.lastID });
    });
});

// Route to get all keywords
app.get('/keywords', (req, res) => {
    db.all(`SELECT * FROM keywords`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching keywords from the database:', err.message);
            res.status(500).json({ error: 'Error fetching keywords' });
        } else {
            res.json(rows);
        }
    });
});

// Route to delete a keyword
app.delete('/keywords/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM keywords WHERE id = ?`, [id], (err) => {
        if (err) {
            res.status(500).json({ error: 'Error deleting keyword' });
        } else {
            res.json({ message: 'Keyword deleted successfully' });
        }
    });
});

// Route to map a keyword to a website (create entry in the website_keyword table)
app.post('/map-keyword', (req, res) => {
    const { website_id, keyword_id } = req.body;

    const query = `INSERT INTO website_keyword (website_id, keyword_id) VALUES (?, ?)`;
    db.run(query, [website_id, keyword_id], function (err) {
        if (err) {
            console.error('Error mapping keyword to website:', err.message);
            return res.status(500).json({ error: 'Error mapping keyword to website.' });
        }

        return res.status(201).json({ message: 'Keyword mapped to website successfully.' });
    });
});

// src/index.js
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')  // Ensure there's a root div in your public/index.html
);


// Import cron and web scraping modules
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');

// Function to check websites for keywords
const checkWebsitesForKeywords = () => {
    // Query websites and keywords
    db.all(`
        SELECT w.website_url, k.keyword
        FROM website_keyword wk
        JOIN websites w ON wk.website_id = w.id
        JOIN keywords k ON wk.keyword_id = k.id
    `, [], (err, rows) => {
        if (err) {
            console.error('Error fetching websites and keywords:', err.message);
            return;
        }

        // For each website and keyword combination, check the website content
        rows.forEach((row) => {
            axios.get(row.website_url)
                .then((response) => {
                    const $ = cheerio.load(response.data);

                    let keywordFound = false;
                    let articleHeading = '';
                    let articleLink = '';
                    let articleText = '';

                    // Search for the keyword in the website content
                    $('h1, h2, a').each((index, element) => {
                        const headingText = $(element).text().toLowerCase();
                        let link = $(element).attr('href'); // Get the href attribute (link)

                        // Check if the keyword exists in the heading text
                        if (headingText.includes(row.keyword.toLowerCase())) {
                            keywordFound = true;
                            articleHeading = $(element).text();
                            articleText = $('body').text();  // Get the article's body text

                            // Handle relative URLs by checking if the link is absolute
                            if (link && !link.startsWith('http')) {
                                const baseUrl = new URL(row.website_url);
                                link = new URL(link, baseUrl).href;
                            }

                            articleLink = link || row.website_url;

                            // Stop after finding the first relevant article
                            return false;
                        }
                    });

                    if (keywordFound) {
                        console.log(`Keyword "${row.keyword}" found on ${row.website_url}. Sending email notification...`);

                        // Send the email notification when the keyword is found
                        sendEmailNotification(row.website_url, row.keyword, articleHeading, articleLink);
                    }
                })
                .catch((error) => {
                    console.error(`Error fetching website (${row.website_url}):`, error.message);
                });
        });
    });
};

// Schedule the scraping job to run every 30 minutes (or change the frequency as needed)
//cron.schedule('*/30 * * * *', () => {
    // Schedule a task to run every minute for testing purposes.
cron.schedule('* * * * *', () => { 
    console.log('Running the scheduled job to check websites for keywords.');
    checkWebsitesForKeywords();
});

// Import nodemailer for sending email notifications
const nodemailer = require('nodemailer');

// Configure nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'proxmox1337@gmail.com', // Replace with your email
        pass: 'izjy iywh uacf xgea'    // Replace with your email password or app-specific password
    }
});


const sendEmailNotification = (website_url, keyword, articleHeading, articleLink) => {
    const mailOptions = {
        from: '"Perseus Alerts" <proxmox1337@gmail.com>',  // Replace with your email
        to: 'cestmoi1337@gmail.com',                       // Replace with the recipient's email
        subject: `Keyword Alert: "${keyword}" found on ${website_url}`,
        html: `
            <p>The keyword <strong>"${keyword}"</strong> was found in the article titled:</p>
            <h2>${articleHeading}</h2>
            <p>You can read the article by clicking <a href="${articleLink || website_url}">here</a>.</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error.message);
        } else {
            console.log(`Email sent successfully: ${info.response}`);
        }
    });
};

