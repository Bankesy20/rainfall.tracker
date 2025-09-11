const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

// Configuration for NRW Station 1099
const STATION_URL = 'https://rivers-and-seas.naturalresources.wales/station/1099';
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const HISTORY_FILE = path.join(PROCESSED_DIR, 'wales-1099.json');
const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'processed');
const PUBLIC_HISTORY_FILE = path.join(PUBLIC_DATA_DIR, 'wales-1099.json');

// Environment variables for date range control
const NRW_RANGE_DAYS = process.env.NRW_RANGE_DAYS || '4'; // Default to 4 days
const NRW_PREV_DAY = process.env.NRW_PREV_DAY || '1'; // Default to 1 day

class NRWRainfallScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('Initializing browser for NRW station...');
    
    // Configure Chromium for serverless environment
    let executablePath;
    try {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (typeof chromium.executablePath === 'function' ? await chromium.executablePath() : chromium.executablePath);
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
    const dirs = [DATA_DIR, RAW_DIR, PROCESSED_DIR, PUBLIC_DATA_DIR];
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
      console.log('Successfully loaded NRW station page');
      
    } catch (error) {
      console.error('Failed to navigate to NRW station page:', error.message);
      throw error;
    }
  }

  async downloadCSV() {
    console.log('Looking for NRW CSV download...');
    
    try {
      // Wait for page to load completely
      await this.page.waitForTimeout(3000);
      
      // Look for download buttons or links (same approach as Miserden scraper)
      const downloadSelectors = [
        'a.button--export-data.graph-filters__export-control--csv',
        'button[data-download]',
        'a[href*=".csv"]',
        'button:contains("Download")',
        'a:contains("CSV")',
        'a:contains("Export")',
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
        throw new Error('Could not find download button on NRW page');
      }

      // Set up download handling
      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: RAW_DIR
      });

      // Click the download button
      await downloadButton.click();
      console.log('Clicked NRW download button');
      
      // Wait for download to complete
      await this.page.waitForTimeout(8000);
      
      // Look for the downloaded file
      const files = await fs.readdir(RAW_DIR);
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      
      if (csvFiles.length === 0) {
        throw new Error('No CSV file was downloaded from NRW site');
      }

      // Find the most recently downloaded file
      const csvFile = csvFiles.sort().pop();
      const today = dayjs().format('YYYY-MM-DD');
      const newFileName = `rainfall-${today}.csv`;
      const oldPath = path.join(RAW_DIR, csvFile);
      const newPath = path.join(RAW_DIR, newFileName);

      await fs.rename(oldPath, newPath);
      console.log(`Downloaded and renamed NRW CSV file to: ${newFileName}`);

      return newPath;

    } catch (error) {
      console.error('Failed to download NRW CSV:', error.message);
      throw error;
    }
  }

  async processCSV(csvPath) {
    console.log(`Processing NRW CSV file: ${csvPath}`);
    
    try {
      const csvContent = await fs.readFile(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('NRW CSV file is empty or invalid');
      }

      // Parse CSV header
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      console.log('NRW CSV headers:', headers);

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

      console.log(`Parsed ${data.length} NRW data rows`);

      // Convert to our standard format
      const processedData = data.map(row => {
        let date = '';
        let time = '';
        let rainfall_mm = 0;
        let total_mm = 0;

        // Look for date/time columns (NRW might use different column names)
        for (const [key, value] of Object.entries(row)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('date') || lowerKey.includes('time') || lowerKey.includes('dyddiad') || lowerKey.includes('amser')) {
            const dateTime = value;
            if (dateTime.includes('T')) {
              // ISO format
              const dt = dayjs(dateTime);
              date = dt.format('YYYY-MM-DD');
              time = dt.format('HH:mm');
            } else if (dateTime.includes(' ')) {
              // Space separated
              const parts = dateTime.split(' ');
              if (parts.length >= 2) {
                const dt = dayjs(`${parts[0]} ${parts[1]}`);
                date = dt.format('YYYY-MM-DD');
                time = dt.format('HH:mm');
              }
            } else {
              // Try to parse as date
              const dt = dayjs(dateTime);
              if (dt.isValid()) {
                date = dt.format('YYYY-MM-DD');
                time = dt.format('HH:mm');
              }
            }
          } else if (lowerKey.includes('rainfall') || lowerKey.includes('glaw') || lowerKey.includes('value') || lowerKey.includes('gwerth')) {
            rainfall_mm = parseFloat(value) || 0;
          }
        }

        // Calculate total if not provided
        if (total_mm === 0) {
          total_mm = rainfall_mm;
        }

        return {
          date,
          time,
          rainfall_mm,
          total_mm
        };
      }).filter(item => item.date && item.date !== '');

      // Sort by date and time
      processedData.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA - dateB;
      });

      return processedData;

    } catch (error) {
      console.error('Failed to process NRW CSV:', error.message);
      throw error;
    }
  }

  async updateHistory(newData) {
    console.log(`Updating NRW station history...`);
    
    try {
      // Load existing history
      let history = { data: [] };
      try {
        const existingContent = await fs.readFile(HISTORY_FILE, 'utf-8');
        history = JSON.parse(existingContent);
      } catch (error) {
        console.log('No existing history found, creating new one');
        history = {
          lastUpdated: new Date().toISOString(),
          station: 'wales-1099',
          nameEN: 'Maenclochog',
          nameCY: 'Maenclochog',
          source: 'NRW',
          data: []
        };
      }

      // Add new data
      if (newData && newData.length > 0) {
        history.data = [...history.data, ...newData];
        history.lastUpdated = new Date().toISOString();
        
        // Remove duplicates based on date and time
        const uniqueData = [];
        const seen = new Set();
        
        for (const item of history.data) {
          const key = `${item.date}_${item.time}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueData.push(item);
          }
        }
        
        history.data = uniqueData;
        
        // Sort by date and time
        history.data.sort((a, b) => {
          const dateA = new Date(`${a.date} ${a.time}`);
          const dateB = new Date(`${b.date} ${b.time}`);
          return dateA - dateB;
        });
      }

      // Save to processed directory
      await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
      console.log(`Updated NRW history with ${newData ? newData.length : 0} new records`);

      // Also save to public directory for development
      try {
        await fs.writeFile(PUBLIC_HISTORY_FILE, JSON.stringify(history, null, 2));
        console.log('Copied NRW data to public directory for development server');
      } catch (error) {
        console.log('Could not copy to public directory (this is normal in production):', error.message);
      }

    } catch (error) {
      console.error('Failed to update NRW history:', error.message);
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
      console.log('Starting NRW rainfall data scraping for station 1099...');
      console.log(`Current time: ${new Date().toISOString()}`);

      await this.ensureDirectories();
      await this.init();
      await this.navigateToStation();
      
      const csvPath = await this.downloadCSV();
      const newData = await this.processCSV(csvPath);
      
      if (newData.length > 0) {
        await this.updateHistory(newData);
        console.log(`Successfully processed ${newData.length} NRW rainfall records`);
      } else {
        console.log('No new NRW data to process');
      }

      console.log('NRW rainfall scraping completed successfully');

    } catch (error) {
      console.error('NRW rainfall scraping failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the scraper if this script is executed directly
if (require.main === module) {
  const scraper = new NRWRainfallScraper();
  scraper.run()
    .then(() => {
      console.log('NRW scraping completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('NRW scraping failed:', error);
      process.exit(1);
    });
}

module.exports = NRWRainfallScraper;