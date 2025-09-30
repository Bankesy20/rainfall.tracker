# 🌧️ Rainfall Leaderboard System Implementation Prompt

## Project Context

You are working with a **UK Rainfall Data Collection Service** - a comprehensive system that automatically scrapes, processes, and visualizes rainfall data from 800+ weather stations across England and Wales. The system is built with React, Node.js, and deployed on Netlify with GitHub Actions automation.

## 🏗️ Current System Architecture

### **Data Collection Pipeline**
- **9 EA Batch Workflows**: Automated GitHub Actions that scrape 94 stations each (846 total stations)
- **Schedule**: Every 6 hours with 30-minute spacing to prevent conflicts
- **Data Sources**: 
  - Environment Agency (England): 800+ stations
  - Natural Resources Wales (Wales): 100+ stations
- **Processing**: CSV → JSON with outlier detection (25mm/15min threshold)
- **Storage**: Dual storage (local JSON files + Netlify Blobs)

### **Current Tech Stack**
```json
{
  "frontend": "React 18 + Tailwind CSS + Recharts",
  "backend": "Node.js 18 + Netlify Functions",
  "storage": "Local JSON + Netlify Blobs",
  "deployment": "Netlify + GitHub Actions",
  "data_processing": "Custom Node.js scripts",
  "mapping": "MapLibre GL + React Map GL"
}
```

### **Data Structure**
Each station file (`ea-XXXXX.json`) contains:
```json
{
  "lastUpdated": "2025-09-30T07:57:21.963Z",
  "station": "50101",
  "stationName": "Parkham (50101)",
  "region": "England",
  "location": { "lat": 50.123, "long": -4.567 },
  "dataSource": "EA API",
  "recordCount": 1133,
  "data": [
    {
      "date": "2025-09-18",
      "time": "12:45:00.000",
      "dateTime": "2025-09-18T12:45:00Z",
      "rainfall_mm": 0.2,
      "total_mm": 15.4,
      "station": "50101",
      "stationName": "Parkham (50101)",
      "region": "England"
    }
  ]
}
```

## 🎯 Leaderboard Requirements

### **Ranking Metrics Needed**
1. **Total Rainfall** (by time period)
2. **Peak Hourly Rainfall** (highest single hour)
3. **Peak 15-minute Rainfall** (highest single reading)
4. **Rainy Days Count** (days with >1mm rainfall)
5. **Average Daily Rainfall** (over time period)

### **Time Periods**
- **Today** (last 24 hours)
- **This Week** (7-day rolling)
- **This Month** (30-day rolling)
- **This Year** (365-day rolling)
- **All Time** (historical maximums)

### **Geographic Segmentation**
- **National Rankings** (England + Wales combined)
- **Regional Rankings** (England vs Wales)
- **County/Area Rankings** (by location clusters)

## 🚀 Implementation Requirements

### **1. Backend API (Netlify Function)**
Create `netlify/functions/leaderboard.js` with:
- **Endpoint**: `GET /.netlify/functions/leaderboard`
- **Parameters**: `?metric=total&period=today&limit=50&region=all`
- **Response**: Ranked list with station details and values
- **Caching**: 15-minute TTL for performance
- **Error Handling**: Graceful fallbacks to local files

### **2. Data Processing Script**
Create `scripts/generate-leaderboard-cache.js`:
- **Pre-compute** all leaderboard combinations
- **Cache** results in `data/cache/leaderboards.json`
- **Update** every 15 minutes via GitHub Actions
- **Handle** 800+ stations efficiently

### **3. React Components**
Create `src/components/Leaderboard.js`:
- **Real-time** updates every 30 seconds
- **Interactive** filters (metric, period, region)
- **Responsive** design with Tailwind CSS
- **Loading** states and error handling
- **Export** functionality (CSV/JSON)

### **4. Integration Points**
- **Add to App.js**: New leaderboard route/tab
- **Update navigation**: Leaderboard menu item
- **Add to GitHub Actions**: Cache generation step
- **Update package.json**: New scripts for cache management

## 📊 Performance Considerations

### **Data Volume**
- **800+ stations** × 5 metrics × 5 periods = 20,000+ calculations
- **~300KB per station file** = 240MB total data
- **15-minute update frequency** for real-time feel

