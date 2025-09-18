# EmazingHR Slack Backend

A Node.js Express server that handles Slack webhook events for the EmazingHR system. This backend processes Slack messages, matches them with FAQs from a Supabase database, and responds automatically.

## Features

- 🤖 Slack bot webhook handling
- 📚 FAQ matching and responses
- 💾 Conversation logging to Supabase
- 🔍 Health check endpoints
- 🧪 Test endpoints for debugging

## Quick Deploy to Render

### 1. Deploy to Render

1. **Create a new Web Service** on [Render](https://render.com)
2. **Connect your repository** or upload these files
3. **Configure the service:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node.js
   - **Region:** Choose closest to your users

### 2. Set Environment Variables

In your Render dashboard, add these environment variables:

```bash
# Required - Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Required - Slack Configuration  
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token

# Optional - Server Configuration
NODE_ENV=production
PORT=10000
```

### 3. Get Your Webhook URL

After deployment, your webhook URL will be:
```
https://your-app-name.onrender.com/api/slack/events
```

### 4. Configure Slack App

1. Go to your [Slack App settings](https://api.slack.com/apps)
2. Navigate to **Event Subscriptions**
3. Enable events and set **Request URL** to:
   ```
   https://your-app-name.onrender.com/api/slack/events
   ```
4. Subscribe to these bot events:
   - `message.channels`
   - `message.groups` 
   - `message.im`
   - `message.mpim`

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and timestamp.

### Slack Events (Main Webhook)
```
POST /api/slack/events
```
Handles Slack webhook events including URL verification and message processing.

### Slack Test (Minimal Endpoint)
```
POST /api/slack/test
```
Minimal endpoint for testing Slack verification without middleware.

### Test Connection
```
GET /api/slack/test-connection
```
Tests the Slack bot token and returns connection status.

## Local Development

1. **Clone and install:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Test locally:**
   ```bash
   curl http://localhost:3001/health
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Your Supabase anonymous key |
| `SLACK_BOT_TOKEN` | ✅ | Your Slack bot token (starts with `xoxb-`) |
| `PORT` | ❌ | Server port (default: 3001, Render uses 10000) |
| `NODE_ENV` | ❌ | Environment (development/production) |

## Database Schema

The backend expects these Supabase tables:

### `faqs` table:
- `id` (uuid, primary key)
- `question` (text)
- `answer` (text) 
- `category` (text, nullable)
- `is_active` (boolean, default true)
- `created_by` (uuid, foreign key)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `slack_conversations` table:
- `id` (uuid, primary key)
- `slack_user_id` (text)
- `slack_channel_id` (text)
- `user_message` (text)
- `bot_response` (text)
- `faq_matched` (uuid, nullable, foreign key to faqs)
- `response_type` (text: 'faq_match', 'no_match', 'error')
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Troubleshooting

### Slack Verification Fails
1. Check that your webhook URL is publicly accessible
2. Verify the `/api/slack/events` endpoint responds to POST requests
3. Use the `/api/slack/test` endpoint for minimal testing
4. Check Render logs for detailed error messages

### FAQ Matching Not Working
1. Ensure FAQs exist in your Supabase `faqs` table
2. Check that `is_active` is set to `true` for FAQs
3. Verify Supabase credentials are correct
4. Check server logs for database connection errors

### Messages Not Sending
1. Verify your `SLACK_BOT_TOKEN` is correct and starts with `xoxb-`
2. Ensure your bot has permission to post in the channel
3. Check the `/api/slack/test-connection` endpoint

## Support

For issues with:
- **Render deployment:** Check [Render documentation](https://render.com/docs)
- **Slack integration:** Check [Slack API documentation](https://api.slack.com/)
- **Supabase:** Check [Supabase documentation](https://supabase.com/docs)