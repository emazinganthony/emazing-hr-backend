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

// Minimal Slack test endpoint
app.post('/api/slack/test', (req, res) => {
  console.log('Minimal Slack TEST endpoint hit');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  if (req.body && req.body.type === 'url_verification') {
    console.log('Responding to verification with challenge:', req.body.challenge);
    return res.json({ challenge: req.body.challenge });
  }
  
  res.json({ received: true, data: req.body });
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
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
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
        if (faqs && faqs.length > 0) {
          faqs.forEach(faq => {
            console.log('FAQ:', faq.question, '-> Active:', faq.is_active);
          });
        }
        
        // Search for matching FAQ
        const searchText = text.toLowerCase().trim();
        console.log('Searching for:', searchText);
        
        let bestMatch = null;
        
        // Simple matching logic
        for (const faq of faqs || []) {
          const faqQuestion = faq.question.toLowerCase().trim();
          console.log(`Comparing "${searchText}" with "${faqQuestion}"`);
          
          // Check for key words
          if (searchText.includes('monitor') && faqQuestion.includes('monitor')) {
            console.log('Monitor match found!');
            bestMatch = faq;
            break;
          }
          
          if (searchText.includes('zoom') && faqQuestion.includes('zoom')) {
            console.log('Zoom match found!');
            bestMatch = faq;
            break;
          }
          
          // Check for exact or near match
          if (faqQuestion === searchText || faqQuestion.includes(searchText) || searchText.includes(faqQuestion)) {
            console.log('Match found!');
            bestMatch = faq;
            break;
          }
        }
        
        // Send response
        const responseText = bestMatch 
          ? bestMatch.answer 
          : "I'll connect you with our HR team for help with that question.";
        
        console.log('Best match:', bestMatch ? bestMatch.question : 'none');
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
        } else {
          console.log('Conversation logged successfully');
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
  console.log(`🔗 Slack webhook URL: https://emazing-hr-backend.onrender.com/api/slack/events`);
  console.log(`❤️ Health check: https://emazing-hr-backend.onrender.com/health`);
  console.log(`✅ Test endpoint: https://emazing-hr-backend.onrender.com/api/slack/test`);
});

export default app;
