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

// Track when messages arrive for response time calculation
const messageTimestamps = new Map();

// Track who we're waiting for detailed feedback from
const pendingFollowups = new Map();

// Function to add reaction emojis
async function addReactions(channel, timestamp) {
  try {
    // Add thumbs up
    await fetch('https://slack.com/api/reactions.add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channel,
        timestamp: timestamp,
        name: 'thumbsup'
      })
    });
    
    // Add thumbs down
    await fetch('https://slack.com/api/reactions.add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channel,
        timestamp: timestamp,
        name: 'thumbsdown'
      })
    });
    
    console.log('Reactions added successfully');
  } catch (error) {
    console.error('Error adding reactions:', error);
  }
}

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
      const startTime = Date.now(); // Track when we started processing
      console.log('Processing message:', text);
      console.log('From user:', user);
      console.log('In channel:', channel);
      
      // Handle thread replies for detailed feedback
      if (event.thread_ts && pendingFollowups.has(user)) {
        console.log(`Detailed feedback received from ${user}: ${text}`);
        
        // Store detailed feedback in database
        const { error } = await supabase
          .from('feedback_logs')
          .insert({
            slack_user_id: user,
            slack_channel_id: channel,
            feedback_text: text,
            satisfaction: false, // It was negative feedback that prompted this
            created_at: new Date().toISOString()
          });
        
        if (error) {
          console.error('Error storing detailed feedback:', error);
        } else {
          // Thank the user
          await sendThreadedMessage(
            channel,
            event.thread_ts,
            "Thank you for your feedback! We'll use this to improve our responses."
          );
          
          // Remove from pending
          pendingFollowups.delete(user);
          console.log('Detailed feedback stored successfully');
        }
        return res.json({ ok: true });
      }
      
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
        
        // Send response with reactions
        const responseText = bestMatch 
          ? bestMatch.answer 
          : "I'll connect you with our HR team for help with that question.";
        
        console.log('Best match:', bestMatch ? bestMatch.question : 'none');
        console.log('Sending response:', responseText);
        
        // Send message and get the timestamp
        const messageResult = await sendSlackMessageWithBlocks(channel, responseText);
        
        // Add reactions if message was sent successfully
        if (messageResult && messageResult.ok && messageResult.ts) {
          await addReactions(channel, messageResult.ts);
          
          // Calculate response time
          const responseTime = Date.now() - startTime;
          console.log(`Response time: ${responseTime}ms`);
        }
        
        // Store conversation
        const { error: convError } = await supabase
          .from('slack_conversations')
          .insert({
            slack_user_id: user,
            slack_channel_id: channel,
            user_message: text,
            bot_response: responseText,
            faq_matched: bestMatch ? bestMatch.id : null,
            response_type: bestMatch ? 'faq_match' : 'no_match',
            response_time_ms: Date.now() - startTime
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
    

     // Handle reaction events for feedback tracking
if (event.type === 'reaction_added' && event.item && event.item.type === 'message') {
  console.log('Reaction added:', event.reaction);
  console.log('By user:', event.user);
  
// Skip if this is the bot's own reaction (bot user ID from logs)
if (event.user === 'U09FYC4GSSW') {
  console.log('Skipping bot reaction');
  return res.json({ ok: true });
}
  }
      console.log('To message:', event.item.ts);
      
      try {
        // Track only thumbsup and thumbsdown reactions
        if (event.reaction === 'thumbsup' || event.reaction === 'thumbsdown' || 
            event.reaction === '+1' || event.reaction === '-1') {
          const feedback = (event.reaction === 'thumbsup' || event.reaction === '+1') ? 'positive' : 'negative';
          
          // Log to feedback_logs table
          const { error } = await supabase
            .from('feedback_logs')
            .insert({
              slack_user_id: event.user,
              slack_channel_id: event.item.channel,
              satisfaction: feedback === 'positive' ? true : false,
              feedback_text: feedback
            });
          
          if (error) {
            console.error('Error logging feedback:', error);
          } else {
            console.log(`Feedback logged: ${feedback} from user ${event.user}`);
            
            // If negative feedback, ask for more details
            if (feedback === 'negative') {
              // Store that we're waiting for detailed feedback
              pendingFollowups.set(event.user, {
                channel: event.item.channel,
                thread_ts: event.item.ts,
                timestamp: new Date().toISOString()
              });
              
              // Send follow-up question in thread
              await sendThreadedMessage(
                event.item.channel,
                event.item.ts,
                "I'm sorry that wasn't helpful. Could you briefly tell me what you were looking for so I can improve?"
              );
              
              console.log('Follow-up question sent for negative feedback');
            }
          }
        }
      } catch (error) {
        console.error('Error handling reaction:', error);
      }
    }
  }
  
  // Always respond with OK to Slack
  res.json({ ok: true });
});

// Send message to Slack with blocks
async function sendSlackMessageWithBlocks(channel, text) {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channel,
        text: text,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: text
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '_Was this helpful?_'
            }
          }
        ]
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
    return null;
  }
}

// Send simple message to Slack
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

// Send threaded message to Slack
async function sendThreadedMessage(channel, thread_ts, text) {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channel,
        text: text,
        thread_ts: thread_ts
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Failed to send threaded message:', result.error);
    } else {
      console.log('Threaded message sent successfully');
    }
    return result;
  } catch (error) {
    console.error('Error sending threaded message:', error);
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
