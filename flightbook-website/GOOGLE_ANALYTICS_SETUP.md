# Google Analytics Setup for Flightbook

## How to Add Google Analytics Tracking

1. **Get your Google Analytics ID:**
   - Go to [Google Analytics](https://analytics.google.com/)
   - Create a new property for flightbook.ch
   - Copy your Measurement ID (format: `G-XXXXXXXXXX`)

2. **Add the ID to the config:**
   - Open `src/config.yaml`
   - Find line 76 with the analytics section
   - Replace `null` with your Google Analytics ID

   ```yaml
   analytics:
     vendors:
       googleAnalytics:
         id: 'G-XXXXXXXXXX' # Replace with your actual ID
   ```

3. **Rebuild the site:**

   ```bash
   npm run build
   ```

4. **Verify tracking:**
   - Deploy the site
   - Visit your site
   - Check Google Analytics Real-Time reports to confirm tracking is working

## What Gets Tracked

The Google Analytics integration will automatically track:

- Page views
- User sessions
- Traffic sources
- User demographics (if enabled)
- Custom events (if configured)

## Privacy Considerations

- Consider adding a cookie consent banner if required by GDPR
- Update your privacy policy to mention Google Analytics
- Consider anonymizing IP addresses in Google Analytics settings
