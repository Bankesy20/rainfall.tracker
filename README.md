# UK Rainfall Data Collection Service

A complete rainfall data collection system that automatically scrapes daily rainfall data from the UK government site and displays it through an interactive React dashboard.

## 🌧️ Features

- **Automated Data Collection**: Daily scraping of rainfall data from UK Government Flood Information Service
- **Interactive Dashboard**: Real-time charts and statistics with dark/light theme toggle
- **GitHub Actions**: Automated daily runs at 9 AM UTC
- **Netlify Deployment**: Hosted React app with automatic deployments
- **Data Processing**: Intelligent CSV parsing and JSON storage
- **Error Handling**: Robust error handling and retry logic
- **Mobile Responsive**: Optimized for all device sizes

## 📊 Data Source

- **Station**: 1141 (UK Government Flood Information Service)
- **URL**: https://check-for-flooding.service.gov.uk/rainfall-station/1141
- **Update Frequency**: Every 24 hours via GitHub Actions
- **Data Format**: CSV download → JSON processing → Interactive charts

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Git
- GitHub account
- Netlify account (for deployment)

### 1. Fork and Clone

```bash
# Fork this repository to your GitHub account
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/rainfall-tracker.git
cd rainfall-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Test Locally

```bash
# Start the development server
npm start

# Test the scraper (optional)
npm run scrape

# Test data processing (recommended first)
node scripts/test-scraper.js
```

**Note**: The development server will automatically serve sample data from `public/data/processed/rainfall-history.json`. The test script will create this file for you.

### 4. Enable GitHub Actions

1. Go to your repository settings
2. Navigate to "Actions" → "General"
3. Enable "Allow all actions and reusable workflows"
4. Save changes

### 5. Deploy to Netlify

1. Connect your GitHub repository to Netlify
2. Set build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `build/`
3. Deploy!

## 📁 Project Structure

```
rainfall-tracker/
├── .github/workflows/
│   └── scrape-rainfall.yml      # GitHub Actions workflow
├── data/
│   ├── raw/                     # Daily CSV files
│   └── processed/
│       └── rainfall-history.json # Processed data
├── src/
│   ├── components/
│   │   ├── RainfallChart.js     # Interactive charts
│   │   └── DataSummary.js       # Statistics display
│   ├── utils/
│   │   └── dataProcessor.js     # Data processing utilities
│   ├── App.js                   # Main app component
│   └── index.js                 # App entry point
├── scripts/
│   └── scrape-rainfall.js       # Web scraper
├── public/
│   └── index.html               # HTML template
├── package.json                 # Dependencies
├── netlify.toml                # Netlify config
└── README.md                   # This file
```

## 🔧 Configuration

### GitHub Actions

The workflow runs daily at 9 AM UTC and can be triggered manually:

```yaml
on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM UTC
  workflow_dispatch:      # Manual trigger
```

### Data Format

Processed data is stored in JSON format:

```json
{
  "lastUpdated": "2024-12-07T09:00:00Z",
  "station": "1141",
  "data": [
    {
      "date": "2024-12-07",
      "time": "08:45",
      "rainfall_mm": 0.2,
      "total_mm": 15.4
    }
  ]
}
```

## 🛠️ Development

### Running the Scraper

```bash
# Run scraper manually
npm run scrape

# Run with development server
npm run dev
```

### Adding New Features

1. **New Chart Types**: Extend `RainfallChart.js`
2. **Additional Statistics**: Add functions to `dataProcessor.js`
3. **UI Components**: Create new components in `src/components/`
4. **Data Sources**: Modify `scrape-rainfall.js`

### Testing

```bash
# Run tests
npm test

# Test GitHub Actions locally (requires act)
act -j scrape
```

## 📈 Dashboard Features

### Interactive Charts
- **Bar Charts**: Daily rainfall totals with color-coded intensity
- **Line Charts**: Trend analysis over time
- **Area Charts**: Cumulative rainfall visualization
- **Multiple Timeframes**: 7, 14, 30, 60, 90 days

### Statistics Display
- **Latest Reading**: Most recent rainfall measurement
- **30-Day Summary**: Total, average, maximum rainfall
- **7-Day Summary**: Weekly statistics
- **Data Quality**: Availability and freshness indicators

### User Experience
- **Dark/Light Theme**: Toggle between themes
- **Mobile Responsive**: Optimized for all devices
- **Loading States**: Smooth loading animations
- **Error Handling**: Graceful error recovery

## 🔒 Security & Best Practices

- **No Sensitive Data**: No API keys or secrets in repository
- **Input Validation**: All scraped data is validated
- **Error Logging**: Comprehensive error handling
- **Rate Limiting**: Respectful scraping practices
- **Secure Headers**: Netlify security configuration

## 🐛 Troubleshooting

### Common Issues

1. **Scraper Fails**
   - Check if the target website structure changed
   - Verify Chromium dependencies are installed
   - Review GitHub Actions logs

2. **Data Not Loading**
   - Ensure `data/processed/rainfall-history.json` exists
   - Check file permissions
   - Verify JSON format is valid

3. **Build Fails**
   - Clear `node_modules` and reinstall
   - Check Node.js version (requires 18+)
   - Verify all dependencies are installed

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run scrape

# Check data files
ls -la data/processed/
cat data/processed/rainfall-history.json
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **UK Government**: For providing the rainfall data
- **Netlify**: For hosting the dashboard
- **GitHub**: For Actions and repository hosting
- **Recharts**: For the charting library
- **Tailwind CSS**: For the styling framework

## 📞 Support

If you encounter any issues:

1. Check the [Issues](https://github.com/YOUR_USERNAME/rainfall-tracker/issues) page
2. Review the troubleshooting section above
3. Create a new issue with detailed information

---

**Note**: This system is designed for educational and monitoring purposes. Always respect the terms of service of data sources and implement appropriate rate limiting. 