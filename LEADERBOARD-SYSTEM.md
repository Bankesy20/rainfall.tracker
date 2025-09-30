# Rainfall Leaderboard System

## Overview

The leaderboard system automatically generates rankings for rainfall stations across England and Wales based on various metrics and time periods. It runs as a GitHub Actions workflow that processes all station data and creates static JSON leaderboard files.

## Schedule

- **Frequency**: Every 6 hours
- **Times**: 05:00, 11:00, 17:00, 23:00 UTC
- **Timing**: Runs 30 minutes after the last data collection batch completes
- **Workflow**: `.github/workflows/generate-leaderboards.yml`

## Metrics

The system calculates 4 different metrics:

1. **Total Rainfall** (`total_rainfall`)
   - Sum of all rainfall measurements in the period
   - Unit: mm

2. **Max Hourly Rainfall** (`max_hourly`)
   - Highest rainfall total in any single hour
   - Unit: mm/h

3. **Max 15-Minute Rainfall** (`max_15min`)
   - Highest single 15-minute measurement
   - Unit: mm/15min

4. **Rainy Days** (`rainy_days`)
   - Number of days with >0.1mm rainfall
   - Unit: days

## Time Periods

Each metric is calculated for 4 different time periods:

- **24h**: Last 24 hours
- **7d**: Last 7 days
- **30d**: Last 30 days
- **all-time**: All available data

## Output Files

### Location
All leaderboard files are saved to: `data/processed/leaderboards/`

### File Naming
- Format: `leaderboard-{metric}-{period}.json`
- Examples:
  - `leaderboard-total_rainfall-24h.json`
  - `leaderboard-max_hourly-7d.json`
  - `leaderboard-rainy_days-all-time.json`

### File Structure
```json
{
  "metric": "total_rainfall",
  "period": "24h",
  "unit": "mm",
  "generated_at": "2025-09-30T05:00:00Z",
  "rankings": [
    {
      "rank": 1,
      "station": "E14930",
      "stationName": "Chale (E14930)",
      "region": "England",
      "location": { "lat": 50.123, "long": -4.567 },
      "value": 13.7
    }
    // ... up to 100 stations
  ]
}
```

### Summary File
- `summary.json`: Contains metadata about the generation run
- Includes total stations processed, generation timestamp, and configuration

## Manual Execution

To run the leaderboard generation manually:

```bash
node scripts/generate-leaderboards.js
```

## Configuration

Key settings in `scripts/generate-leaderboards.js`:

- `MAX_RANKINGS = 100`: Top 100 stations per leaderboard
- `TIME_PERIODS`: Hours for each period
- `METRICS`: Calculation functions for each metric
- `DATA_DIR`: Source directory for station files

## Data Sources

- Reads from: `data/processed/ea-*.json` files
- Excludes: `ea-england-stations.json` and `ea-england-stations-with-names.json`
- Processes: ~840+ weather stations
- Updates: Every 6 hours automatically

## Error Handling

- Invalid station files are skipped with warnings
- Calculation errors are logged but don't stop processing
- Git commit retries up to 3 times
- Failed runs are logged in GitHub Actions summary

## Integration

The leaderboard system integrates with:

- **Data Collection**: Runs after all 9 EA batch workflows complete
- **Git Repository**: Commits leaderboard files automatically
- **Static Files**: JSON files can be consumed by frontend applications
- **Monitoring**: GitHub Actions provides run status and logs
