Install Git: https://www.git-scm.com/

Go to a folder where you want to clone the repository.
Using cmd or Powershell:

git clone https://github.com/cestmoi1337/perseus-monitor.git

cd perseus-monitor

npm install express sqlite3 nodemailer axios cors cheerio node-cron sentiment

Modify the index.js file:
    Line 116: It scheduled to run every 5 minutes
    Line 224: Enter your email address in the To: field
    Save it

to start the node server (back-end):
Use CMD or Powershell from perseus-monitor folder
	node index.js

Then,
To start the React server (front-end):
Use another session of CMD or Powershell from perseus-monitor/perseus-client folder
    npm install
	npm start
    It should display on your browser


Let mew know what you think.

Known bugs:

1. When adding a website and keyword, it displays both messages of success and failure.
2. You need to refresh the web page to see the newly added website.