import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'EmazingHR Slack Backend',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Minimal Slack test endpoint (bypasses middleware)
app.post('/api/slack/test', (req, res) => {
  console.log('Minimal Slack TEST endpoint hit');
  const body = req.body;
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    console.log('Raw body received:', body);
    try {
      const data = JSON.parse(body);
      console.log('Parsed data:', JSON.stringify(data, null, 2));
      console.log('Data type:', data.type);
      
      // Handle Slack URL verification
      if (data.type === 'url_verification') {
        console.log('Responding to verification with challenge:', data.challenge);
        return res.json({ challenge: data.challenge });
      }
      
      res.json({ received: true, data: data });
    } catch (error) {
      console.error('Error parsing JSON:', error);
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
});

// Test database connection
app.get('/api/slack/test-connection', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('count')
      .single();
    
    if (error) {
      console.error('Database connection error:', error);
      return res.status(500).json({ 
        connected: false, 
        error: error.message 
      });
    }
    
    res.json({ 
      connected: true, 
      message: 'Successfully connected to Supabase',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ 
      connected: false, 
      error: error.message 
    });
  }
});

// Main Slack webhook endpoint
app.post('/api/slack/events', async (req, res) => {
  console.log('=== SLACK WEBHOOK REQUEST ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  const body = req.body;
  
  // URL Verification Challenge
  if (body.type === 'url_verification') {
    console.log('Responding to Slack verification challenge');
    return res.json({ challenge: body.challenge });
  }
  
  // Handle event callbacks
  if (body.type === 'event_callback') {
    const event = body.event;
    console.log('Event type:', event.type);
    console.log('Event details:', JSON.stringify(event, null, 2));
    
    // Process messages (not from bots)
    if (event.type === 'message' && !event.bot_id && event.text) {
      const { text, channel, user } = event;
      
      console.log('Processing message:', text);
      console.log('From user:', user);
      console.log('In channel:', channel);
      
      try {
        // Fetch all active FAQs
        console.log('Fetching FAQs from database...');
        const { data: faqs, error: faqError } = await supabase
          .from('faqs')
          .select('*')
          .eq('is_active', true);
        
        if (faqError) {
          console.error('Error fetching FAQs:', faqError);
          await sendSlackMessage(channel, "I'm having trouble accessing the FAQ database. Please contact IT support.");
          return res.json({ ok: true });
        }
        
        console.log('Found FAQs:', faqs ? faqs.length : 0);
        
        if (!faqs || faqs.length === 0) {
          console.log('No FAQs found in database');
          await sendSlackMessage(channel, "I don't have any FAQs loaded yet. Please contact HR to set them up.");
          return res.json({ ok: true });
        }
        
        // Search for matching FAQ
        const searchText = text.toLowerCase().trim();
        console.log('Searching for:', searchText);
        
        let bestMatch = null;
        let highestScore = 0;
        
        for (const faq of faqs) {
          const faqQuestion = faq.question.toLowerCase();
          console.log(`Comparing "${searchText}" with FAQ: "${faqQuestion}"`);
          
          // Exact match
          if (faqQuestion === searchText) {
            console.log('Exact match found!');
            bestMatch = faq;
            highestScore = 100;
            break;
          }
          
          // Contains match
          if (faqQuestion.includes(searchText) || searchText.includes(faqQuestion)) {
            console.log('Partial match found!');
            bestMatch = faq;
            highestScore = 50;
            continue;
          }
          
          // Word matching
          const searchWords = searchText.split(' ').filter(w => w.length > 2);
          const faqWords = faqQuestion.split(' ').filter(w => w.length > 2);
          let matches = 0;
          
          for (const word of searchWords) {
            if (faqQuestion.includes(word)) {
              matches++;
            }
          }
          
          if (searchWords.length > 0) {
            const score = (matches / searchWords.length) * 30;
            if (score > highestScore) {
              console.log('Word match found with score:', score);
              bestMatch = faq;
              highestScore = score;
            }
          }
        }
        
        console.log('Best match:', bestMatch ? bestMatch.question : 'none');
        console.log('Match score:', highestScore);
        
        // Send response
        const responseText = (bestMatch && highestScore > 10) 
          ? bestMatch.answer 
          : "I'll connect you with our HR team for help with that question.";
        
        console.log('Sending response:', responseText);
        await sendSlackMessage(channel, responseText);
        
        // Store conversation
        const { error: convError } = await supabase
          .from('slack_conversations')
          .insert({
            slack_user_id: user,
            slack_channel_id: channel,
            user_message: text,
            bot_response: responseText,
            faq_matched: bestMatch ? bestMatch.id : null,
            response_type: bestMatch ? 'faq_match' : 'no_match'
          });
        
        if (convError) {
          console.error('Error storing conversation:', convError);
        }
        
      } catch (error) {
        console.error('Error processing message:', error);
        await sendSlackMessage(channel, "I encountered an error. Please try again or contact IT support.");
      }
    }
  }
  
  // Always respond with OK to Slack
  res.json({ ok: true });
});

// Send message to Slack
async function sendSlackMessage(channel, text) {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channel,
        text: text
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Slack API error:', result.error);
    } else {
      console.log('Message sent successfully');
    }
    return result;
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EmazingHR Slack Backend running on port ${PORT}`);
  console.log(`🔗 Slack webhook URL: ${process.env.NODE_ENV === 'production' ? 'https://your-app.onrender.com' : `http://localhost:${PORT}`}/api/slack/events`);
  console.log(`🔗 Test connection: ${process.env.NODE_ENV === 'production' ? 'https://your-app.onrender.com' : `http://localhost:${PORT}`}/api/slack/test-connection`);
  console.log(`❤️ Health check: ${process.env.NODE_ENV === 'production' ? 'https://your-app.onrender.com' : `http://localhost:${PORT}`}/health`);
  console.log(`✅ Test endpoint: ${process.env.NODE_ENV === 'production' ? 'https://your-app.onrender.com' : `http://localhost:${PORT}`}/api/slack/test`);
});

export default app;