### **Caching Strategy**
1. **L1**: In-memory cache (15min TTL)
2. **L2**: Pre-computed JSON cache files
3. **L3**: Netlify Blobs for production
4. **L4**: Local file fallbacks

### **API Design**
```javascript
// Example API calls
GET /leaderboard?metric=total&period=today&limit=10
GET /leaderboard?metric=max_hourly&period=week&region=england
GET /leaderboard?metric=rainy_days&period=month&limit=25
```

## 🎨 UI/UX Requirements

### **Leaderboard Table**
- **Rank** (1st, 2nd, 3rd with medals 🥇🥈🥉)
- **Station Name** (clickable to view details)
- **Location** (region, coordinates)
- **Value** (formatted with units)
- **Change** (up/down arrows, percentage)
- **Last Updated** (relative time)

### **Filters & Controls**
- **Metric Selector**: Dropdown with all 5 metrics
- **Period Selector**: Today/Week/Month/Year/All Time
- **Region Filter**: All/England/Wales/County
- **Limit Slider**: 10/25/50/100 stations
- **Auto-refresh Toggle**: 30s/1min/5min/off

### **Visual Elements**
- **Progress Bars**: For relative comparison
- **Trend Charts**: Mini sparklines for each station
- **Color Coding**: Green (high), Yellow (medium), Red (low)
- **Responsive Design**: Mobile-first approach

## 🔧 Technical Implementation Details

### **File Structure to Create**
```
netlify/functions/leaderboard.js          # Main API endpoint
scripts/generate-leaderboard-cache.js     # Cache generation
src/components/Leaderboard.js             # React component
src/components/LeaderboardTable.js        # Table component
src/components/LeaderboardFilters.js      # Filter controls
src/hooks/useLeaderboard.js              # Custom hook
src/utils/leaderboardProcessor.js        # Data processing
data/cache/leaderboards.json             # Cached results
```

### **GitHub Actions Integration**
Add to existing workflows:
```yaml
- name: Generate Leaderboard Cache
  run: node scripts/generate-leaderboard-cache.js
  if: success()
```

### **Error Handling**
- **Missing data**: Skip stations with insufficient data
- **API failures**: Fallback to cached data
- **Network issues**: Show offline indicator
- **Invalid parameters**: Return 400 with helpful message

## 🎯 Success Criteria

### **Performance**
- **API Response**: <500ms for top 50 stations
- **Cache Generation**: <30 seconds for all combinations
- **UI Updates**: <100ms for filter changes
- **Mobile Load**: <2 seconds on 3G

### **Functionality**
- **Real-time Updates**: Every 30 seconds
- **All Metrics**: 5 metrics × 5 periods = 25 combinations
- **All Regions**: National + Regional + County views
- **Export Options**: CSV and JSON download

### **User Experience**
- **Intuitive Navigation**: Clear filters and controls
- **Responsive Design**: Works on all devices
- **Loading States**: Smooth transitions and feedback
- **Error Recovery**: Graceful handling of failures

## 🚀 Implementation Steps

1. **Create API endpoint** with basic functionality
2. **Build data processing** script for cache generation
3. **Develop React components** with basic table
4. **Add filtering and controls** for user interaction
5. **Implement caching strategy** for performance
6. **Add GitHub Actions integration** for automation
7. **Test with real data** and optimize performance
8. **Add advanced features** (export, trends, etc.)

## 📝 Additional Context

### **Existing Components to Reference**
- `src/components/RainfallChart.js` - Chart implementation
- `src/components/DataSummary.js` - Statistics display
- `src/utils/dataProcessor.js` - Data processing utilities
- `netlify/functions/rainfall-data.js` - API pattern

### **Data Quality Notes**
- **Outlier Detection**: 25mm/15min threshold already implemented
- **Data Validation**: All readings validated before storage
- **Update Frequency**: Every 6 hours via GitHub Actions
- **Fallback Chain**: Blobs → Remote → Local → Embedded

### **Deployment Considerations**
- **Netlify Functions**: 10-second timeout limit
- **GitHub Actions**: 6-hour schedule with 30-min spacing
- **Storage Limits**: 1GB for Netlify Blobs
- **API Limits**: 1000 requests/hour for GitHub raw files

---

**Your task**: Implement a complete leaderboard system that ranks rainfall stations by various metrics and time periods, with real-time updates, responsive design, and optimal performance for 800+ stations.
