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
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  // Handle Slack URL verification
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
        
        // Stor
