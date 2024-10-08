// Import required modules
const express = require('express');
const sqlite3 = require('sqlite3').verbose();  // For SQLite database
const cors = require('cors');  // For handling cross-origin requests
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3001;
const cron = require('node-cron');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();



// Middleware
app.use(express.json());  // To parse incoming JSON requests
app.use(cors());  // To allow cross-origin requests from front-end

// Initialize SQLite Database
const db = new sqlite3.Database('./perseus.db', (err) => {
    if (err) {
        console.error('Error opening SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create a combined websites and keywords table (one-to-one relationship)
        db.run(`
            CREATE TABLE IF NOT EXISTS monitored_sites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                website_url TEXT NOT NULL,
                keyword TEXT NOT NULL,
                last_notified_article TEXT,
                notified TEXT,
                last_notified TIMESTAMP

            )
        `, (err) => {
            if (err) {
                console.error('Error creating monitored_sites table:', err.message);
            } else {
                console.log('monitored_sites table created or already exists.');
            }
        });
    }
});

// Test route to ensure the server is working
app.get('/', (req, res) => {
    res.send('Perseus Monitoring App API is running.');
});

// Route to get all websites and their keywords
app.get('/sites', (req, res) => {
    const query = `SELECT * FROM monitored_sites`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching sites:', err.message);
            res.status(500).json({ error: 'Error fetching sites' });
        } else {
            res.json(rows);
        }
    });
});

// Route to add a new website and keyword to monitor
app.post('/add-site', (req, res) => {
    const { website_url, keyword } = req.body;

    if (!website_url || !keyword) {
        return res.status(400).json({ error: 'Website URL and keyword are required.' });
    }

    const query = `INSERT INTO monitored_sites (website_url, keyword, last_notified_article) VALUES (?, ?, ?)`;
    db.run(query, [website_url, keyword, null], function (err) {
        if (err) {
            console.error('Error adding site:', err.message);
            return res.status(500).json({ error: 'Error adding site.' });
        }
        return res.status(201).json({ message: 'Website added successfully.', id: this.lastID });
    });
});

// Route to update a website and keyword
app.put('/sites/:id', (req, res) => {
    const { id } = req.params;
    const { website_url, keyword } = req.body;

    if (!website_url || !keyword) {
        return res.status(400).json({ error: 'Website URL and keyword are required.' });
    }

    const query = `UPDATE monitored_sites SET website_url = ?, keyword = ? WHERE id = ?`;
    db.run(query, [website_url, keyword, id], function (err) {
        if (err) {
            console.error('Error updating site:', err.message);
            return res.status(500).json({ error: 'Error updating site.' });
        }
        return res.status(200).json({ message: 'Site updated successfully.' });
    });
});

// Route to delete a website and keyword
app.delete('/sites/:id', (req, res) => {
    const { id } = req.params;

    const query = `DELETE FROM monitored_sites WHERE id = ?`;
    db.run(query, [id], function (err) {
        if (err) {
            console.error('Error deleting site:', err.message);
            return res.status(500).json({ error: 'Error deleting site.' });
        }
        return res.status(200).json({ message: 'Site deleted successfully.' });
    });
});

// Schedule a task to run every 30 minutes (adjust the interval as needed)
//cron.schedule('*/10 * * * *', () => {
        // Schedule a task to run every minute for testing purposes.
