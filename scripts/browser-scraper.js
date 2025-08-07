// Browser-based rainfall data scraper
// Run this in your browser's developer console on the rainfall station page

async function scrapeRainfallData() {
  console.log('Starting browser-based rainfall scraper...');
  
  try {
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for download buttons or links
    const downloadSelectors = [
      'button[data-download]',
      'a[href*=".csv"]',
      'button:contains("Download")',
      'a:contains("CSV")',
      '[data-testid*="download"]',
      '.download-button',
      'button[aria-label*="download"]',
      'a[download]',
      'button[onclick*="download"]'
    ];

    let downloadButton = null;
    
    // Try to find download button
    for (const selector of downloadSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          downloadButton = elements[0];
          console.log(`Found download button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!downloadButton) {
      // Look for any button with download-related text
      const allButtons = document.querySelectorAll('button, a');
      console.log(`Found ${allButtons.length} buttons/links on page`);
      
      for (let i = 0; i < allButtons.length; i++) {
        const text = allButtons[i].textContent?.toLowerCase();
        if (text && (text.includes('download') || text.includes('csv') || text.includes('export') || text.includes('data'))) {
          downloadButton = allButtons[i];
          console.log(`Found download button with text: ${text}`);
          break;
        }
      }
    }

    if (!downloadButton) {
      console.log('Could not find download button. Here are all buttons on the page:');
      const allButtons = document.querySelectorAll('button, a');
      allButtons.forEach((btn, index) => {
        console.log(`${index}: ${btn.textContent} (${btn.tagName})`);
      });
      return;
    }

    // Click the download button
    console.log('Clicking download button...');
    downloadButton.click();
    
    console.log('Download initiated! Check your downloads folder.');
    
    // Also try to extract any visible data from the page
    console.log('\nExtracting visible data from page...');
    extractVisibleData();
    
  } catch (error) {
    console.error('Scraping failed:', error);
  }
}

function extractVisibleData() {
  // Look for data tables or charts on the page
  const tables = document.querySelectorAll('table');
  const charts = document.querySelectorAll('[class*="chart"], [id*="chart"]');
  
  console.log(`Found ${tables.length} tables and ${charts.length} charts`);
  
  // Extract table data
  tables.forEach((table, index) => {
    console.log(`\nTable ${index + 1}:`);
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      const rowData = Array.from(cells).map(cell => cell.textContent.trim());
      console.log(rowData.join(' | '));
    });
  });
  
  // Look for any data in JSON format
  const scripts = document.querySelectorAll('script');
  scripts.forEach(script => {
    const content = script.textContent;
    if (content.includes('rainfall') || content.includes('data') || content.includes('station')) {
      console.log('Found potential data in script:', content.substring(0, 200) + '...');
    }
  });
}

// Auto-run the scraper
scrapeRainfallData();

// Also provide manual function
window.scrapeRainfallData = scrapeRainfallData;
console.log('Rainfall scraper loaded. You can also run scrapeRainfallData() manually.'); 