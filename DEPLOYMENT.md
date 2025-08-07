# Deployment Guide - UK Rainfall Tracker

This guide will walk you through deploying the complete rainfall data collection system.

## 🚀 Quick Deployment Steps

### 1. Fork and Setup Repository

1. **Fork this repository** to your GitHub account
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/rainfall-tracker.git
   cd rainfall-tracker
   ```

### 2. Local Testing

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Test the data processing**:
   ```bash
   node scripts/test-scraper.js
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```
   The app will be available at `http://localhost:3000`

### 3. Enable GitHub Actions

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Actions** → **General**
3. Enable **"Allow all actions and reusable workflows"**
4. Save changes

### 4. Deploy to Netlify

#### Option A: Deploy via Netlify UI

1. Go to [netlify.com](https://netlify.com) and sign up/login
2. Click **"New site from Git"**
3. Connect your GitHub account
4. Select your `rainfall-tracker` repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `build/`
6. Click **"Deploy site"**

#### Option B: Deploy via Netlify CLI

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**:
   ```bash
   netlify login
   ```

3. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

### 5. Configure Environment

1. **Set up environment variables** (if needed):
   - Go to your Netlify site dashboard
   - Navigate to **Site settings** → **Environment variables**
   - Add any required environment variables

2. **Test the deployment**:
   - Visit your Netlify URL
   - Verify the dashboard loads correctly
   - Check that sample data is displayed

## 🔧 Advanced Configuration

### Customizing the Scraper

Edit `scripts/scrape-rainfall.js` to modify:
- Target URL
- Data processing logic
- Error handling
- Retry mechanisms

### Modifying the Dashboard

Edit React components in `src/components/` to:
- Add new chart types
- Modify statistics calculations
- Change the UI design
- Add new features

### GitHub Actions Customization

Edit `.github/workflows/scrape-rainfall.yml` to:
- Change the schedule (currently daily at 9 AM UTC)
- Add email notifications
- Modify the runner environment
- Add additional steps

## 📊 Monitoring and Maintenance

### Checking Data Collection

1. **View GitHub Actions logs**:
   - Go to your repository → Actions tab
   - Click on the latest workflow run
   - Check for any errors

2. **Monitor data files**:
   - Check `data/processed/rainfall-history.json`
   - Verify data is being updated regularly
   - Look for any data quality issues

### Troubleshooting Common Issues

#### Scraper Fails
- Check if the target website structure changed
- Verify Chromium dependencies are installed
- Review GitHub Actions logs for specific errors

#### Dashboard Not Loading
- Ensure `data/processed/rainfall-history.json` exists
- Check file permissions
- Verify JSON format is valid

#### Build Fails
- Clear `node_modules` and reinstall
- Check Node.js version (requires 18+)
- Verify all dependencies are installed

## 🔒 Security Considerations

### Data Privacy
- No sensitive data is stored in the repository
- All data is publicly available from the source
- No API keys or secrets required

### Rate Limiting
- The scraper runs only once per day
- Respectful scraping practices implemented
- No aggressive requests to the target site

### Error Handling
- Comprehensive error logging
- Graceful degradation when data unavailable
- User-friendly error messages

## 📈 Performance Optimization

### Build Optimization
- React app is optimized for production
- Tailwind CSS is purged for minimal bundle size
- Images and assets are optimized

### Data Management
- Historical data is stored efficiently
- Duplicate prevention implemented
- Automatic cleanup of old data (configurable)

## 🎯 Next Steps

### Immediate Actions
1. **Test the deployment** thoroughly
2. **Monitor the first few runs** of the scraper
3. **Verify data quality** and accuracy
4. **Set up monitoring** for the system

### Future Enhancements
- Add email notifications for failures
- Implement data export functionality
- Add comparison with historical averages
- Support multiple rainfall stations
- Integrate weather alerts

### Scaling Considerations
- The system is designed to handle years of data
- Consider data archiving for very long periods
- Monitor storage usage as data grows
- Implement data compression if needed

## 📞 Support

If you encounter issues:

1. **Check the logs** in GitHub Actions
2. **Review the troubleshooting section** in README.md
3. **Test locally** to isolate issues
4. **Create an issue** with detailed information

## 🎉 Success Criteria

Your deployment is successful when:

✅ **Dashboard loads** without errors  
✅ **Sample data displays** correctly  
✅ **GitHub Actions run** successfully  
✅ **Data files are created** in the repository  
✅ **Netlify deployment** is live and accessible  

---

**Congratulations!** You now have a fully automated rainfall data collection and visualization system running in production. 