# Rainfall Data Outlier Detection & Correction

This system automatically detects and corrects unrealistic rainfall measurements in your government data feeds. It identifies measurements exceeding 25mm in a 15-minute interval and applies intelligent corrections.

## 🎯 Problem Solved

Government rainfall data occasionally contains outliers where sensors report impossibly high values (e.g., 35mm or 45mm in 15 minutes). This system:

- **Detects** outliers using configurable thresholds (default: 25mm/15min)
- **Corrects** outliers using intelligent interpolation methods
- **Preserves** data integrity with backups and detailed logging
- **Integrates** seamlessly into existing data processing pipeline

## 🚀 Quick Start

### Test the System

```bash
# Run a test with sample data containing outliers
node scripts/test-outlier-detection.js
```

### Process a Single Station File

```bash
# Check and correct outliers in a specific station file
node scripts/outlier-detection.js data/processed/ea-031555.json
```

### Fix All Existing Blob Data

```bash
# Scan and fix outliers in all blob storage data
# Requires NETLIFY_BLOBS_TOKEN or NETLIFY_TOKEN environment variable
node scripts/fix-blob-outliers.js
```

### Automatic Integration

The outlier detection is now automatically integrated into the CSV processing pipeline. New data will be checked for outliers when you run:

```bash
node scripts/process-csv.js path/to/your/rainfall-data.csv
```

## 🔧 How It Works

### Detection Algorithm

The system identifies outliers by checking if any 15-minute rainfall measurement exceeds the threshold (default 25mm). This threshold is based on meteorological standards - while heavy rainfall can reach this level, it's extremely rare and often indicates sensor errors.

### Correction Methods (in priority order)

1. **Local Median**: Uses median of nearby valid measurements (±1.5 hours)
2. **Linear Interpolation**: Averages the nearest valid points before and after
3. **Previous Value**: Uses the last valid measurement
4. **Next Value**: Uses the next valid measurement  
5. **Fallback**: Sets to 0mm as last resort

### Data Integrity

- **Backups**: Original files are backed up before correction
- **Metadata**: All corrections are logged with timestamps and methods
- **Transparency**: Detailed reports show exactly what was changed
- **Reversible**: Original values are preserved in the corrected data

## 📊 Output Examples

### Detection Output
```
🔍 Analyzing station: ea-031555
📊 Found 2 outliers (>25mm in 15min)
🚨 Detected outliers:
  1. 2025-09-24 09:30: 35.8mm (Station: ea-031555)
  2. 2025-09-24 10:30: 45.0mm (Station: ea-031555)
✅ Applied 2 corrections
```

### Correction Log
```
🔧 Corrected 2 outliers in the data
  Fixed: 2025-09-24 09:30 35.8mm → 1.9mm
  Fixed: 2025-09-24 10:30 45.0mm → 2.1mm
```

## 📁 File Structure

```
scripts/
├── outlier-detection.js       # Core detection and correction logic
├── fix-blob-outliers.js      # Batch processor for blob storage
├── test-outlier-detection.js # Test script with sample data
└── process-csv.js            # Updated with automatic outlier detection
```

## ⚙️ Configuration

### Threshold Adjustment

Change the outlier threshold by modifying the constructor:

```javascript
// Default: 25mm in 15 minutes
const detector = new RainfallOutlierDetector(25);

// More sensitive: 20mm in 15 minutes
const detector = new RainfallOutlierDetector(20);

// Less sensitive: 30mm in 15 minutes  
const detector = new RainfallOutlierDetector(30);
```

### Environment Variables

```bash
# Required for blob storage operations
export NETLIFY_BLOBS_TOKEN=your_token_here
# or
export NETLIFY_TOKEN=your_token_here
```

## 📋 Reports Generated

### Station-Level Report
- Outliers detected and corrected
- Correction methods used
- Before/after values
- Timestamps and metadata

### System-Wide Report
- Total stations processed
- Summary statistics
- Detailed correction log
- Error tracking

### Report Location
```
outlier-correction-report-[timestamp].json
```

## 🔄 Integration with Existing Workflow

The system integrates seamlessly:

1. **CSV Processing**: Automatic outlier detection in `process-csv.js`
2. **Blob Storage**: Batch correction tool for existing data
3. **API Endpoints**: Corrected data flows through existing APIs
4. **Dashboard**: Cleaned data improves chart accuracy

## 🛠️ Advanced Usage

### Dry Run Mode (Future Feature)
```bash
# Preview outliers without making changes
node scripts/fix-blob-outliers.js --dry-run
```

### Single Station Processing (Future Feature)
```bash
# Process only a specific station
node scripts/fix-blob-outliers.js --station=ea-031555
```

### Custom Correction Strategies

The system is extensible - you can add custom correction methods by extending the `RainfallOutlierDetector` class.

## 🚨 Important Notes

- **Backup Strategy**: Always maintains backups of original data
- **Non-Destructive**: Original values are preserved in metadata
- **Logging**: All corrections are logged for audit trails
- **Reversible**: Changes can be undone if needed
- **Performance**: Processes data in batches to avoid API rate limits

## 🐛 Troubleshooting

### Common Issues

1. **Missing Dependencies**: Run `npm install` to ensure all packages are available
2. **Blob Access**: Verify NETLIFY_BLOBS_TOKEN is set correctly
3. **File Permissions**: Ensure write access to data directories
4. **Memory Usage**: Large datasets may require processing in smaller batches

### Error Handling

The system includes comprehensive error handling:
- Invalid data structures are skipped with warnings
- Network errors are retried automatically
- Processing continues even if individual stations fail
- Detailed error logs help with debugging

## 📞 Support

For questions or issues with the outlier detection system, check:
1. The generated report files for detailed information
2. Console output for real-time feedback
3. Backup files if you need to revert changes
4. Error logs for troubleshooting guidance
