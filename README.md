# Social Identity Mapper

A web application for conducting Social Identity Mapping (SIM) activities, based on the methodology described in:

> Cruwys, T., Steffens, N. K., Haslam, S. A., Haslam, C., Jetten, J., & Dingle, G. A. (2016). Social Identity Mapping: A procedure for visual representation and assessment of subjective multiple group memberships. *British Journal of Social Psychology*, 55, 613–642. http://doi.org/10.1111/bjso.12155

## Overview

This tool digitizes the traditional paper-based Social Identity Mapping activity, allowing participants to:

1. **Identify groups** they belong to (family, work, social, community, etc.)
2. **Rate importance** of each group (displayed as size and color)
3. **Add details** for each group:
   - Positivity (1-10)
   - Contact frequency (days/month)
   - Tenure (years)
   - Representativeness (1-10)
4. **Position groups** on a canvas to show similarity/difference
5. **Draw connections** between groups indicating compatibility (very easy / moderate / not easy)
6. **Download data** as JSON for analysis

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
open http://localhost:3000?session=test123
```

## Usage

### Session Management

Sessions are identified by URL parameter:
```
http://localhost:3000?session=PARTICIPANT_ID
```

This allows integration with survey platforms (e.g., Qualtrics, REDCap) by passing participant IDs via URL.

### Data Storage

- **Client-side**: Auto-saved to localStorage
- **Server-side**: Saved to `data/` folder as JSON files
- **Export**: Participants can download their data as JSON

### Data Format

```json
{
  "sessionId": "participant123",
  "createdAt": "2024-01-26T...",
  "updatedAt": "2024-01-26T...",
  "groups": [
    {
      "id": "g_abc123",
      "name": "Family",
      "importance": "high",
      "positivity": 9,
      "contact": 20,
      "tenure": 30,
      "representativeness": 8,
      "x": 150,
      "y": 200
    }
  ],
  "connections": [
    {
      "from": "g_abc123",
      "to": "g_def456",
      "type": "easy"
    }
  ]
}
```

## Deployment

### Local Development
```bash
npm start
```

### Production

The app can be deployed to any Node.js hosting platform:

- **Render**: Connect GitHub repo, set start command to `npm start`
- **Railway**: Connect GitHub repo, auto-detects Node.js
- **Vercel**: May need serverless adapter for the Express backend
- **Heroku**: `git push heroku main`

Environment variables:
- `PORT` - Server port (default: 3000)

## Design Notes

- **Colorblind-friendly**: Importance levels use blue (high), gold (medium), and gray (low)
- **No defaults**: Participants must actively select all values (no priming)
- **Auto-save**: Progress saved automatically at each step
- **Guided flow**: Step-by-step instructions matching the original SIM methodology

## License

MIT
