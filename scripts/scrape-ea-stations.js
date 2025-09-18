const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');

// EA stations to scrape - using the same ones we have blob data for
const EA_STATIONS = [
  {
    id: 'E7050',
    name: 'Preston Capes',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/E7050',
    key: 'preston-capes'
  },
  {
    id: '3680',
    name: 'Brooksby',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/3680',
    key: 'brooksby'
  },
  {
    id: '3275',
    name: 'Walsall Wood',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/3275',
    key: 'walsall-wood'
  },
  {
    id: '3167',
    name: 'Frankley',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/3167',
    key: 'frankley'
  },
  {
    id: '3307',
    name: 'Hollinsclough',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/3307',
    key: 'hollinsclough'
  },
  {
    id: '3404',
    name: 'Barbrook',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/3404',
    key: 'barbrook'
  },
  {
    id: '3014',
    name: 'Stone',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/3014',
    key: 'stone'
  },
  {
    id: '3901',
    name: 'Worksop',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/3901',
    key: 'worksop'
  },
  {
    id: '3999',
    name: 'Littlethorpe',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/3999',
    key: 'littlethorpe'
  },
  {
    id: 'E13600',
    name: 'Lyndhurst',
    url: 'https://check-for-flooding.service.gov.uk/rainfall-station/E13600',
    key: 'lyndhurst'
  }
];

class EARainfallScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('Initializing browser...');
    
    // For local testing, use simple configuration
    const isLocal = !process.env.GITHUB_ACTIONS && !process.env.NETLIFY;
    
    let launchOptions;
    
    if (isLocal) {
      // Local development - use system browser
      launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ignoreHTTPSErrors: true,
      };
    } else {
      // Production/CI environment - use Chromium
      let executablePath;
      try {
        executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath();
      } catch (error) {
        console.log('Chromium not available, falling back to default');
        executablePath = undefined;
      }
      
      launchOptions = {
        args: chromium.args || ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: chromium.defaultViewport || { width: 1280, height: 720 },
        executablePath: executablePath,
        headless: chromium.headless !== false ? true : false,
        ignoreHTTPSErrors: true,
      };
    }
    
    this.browser = await puppeteer.launch(launchOptions);

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

  async scrapeStation(station) {
    console.log(`\n🌧️ Scraping ${station.name} (${station.id})...`);
    console.log(`📍 URL: ${station.url}`);
    
    try {
      // Navigate to station page
      await this.page.goto(station.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for the page to load completely
      await this.page.waitForSelector('body', { timeout: 10000 });
      console.log('  ✅ Successfully loaded station page');
      
      // Look for CSV download button/link
      await this.page.waitForTimeout(3000);
      
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
            console.log(`  📊 Found download button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!downloadButton) {
        // Try to find any button that might be for downloading
        const buttons = await this.page.$$('button, a');
        console.log(`  🔍 Found ${buttons.length} buttons/links on page`);
        
        // Look for buttons with download-related text
        for (let i = 0; i < buttons.length; i++) {
          const text = await this.page.evaluate(el => el.textContent?.toLowerCase(), buttons[i]);
          if (text && (text.includes('download') || text.includes('csv') || text.includes('export'))) {
            downloadButton = buttons[i];
            console.log(`  📊 Found download button with text: ${text}`);
            break;
          }
        }
      }

      if (!downloadButton) {
        throw new Error(`Could not find download button on page for station ${station.id}`);
      }

      // Set up download handling like Miserdon
      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: RAW_DIR
      });

      // Click the download button
      await downloadButton.click();
      console.log('  📥 Clicked download button');

      // Wait for download to complete
      await this.page.waitForTimeout(5000);

      // Look for the downloaded file
      const files = await fs.readdir(RAW_DIR);
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      
      if (csvFiles.length === 0) {
        throw new Error(`No CSV file was downloaded for station ${station.id}`);
      }

      // Find the most recent CSV file (in case multiple exist)
      let downloadedFile = csvFiles[0];
      if (csvFiles.length > 1) {
        const fileTimes = await Promise.all(csvFiles.map(async (file) => {
          const stats = await fs.stat(path.join(RAW_DIR, file));
          return { file, mtime: stats.mtime };
        }));
        fileTimes.sort((a, b) => b.mtime - a.mtime);
        downloadedFile = fileTimes[0].file;
      }

      const today = dayjs().format('YYYY-MM-DD');
      const newFileName = `ea-${station.id}-${today}.csv`;
      const oldPath = path.join(RAW_DIR, downloadedFile);
      const newPath = path.join(RAW_DIR, newFileName);

      await fs.rename(oldPath, newPath);
      console.log(`  ✅ Downloaded and renamed file to: ${newFileName}`);

      // Process the CSV file
      const processedData = await this.processCSV(newPath, station);
      
      // Update station history
      await this.updateStationHistory(processedData, station);
      
      return {
        stationId: station.id,
        name: station.name,
        recordCount: processedData.length,
        success: true
      };

    } catch (error) {
      console.error(`  ❌ Failed to scrape station ${station.id}:`, error.message);
      return {
        stationId: station.id,
        name: station.name,
        error: error.message,
        success: false
      };
    }
  }

  async processCSV(csvPath, station) {
    console.log(`  🔄 Processing CSV file: ${csvPath}`);
    
    try {
      const csvContent = await fs.readFile(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid');
      }

      // Parse CSV header
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      console.log(`  📋 CSV headers: ${headers.join(', ')}`);

      // If EA CSV (dateTime,value), parse directly using UTC
      const idxDateTime = headers.findIndex(h => h.toLowerCase() === 'datetime');
      const idxValue = headers.findIndex(h => h.toLowerCase() === 'value');

      let processedData = [];

      if (idxDateTime !== -1 && idxValue !== -1) {
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (values.length <= Math.max(idxDateTime, idxValue)) continue;
          const dateTimeStr = values[idxDateTime];
          const rainfallStr = values[idxValue];
          if (!dateTimeStr || rainfallStr === undefined || rainfallStr === '') continue;
          const dt = dayjs.utc(dateTimeStr);
          if (!dt.isValid()) continue;
          const rainfall_mm = parseFloat(rainfallStr);
          if (Number.isNaN(rainfall_mm)) continue;
          processedData.push({
            date: dt.format('YYYY-MM-DD'),
            time: dt.format('HH:mm'),
            dateTimeUtc: dt.toISOString(),
            rainfall_mm,
            total_mm: 0
          });
        }
      } else {
        // Fallback: generic parsing like single-station scraper
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (values.length >= headers.length) {
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index];
            });
            rows.push(row);
          }
        }
        processedData = rows.map(row => {
          let date = '';
          let time = '';
          let rainfall_mm = 0;
          let total_mm = 0;
          for (const [key, value] of Object.entries(row)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('date') || lowerKey.includes('time')) {
              const dateTime = value;
              if (!dateTime) continue;
              if (dateTime.includes('T')) {
                const dt = dayjs(dateTime);
                date = dt.format('YYYY-MM-DD');
                time = dt.format('HH:mm');
              } else if (dateTime.includes(' ')) {
                const parts = dateTime.split(' ');
                date = parts[0];
                time = parts[1];
              } else {
                date = dateTime;
              }
            } else if (lowerKey.includes('rainfall') || lowerKey.includes('precipitation')) {
              rainfall_mm = parseFloat(value) || 0;
            } else if (lowerKey.includes('total')) {
              total_mm = parseFloat(value) || 0;
            }
          }
          return { date, time, rainfall_mm, total_mm };
        }).filter(item => item.date && item.date !== '');
      }

      // Sort chronologically
      processedData.sort((a, b) => new Date(a.dateTimeUtc || `${a.date}T${a.time}:00Z`) - new Date(b.dateTimeUtc || `${b.date}T${b.time}:00Z`));

      console.log(`  ✅ Processed ${processedData.length} valid records`);
      return processedData;

    } catch (error) {
      console.error(`  ❌ Failed to process CSV: ${error.message}`);
      throw error;
    }
  }

  async updateStationHistory(newData, station) {
    console.log(`  💾 Updating history for ${station.name}...`);
    
    try {
      const historyFile = path.join(PROCESSED_DIR, `ea-${station.id}.json`);
      
      let history = {
        lastUpdated: new Date().toISOString(),
        station: station.id,
        stationName: station.name,
        label: `${station.name} (${station.id})`,
        provider: 'Environment Agency',
        country: 'England',
        humanPage: station.url,
        data: []
      };

      // Load existing history if it exists
      try {
        const existingHistory = await fs.readFile(historyFile, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch (error) {
        console.log(`  📚 No existing history file found for ${station.id}, creating new one`);
      }

      // Add new data, avoiding duplicates
      const existingDates = new Set(history.data.map(item => `${item.date}_${item.time}`));
      let addedCount = 0;
      
      for (const item of newData) {
        const key = `${item.date}_${item.time}`;
        if (!existingDates.has(key)) {
          history.data.push(item);
          existingDates.add(key);
          addedCount++;
        }
      }

      // Sort by date and time
      history.data.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA - dateB;
      });

      // Update metadata
      history.lastUpdated = new Date().toISOString();
      history.recordCount = history.data.length;

      // Save updated history
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
      console.log(`  ✅ Updated history with ${addedCount} new records. Total records: ${history.data.length}`);

      // Copy to public directory for development server
      const publicDataDir = path.join(__dirname, '..', 'public', 'data', 'processed');
      const publicHistoryFile = path.join(publicDataDir, `ea-${station.id}.json`);
      
      try {
        await fs.mkdir(publicDataDir, { recursive: true });
        await fs.copyFile(historyFile, publicHistoryFile);
        console.log(`  📁 Copied data to public directory for development server`);
      } catch (error) {
        console.log(`  ⚠️  Could not copy to public directory (this is normal in production): ${error.message}`);
      }

    } catch (error) {
      console.error(`  ❌ Failed to update history for ${station.id}: ${error.message}`);
      throw error;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('🧹 Browser closed');
    }
  }

  async run(stationLimit = null) {
    try {
      console.log('🚀 Starting EA stations rainfall data scraping...');
      console.log(`📅 Current time: ${new Date().toISOString()}`);

      await this.ensureDirectories();
      await this.init();
      
      // Allow limiting number of stations for testing
      const stationsToScrape = stationLimit ? EA_STATIONS.slice(0, stationLimit) : EA_STATIONS;
      console.log(`📊 Scraping ${stationsToScrape.length} EA stations`);
      
      const results = [];
      const errors = [];
      
      // Process stations sequentially to avoid overwhelming the server
      for (let i = 0; i < stationsToScrape.length; i++) {
        const station = stationsToScrape[i];
        console.log(`\n🎯 Processing station ${i + 1}/${stationsToScrape.length}`);
        
        const result = await this.scrapeStation(station);
        
        if (result.success) {
          results.push(result);
          console.log(`  ✅ Success: ${result.recordCount} records`);
        } else {
          errors.push(result);
          console.log(`  ❌ Failed: ${result.error}`);
        }
        
        // Small delay between stations to be respectful
        if (i < stationsToScrape.length - 1) {
          console.log('  ⏳ Waiting 3 seconds...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Summary
      console.log('\n📊 EA Stations Scraping Summary:');
      console.log(`✅ Successful: ${results.length} stations`);
      console.log(`❌ Failed: ${errors.length} stations`);
      
      if (results.length > 0) {
        console.log('\n✅ Successfully scraped stations:');
        for (const result of results) {
          console.log(`  ${result.stationId} (${result.name}): ${result.recordCount} records`);
        }
      }
      
      if (errors.length > 0) {
        console.log('\n❌ Failed stations:');
        for (const error of errors) {
          console.log(`  ${error.stationId} (${error.name}): ${error.error}`);
        }
      }

      console.log('\n🎉 EA stations scraping completed!');
      
      return { results, errors };

    } catch (error) {
      console.error('💥 EA stations scraping failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the scraper if this script is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const stationLimit = limitArg ? parseInt(limitArg.split('=')[1]) : (testMode ? 2 : null);
  
  if (testMode) {
    console.log('🧪 Running in TEST MODE');
    console.log(`📊 Testing ${stationLimit || 2} stations`);
  }
  
  const scraper = new EARainfallScraper();
  scraper.run(stationLimit)
    .then(({ results, errors }) => {
      console.log(`\n🏁 Scraping completed: ${results.length} successful, ${errors.length} failed`);
      process.exit(errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = EARainfallScraper;