cron.schedule('* * * * *', () => { 
    console.log('Running the scheduled job to check websites for keywords.');
    checkWebsitesForKeywords();
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Function to normalize the URLs
const normalizeUrl = (url) => {
    try {
        const normalized = new URL(url).href;
        return normalized.replace(/\/$/, ''); // Remove trailing slash for consistent comparison
    } catch (e) {
        console.error('Error normalizing URL:', url, e.message);
        return url;
    }
};


// Function to check websites for keywords
const checkWebsitesForKeywords = () => {
    // Fetch the websites and keywords from the database
    const query = `SELECT id, website_url, keyword, last_notified_article FROM monitored_sites`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching websites and keywords:', err.message);
            return;
        }

        rows.forEach((row) => {
            axios.get(row.website_url)
                .then((response) => {
                    const $ = cheerio.load(response.data);

                    let keywordFound = false;
                    let articleHeading = '';
                    let articleLink = '';

                    console.log(`Checking for keyword "${row.keyword}" on ${row.website_url}`);

                    // Search for the keyword in the website content
                    $('h1, h2, a').each((index, element) => {
                        const headingText = $(element).text().toLowerCase();
                        let link = $(element).attr('href'); // Get the href attribute (link)

                        // Check if the keyword exists in the heading text
                        if (headingText.includes(row.keyword.toLowerCase())) {
                            keywordFound = true;
                            articleHeading = $(element).text();

                            // Handle relative URLs by checking if the link is absolute
                            if (link && !link.startsWith('http')) {
                                const baseUrl = new URL(row.website_url);
                                link = new URL(link, baseUrl).href;
                            }

                            articleLink = link || row.website_url;
                            return false;  // Stop after finding the first relevant article
                        }
                    });

                    // If the keyword is found, delegate to the notification handling function
                    if (keywordFound) {
                        handleNotification(row, articleHeading, articleLink);
                    } else {
                        console.log(`No matching keyword found for "${row.keyword}" on ${row.website_url}.`);
                    }
                })
                .catch((error) => {
                    console.error(`Error fetching website (${row.website_url}):`, error.message);
                });
        });
    });
};

// Function to handle sending notifications and preventing duplicates
const handleNotification = (row, articleHeading, articleLink) => {
    const lastNotifiedArticle = row.last_notified_article ? normalizeUrl(row.last_notified_article) : null;
    const currentArticle = normalizeUrl(articleLink);

    console.log(`Last Notified Article: ${lastNotifiedArticle}, Current Article: ${currentArticle}`);

    // Check if the article has already been notified
    if (lastNotifiedArticle === currentArticle) {
        console.log(`Article already notified for "${row.keyword}" on ${row.website_url}. Skipping.`);
        return;
    }

    // If not, proceed with sending the notification and updating the database
    console.log(`New article found for "${row.keyword}". Proceeding with notification.`);

    // 1. Perform sentiment analysis on the article heading
    const sentimentResult = sentiment.analyze(articleHeading);
    const sentimentScore = sentimentResult.score;
    let sentimentSummary = 'Neutral';
    if (sentimentScore > 0) {
        sentimentSummary = 'Positive';
    } else if (sentimentScore < 0) {
        sentimentSummary = 'Negative';
    }

    // 2. Send the email notification with sentiment data
    sendEmailNotification(row.website_url, row.keyword, articleHeading, articleLink, sentimentSummary, sentimentScore);

    // 3. Update the database with the latest article URL
    const updateQuery = `UPDATE monitored_sites SET last_notified_article = ?, notified = 'Y', last_notified = ? WHERE id = ?`;
    const currentTime = new Date().toISOString();
    db.run(updateQuery, [articleLink, currentTime, row.id], (err) => {
        if (err) {
            console.error('Error updating last_notified_article and notified status:', err.message);
        } else {
            console.log(`Updated last_notified_article and notified status for ${row.website_url}`);
        }
    });
};




// Email notification function
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'proxmox1337@gmail.com',  // Replace with your email
        pass: 'izjy iywh uacf xgea'    // Replace with your email password or app-specific password
    }
});

const sendEmailNotification = (website_url, keyword, articleHeading, articleLink, sentimentSummary, sentimentScore) => {
    const mailOptions = {
        from: '"Perseus Alerts" <proxmox1337@gmail.com>',  // Replace with your email
        to: 'cestmoi1337@gmail.com',  // Replace with the recipient's email
        subject: `Keyword Alert: "${keyword}" found on ${website_url}`,
        html: `
            <p>The keyword <strong>"${keyword}"</strong> was found in the article titled:</p>
            <h2>${articleHeading}</h2>
            <p>Sentiment analysis: <strong>${sentimentSummary}</strong> (score: ${sentimentScore})</p>
            <p>You can read the article by clicking <a href="${articleLink || website_url}">here</a>.</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(`Error sending email for ${website_url}:`, error.message);
        } else {
            console.log(`Email sent successfully: ${info.response}`);
        }
    });
};


