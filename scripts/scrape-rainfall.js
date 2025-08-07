const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

// Configuration
const STATION_URL = 'https://check-for-flooding.service.gov.uk/rainfall-station/1141';
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const HISTORY_FILE = path.join(PROCESSED_DIR, 'rainfall-history.json');

class RainfallScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('Initializing browser...');
    
    // Configure Chromium for serverless environment
    let executablePath;
    try {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath;
    } catch (error) {
      console.log('Chromium not available, using system Chrome or default');
      executablePath = undefined;
    }
    
    this.browser = await puppeteer.launch({
      args: chromium.args || ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport || { width: 1280, height: 720 },
      executablePath: executablePath,
      headless: chromium.headless !== false ? true : false,
      ignoreHTTPSErrors: true,
    });

    this.page = await this.browser.newPage();
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('Browser initialized successfully');
  }

  async ensureDirectories() {
    const dirs = [DATA_DIR, RAW_DIR, PROCESSED_DIR];
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }
  }

  async navigateToStation() {
    console.log(`Navigating to: ${STATION_URL}`);
    
    try {
      await this.page.goto(STATION_URL, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for the page to load completely
      await this.page.waitForSelector('body', { timeout: 10000 });
      console.log('Successfully loaded station page');
      
    } catch (error) {
      console.error('Failed to navigate to station page:', error.message);
      throw error;
    }
  }

  async downloadCSV() {
    console.log('Looking for CSV download button...');
    
    try {
      // Wait for any download buttons or links to appear
      await this.page.waitForTimeout(3000);
      
      // Look for download buttons or links
      const downloadSelectors = [
        'button[data-download]',
        'a[href*=".csv"]',
        'button:contains("Download")',
        'a:contains("CSV")',
        '[data-testid*="download"]',
        '.download-button',
        'button[aria-label*="download"]'
      ];

      let downloadButton = null;
      
      for (const selector of downloadSelectors) {
        try {
          downloadButton = await this.page.$(selector);
          if (downloadButton) {
            console.log(`Found download button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!downloadButton) {
        // Try to find any button that might be for downloading
        const buttons = await this.page.$$('button, a');
        console.log(`Found ${buttons.length} buttons/links on page`);
        
        // Look for buttons with download-related text
        for (let i = 0; i < buttons.length; i++) {
          const text = await this.page.evaluate(el => el.textContent?.toLowerCase(), buttons[i]);
          if (text && (text.includes('download') || text.includes('csv') || text.includes('export'))) {
            downloadButton = buttons[i];
            console.log(`Found download button with text: ${text}`);
            break;
          }
        }
      }

      if (!downloadButton) {
        throw new Error('Could not find download button on page');
      }

      // Set up download handling
      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: RAW_DIR
      });

      // Click the download button
      await downloadButton.click();
      console.log('Clicked download button');

      // Wait for download to complete
      await this.page.waitForTimeout(5000);
      
      // Look for the downloaded file
      const files = await fs.readdir(RAW_DIR);
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      
      if (csvFiles.length === 0) {
        throw new Error('No CSV file was downloaded');
      }

      const downloadedFile = csvFiles[0];
      const today = dayjs().format('YYYY-MM-DD');
      const newFileName = `${today}.csv`;
      const oldPath = path.join(RAW_DIR, downloadedFile);
      const newPath = path.join(RAW_DIR, newFileName);

      await fs.rename(oldPath, newPath);
      console.log(`Downloaded and renamed file to: ${newFileName}`);

      return newPath;

    } catch (error) {
      console.error('Failed to download CSV:', error.message);
      throw error;
    }
  }

  async processCSV(csvPath) {
    console.log(`Processing CSV file: ${csvPath}`);
    
    try {
      const csvContent = await fs.readFile(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid');
      }

      // Parse CSV header
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      console.log('CSV headers:', headers);

      // Parse data rows
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= headers.length) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index];
          });
          data.push(row);
        }
      }

      console.log(`Parsed ${data.length} data rows`);

      // Convert to our standard format
      const processedData = data.map(row => {
        // Extract date and time from various possible formats
        let date = '';
        let time = '';
        let rainfall_mm = 0;
        let total_mm = 0;

        // Look for date/time columns
        for (const [key, value] of Object.entries(row)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('date') || lowerKey.includes('time')) {
            const dateTime = value;
            if (dateTime.includes('T')) {
              // ISO format
              const dt = dayjs(dateTime);
              date = dt.format('YYYY-MM-DD');
              time = dt.format('HH:mm');
            } else if (dateTime.includes(' ')) {
              // Space separated
              const parts = dateTime.split(' ');
              date = parts[0];
              time = parts[1];
            } else {
              // Assume it's just a date
              date = dateTime;
            }
          } else if (lowerKey.includes('rainfall') || lowerKey.includes('precipitation')) {
            rainfall_mm = parseFloat(value) || 0;
          } else if (lowerKey.includes('total')) {
            total_mm = parseFloat(value) || 0;
          }
        }

        return {
          date,
          time,
          rainfall_mm,
          total_mm
        };
      }).filter(item => item.date && item.date !== '');

      return processedData;

    } catch (error) {
      console.error('Failed to process CSV:', error.message);
      throw error;
    }
  }

  async updateHistory(newData) {
    console.log('Updating rainfall history...');
    
    try {
      let history = {
        lastUpdated: new Date().toISOString(),
        station: "1141",
        data: []
      };

      // Load existing history if it exists
      try {
        const existingHistory = await fs.readFile(HISTORY_FILE, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch (error) {
        console.log('No existing history file found, creating new one');
      }

      // Add new data, avoiding duplicates
      const existingDates = new Set(history.data.map(item => `${item.date}_${item.time}`));
      
      for (const item of newData) {
        const key = `${item.date}_${item.time}`;
        if (!existingDates.has(key)) {
          history.data.push(item);
          existingDates.add(key);
        }
      }

      // Sort by date and time
      history.data.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA - dateB;
      });

      // Update last updated timestamp
      history.lastUpdated = new Date().toISOString();

      // Save updated history
      await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
      console.log(`Updated history with ${newData.length} new records. Total records: ${history.data.length}`);

      // Copy to public directory for development server
      const publicDataDir = path.join(__dirname, '..', 'public', 'data', 'processed');
      const publicHistoryFile = path.join(publicDataDir, 'rainfall-history.json');
      
      try {
        await fs.mkdir(publicDataDir, { recursive: true });
        await fs.copyFile(HISTORY_FILE, publicHistoryFile);
        console.log('Copied data to public directory for development server');
      } catch (error) {
        console.log('Could not copy to public directory (this is normal in production):', error.message);
      }

    } catch (error) {
      console.error('Failed to update history:', error.message);
      throw error;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  async run() {
    try {
      console.log('Starting rainfall data scraping...');
      console.log(`Current time: ${new Date().toISOString()}`);

      await this.ensureDirectories();
      await this.init();
      await this.navigateToStation();
      
      const csvPath = await this.downloadCSV();
      const newData = await this.processCSV(csvPath);
      
      if (newData.length > 0) {
        await this.updateHistory(newData);
        console.log(`Successfully processed ${newData.length} new rainfall records`);
      } else {
        console.log('No new data to process');
      }

      console.log('Rainfall scraping completed successfully');

    } catch (error) {
      console.error('Rainfall scraping failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the scraper if this script is executed directly
if (require.main === module) {
  const scraper = new RainfallScraper();
  scraper.run()
    .then(() => {
      console.log('Scraping completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = RainfallScraper; 