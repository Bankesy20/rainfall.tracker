# EA Stations Testing Guide

## 🧪 Testing New EA Stations

This document explains how to test the 10 new EA stations before integrating them into production.

### Test Workflow

A dedicated test workflow has been created: `.github/workflows/test-ea-stations.yml`

**Key Features:**
- ✅ **Manual trigger only** - Won't interfere with production
- 🎛️ **Configurable station count** - Test 1, 3, 5, or all 10 stations
- 🔍 **Dry run blob upload** - Tests upload logic without actually uploading
- 📊 **Detailed reporting** - Shows file sizes, record counts, and status

### How to Run Tests

1. **Go to GitHub Actions** in your repository
2. **Select "Test EA Stations (10 New Stations)" workflow**
3. **Click "Run workflow"**
4. **Choose number of stations to test:**
   - `1` - Quick test with single station
   - `3` - Recommended for initial testing  
   - `5` - Medium test
   - `10` - Full test of all new stations

### What Gets Tested

#### 📥 Data Download
- Downloads rainfall data from EA API endpoints
- Handles CSV parsing and data transformation
- Merges with existing data (if any)
- Saves to both `data/processed/` and `public/data/processed/`

#### 🔍 Data Validation
- Verifies file creation and structure
- Checks record counts and data quality
- Reports file sizes and timestamps

#### ☁️ Blob Upload Simulation
- Tests blob upload logic (dry run mode)
- Verifies which files would be uploaded
- No actual uploads performed during testing

### New EA Stations Being Tested

| Station ID | Name | Location |
|------------|------|----------|
| 573674 | Northern Station | 53.971°N, -2.530°W |
| E19017 | East England Station | 52.059°N, 0.297°E |
| 240662TP | Central England Station | 51.937°N, -0.385°W |
| 558491 | Midlands Station | 53.389°N, -1.920°W |
| 059793 | Yorkshire Station | 53.967°N, -1.115°W |
| 013553 | Northern Border Station | 54.820°N, -2.446°W |
| 50108 | Southwest Station | 50.925°N, -3.714°W |
| E14920 | South Coast Station | 50.692°N, -1.308°W |
| 038476 | East Coast Station | 54.107°N, -0.129°W |
| E11461 | South Station | 50.903°N, -1.105°W |

### Expected Test Results

#### ✅ Success Indicators
- All tested stations download successfully
- JSON files created in `data/processed/ea-*.json`
- Each file contains valid data structure:
  ```json
  {
    "lastUpdated": "2025-09-18T...",
    "station": "573674",
    "stationName": "Northern Station",
    "location": { "lat": 53.971437, "long": -2.529714 },
    "dataSource": "EA API",
    "recordCount": 1234,
    "data": [...]
  }
  ```

#### ⚠️ What to Watch For
- HTTP errors from EA API (some stations may be temporarily offline)
- Empty or malformed CSV responses
- File size anomalies (very small = no data, very large = potential issue)

### Local Testing

You can also test locally:

```bash
# Test single station
node scripts/download-ea-batch.js --test --limit=1

# Test 3 stations  
node scripts/download-ea-batch.js --test --limit=3

# Test all 10 stations
node scripts/download-ea-batch.js --test --limit=10
```

### Integration After Testing

Once testing is successful:

1. **Update main workflow** (`.github/workflows/scrape-and-upload.yml`)
2. **Add EA batch download step:**
   ```yaml
   - name: Run EA batch scraping script
     run: node scripts/download-ea-batch.js
   ```
3. **Update blob upload script** (already done - includes all 12 stations)
4. **Update dashboard** to show new stations

### Current Production Status

**🔒 Production is protected** - The existing workflow continues to run with:
- ✅ Miserden EA Station (1141) 
- ✅ Maenclochog NRW Station (1099)

Testing these new stations **will not affect** the current production data collection.


