# 🌧️ Blob Storage Implementation Guide

This document explains how to safely test and use Netlify Blobs for storing rainfall data, with foolproof fallback mechanisms.

## 🎯 Overview

Your rainfall collection system now supports **Netlify Blobs** for cloud storage while maintaining complete backward compatibility with your existing JSON files. This implementation is designed to be **foolproof** - you can safely switch between blob storage and file storage without breaking anything.

## 🛡️ Safety Features

### 🔀 Three Operating Modes

1. **Traditional Mode** (Default) - Uses only JSON files
2. **Safe Testing Mode** - Uses blobs with file fallbacks 
3. **Production Mode** - Uses only blobs (after thorough testing)

### 🚨 Fallback Chain
Your system tries data sources in this order:
1. Netlify Blobs (if enabled)
2. Remote GitHub files 
3. Local JSON files
4. Embedded fallback data

**Result:** Your dashboard will ALWAYS work, even if blobs fail!

## 🚀 Quick Start

### 1. Check Current Status
```bash
npm run blob:status
```

### 2. Upload Existing Data to Blobs
```bash
# Upload your current 2 stations to blob storage
npm run blob:upload
```

### 3. Enable Safe Testing Mode
```bash
# Enable blobs but keep file fallbacks
npm run blob:enable
```

### 4. Test Locally
```bash
# Start local development with Netlify functions
npm run dev:netlify

# Test the API with debug info
curl "http://localhost:8888/.netlify/functions/rainfall-data?debug=1"
```

### 5. Test Both Stations
```bash
# Test Miserden station
curl "http://localhost:8888/.netlify/functions/rainfall-data?station=miserden1141&debug=1"

# Test Maenclochog station  
curl "http://localhost:8888/.netlify/functions/rainfall-data?station=maenclochog1099&debug=1"
```

## 📊 Understanding Debug Output

When you add `?debug=1` to your API calls, you'll see detailed diagnostics:

```json
{
  "success": true,
  "data": { /* your rainfall data */ },
  "source": "blob-storage",  // Shows which source was used
  "diagnostics": {
    "config": {
      "useBlobStorage": true,
      "blobFallbackEnabled": true
    },
    "attempts": [
      { "type": "blob", "ok": true, "size": 12345 }
    ],
    "decided": { "type": "blob", "station": "miserden1141" }
  }
}
```

**Key indicators:**
- `source: "blob-storage"` = Using blobs ✅
- `source: "remote"` = Using GitHub files (fallback)
- `source: "local-file"` = Using local JSON (fallback)
- `source: "embedded-fallback"` = Using hardcoded data (last resort)

## 🎮 Command Reference

| Command | Description | Safety |
|---------|-------------|---------|
| `npm run blob:status` | Show current configuration | ✅ Safe |
| `npm run blob:upload` | Upload JSON files to blobs | ✅ Safe |
| `npm run blob:list` | List all stored blobs | ✅ Safe |
| `npm run blob:enable` | Enable blob storage (with fallbacks) | ✅ Safe |
| `npm run blob:disable` | Disable blob storage | ✅ Safe |

## 🧪 Testing Scenarios

### Scenario 1: Normal Operation
- Blobs enabled, data loads from cloud
- `source: "blob-storage"`

### Scenario 2: Blob Failure
- Blobs enabled but blob service is down
- Falls back to GitHub files
- `source: "remote"`

### Scenario 3: Complete Fallback
- Blobs disabled or failed
- GitHub also fails
- Uses local JSON files
- `source: "local-file"`

## 🔄 Safe Deployment Process

### Phase 1: Local Testing
```bash
# 1. Upload data to blobs
npm run blob:upload

# 2. Enable safe mode locally
npm run blob:enable

# 3. Test both stations work
npm run dev:netlify
```

### Phase 2: Production Testing 
```bash
# 1. Deploy with blobs DISABLED (safe)
git add .
git commit -m "Add blob storage support (disabled)"
git push

# 2. Enable blobs in production UI
# Go to Netlify dashboard > Environment variables
# Set USE_BLOB_STORAGE = true

# 3. Test production API
curl "https://yoursite.netlify.app/.netlify/functions/rainfall-data?debug=1"
```

### Phase 3: Full Rollout
Only after thorough testing:
```bash
# Update netlify.toml to enable by default
npm run blob:enable

# Deploy the change
git commit -m "Enable blob storage by default"
git push
```

## 🚨 Emergency Rollback

If anything goes wrong:

```bash
# Instantly disable blobs and revert to files
npm run blob:disable

# Deploy the fix
git commit -m "Emergency: disable blob storage"
git push
```

Your site will immediately revert to using JSON files.

## 📁 Blob Storage Structure

```
rainfall-data/
├── stations/
│   ├── miserden1141.json     # Miserden EA station data
│   ├── maenclochog1099.json  # Maenclochog NRW station data
│   └── [future stations...]
└── metadata/
    └── upload-log.json       # Upload tracking and metadata
```

## 💡 Tips for Success

1. **Always test locally first** with `npm run dev:netlify`
2. **Use debug mode** to see which data source is being used
3. **Keep fallbacks enabled** until you're 100% confident
4. **Monitor your dashboard** after enabling blobs in production
5. **Have the emergency rollback ready** if needed

## 🔍 Troubleshooting

### Problem: "Blob storage failed" in debug output
**Solution:** Check your Netlify environment variables and blob permissions

### Problem: API returns embedded fallback data
**Solution:** Your JSON files and blobs both failed - check file paths and blob uploads

### Problem: Site works locally but not in production
**Solution:** Verify environment variables are set correctly in Netlify dashboard

### Problem: Data appears stale
**Solution:** Re-run `npm run blob:upload` to refresh blob data

---

## 🎉 Next Steps

Once blob storage is working smoothly with your 2 stations:

1. **Scale to more stations** using the same upload process
2. **Implement automated blob updates** in GitHub Actions
3. **Add blob cleanup scripts** for old data
4. **Monitor blob storage usage** and costs

This implementation gives you a **bulletproof migration path** to cloud storage! 🚀
