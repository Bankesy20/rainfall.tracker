const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

// Configuration for NRW Station 1099
const STATION_ID = '1099';
const STATION_URL = 'https://rlg.wales.gov.uk/river-and-rainfall'; // Need to find the actual URL
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const HISTORY_FILE = path.join(PROCESSED_DIR, 'wales-1099.json');
const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'processed');
const PUBLIC_HISTORY_FILE = path.join(PUBLIC_DATA_DIR, 'wales-1099.json');

// Environment variables for date range control
const NRW_RANGE_DAYS = process.env.NRW_RANGE_DAYS || '7'; // Default to 7 days
const NRW_PREV_DAY = process.env.NRW_PREV_DAY || '1'; // Default to 1 day

class NRWRainfallScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.stationId = STATION_ID;
  }

  async init() {
    console.log('Initializing browser for NRW station', this.stationId);
    
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
    console.log(`Navigating to NRW station ${this.stationId}`);
    
    try {
      // For now, we'll use a placeholder URL - this needs to be updated with the actual NRW portal URL
      // Common NRW data portals include:
      // - https://rlg.wales/
      // - Natural Resources Wales data portal
      const testUrl = STATION_URL;
      
      await this.page.goto(testUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.page.waitForSelector('body', { timeout: 10000 });
      console.log('Successfully loaded NRW station page');
      
    } catch (error) {
      console.error('Failed to navigate to NRW station page:', error.message);
      throw error;
    }
  }

  async createSampleData() {
    console.log('Creating sample data for NRW station 1099...');
    
    const now = dayjs();
    const daysToGenerate = parseInt(NRW_RANGE_DAYS) || 1;
    
    const sampleData = [];
    
    for (let d = 0; d < daysToGenerate; d++) {
      const date = now.subtract(d, 'day');
      
      // Generate 15-minute intervals for 24 hours
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
          const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          
          // Generate realistic rainfall data (mostly 0, occasional rainfall)
          const rainfall_mm = Math.random() < 0.1 ? Math.round(Math.random() * 5 * 100) / 100 : 0;
          
          sampleData.push({
            date: date.format('YYYY-MM-DD'),
            time: time,
            rainfall_mm: rainfall_mm,
            total_mm: rainfall_mm // For now, same as rainfall_mm
          });
        }
      }
    }
    
    return sampleData.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateA - dateB;
    });
  }

  async downloadCSV() {
    console.log('Looking for CSV download for NRW station...');
    
    try {
      // This would be the actual implementation to find and download CSV from NRW
      // For now, we'll use the sample data approach
      
      await this.page.waitForTimeout(3000);
      
      // Look for download buttons or links specific to NRW
      const downloadSelectors = [
        'button[data-download]',
        'a[href*=".csv"]',
        'button:contains("Download")',
        'a:contains("CSV")',
        'a:contains("Lawrlwytho")', // Welsh for "Download"
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

      if (downloadButton) {
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
        await this.page.waitForTimeout(5000);
        
        // Look for the downloaded file
        const files = await fs.readdir(RAW_DIR);
        const csvFiles = files.filter(file => file.endsWith('.csv'));
        
        if (csvFiles.length > 0) {
          const downloadedFile = csvFiles[0];
          const today = dayjs().format('YYYY-MM-DD');
          const newFileName = `nrw-${this.stationId}-${today}.csv`;
          const oldPath = path.join(RAW_DIR, downloadedFile);
          const newPath = path.join(RAW_DIR, newFileName);

          await fs.rename(oldPath, newPath);
          console.log(`Downloaded and renamed NRW file to: ${newFileName}`);

          return await this.processCSV(newPath);
        }
      }

      // No CSV download found
      throw new Error('No CSV download found for NRW station');

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
              date = parts[0];
              time = parts[1];
            } else {
              // Assume it's just a date
              date = dateTime;
            }
          } else if (lowerKey.includes('rainfall') || lowerKey.includes('precipitation') || lowerKey.includes('glaw')) {
            rainfall_mm = parseFloat(value) || 0;
          } else if (lowerKey.includes('total') || lowerKey.includes('cyfanswm')) {
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
      console.error('Failed to process NRW CSV:', error.message);
      throw error;
    }
  }

  async updateHistory(newData) {
    console.log(`Updating NRW station ${this.stationId} history...`);
    
    try {
      let history = {
        lastUpdated: new Date().toISOString(),
        station: `wales-${this.stationId}`,
        data: []
      };

      // Load existing history if it exists
      try {
        const existingHistory = await fs.readFile(HISTORY_FILE, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch (error) {
        console.log('No existing NRW history file found, creating new one');
      }

      // Add new data, avoiding duplicates
      const existingDates = new Set(history.data.map(item => `${item.date}_${item.time}`));
      
      let newRecordsCount = 0;
      for (const item of newData) {
        const key = `${item.date}_${item.time}`;
        if (!existingDates.has(key)) {
          history.data.push(item);
          existingDates.add(key);
          newRecordsCount++;
        }
      }

      // If no new data was added and we're using sample data, don't update the file
      if (newRecordsCount === 0 && newData.length > 0) {
        console.log('No new data to add, keeping existing data unchanged');
        return;
      }

      // Sort by date and time
      history.data.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA - dateB;
      });

      // Update last updated timestamp
      history.lastUpdated = new Date().toISOString();

      // Save updated history to both locations
      await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
      await fs.writeFile(PUBLIC_HISTORY_FILE, JSON.stringify(history, null, 2));
      
      console.log(`Updated NRW history with ${newRecordsCount} new records. Total records: ${history.data.length}`);
      console.log('Saved to both data/processed/ and public/data/processed/');

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
      console.log(`Starting NRW rainfall data scraping for station ${this.stationId}...`);
      console.log(`Current time: ${new Date().toISOString()}`);
      console.log(`Range days: ${NRW_RANGE_DAYS}, Previous day: ${NRW_PREV_DAY}`);

      await this.ensureDirectories();
      
      // Check if we already have recent data (within last 2 days)
      let hasRecentData = false;
      try {
        const existingHistory = await fs.readFile(HISTORY_FILE, 'utf-8');
        const history = JSON.parse(existingHistory);
        if (history.data && history.data.length > 0) {
          const lastDataDate = history.data[history.data.length - 1].date;
          const daysSinceLastData = dayjs().diff(dayjs(lastDataDate), 'day');
          hasRecentData = daysSinceLastData <= 2;
          console.log(`Last data date: ${lastDataDate}, days since: ${daysSinceLastData}`);
        }
      } catch (error) {
        console.log('No existing data found');
      }
      
      let newData;
      
      // Try browser-based scraping first
      try {
        await this.init();
        await this.navigateToStation();
        newData = await this.downloadCSV();
      } catch (error) {
        console.log('Browser-based scraping failed:', error.message);
        console.log('No sample data will be generated - keeping existing data unchanged');
        newData = [];
      }
      
      if (newData && newData.length > 0) {
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
