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
  console.log('=== MINIMAL SLACK TEST ENDPOINT ===');
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
      
      if (data.type === 'url_verification') {
        console.log('✅ Verification challenge detected!');
        console.log('Challenge value:', data.challenge);
        console.log('Sending challenge response...');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(data.challenge);
        console.log('✅ Challenge response sent successfully');
      } else {
        console.log('Not a verification challenge, sending OK');
        res.status(200).send('OK');
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
      res.status(400).send('Bad request');
    }
  });
});

// Main Slack Events Endpoint
app.post('/api/slack/events', async (req, res) => {
  console.log('=== SLACK WEBHOOK REQUEST ===');
  console.log('Received request body:', JSON.stringify(req.body, null, 2));
  console.log('Request body type:', req.body?.type);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    // Handle Slack URL verification challenge FIRST - before any other processing
    if (req.body && req.body.type === 'url_verification') {
      console.log('✅ Verification challenge detected!');
      console.log('Challenge value:', req.body.challenge);
      const challenge = req.body.challenge;
      console.log('Sending challenge response:', challenge);
      console.log('Response status: 200, Content-Type: text/plain');
      return res.status(200).type('text/plain').send(challenge);
    }

    console.log('Not a verification challenge, processing as event...');
    const body = req.body;

    // Handle Slack events
    if (body.type === 'event_callback') {
      const event = body.event;

 // Process the message
if (event.type === 'message' && !event.bot_id && event.text) {
    const { text, channel, user } = event;
    
    console.log('Processing message:', text);
    console.log('From user:', user);
    console.log('In channel:', channel);
    
    try {
        // Search for relevant FAQ
        console.log('Fetching all active FAQs...');
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
        
        // Convert message to lowercase for matching
        const searchText = text.toLowerCase().trim();
        console.log('Searching for:', searchText);
        
        // Try to find a matching FAQ
        let bestMatch = null;
        let highestScore = 0;
        
        for (const faq of faqs) {
            const faqQuestion = faq.question.toLowerCase();
            console.log('Comparing with FAQ:', faqQuestion);
            
            // Check for exact match first
            if (faqQuestion === searchText) {
                console.log('Exact match found!');
                bestMatch = faq;
                highestScore = 100;
                break;
            }
            
            // Check if FAQ question contains the search text
            if (faqQuestion.includes(searchText) || searchText.includes(faqQuestion)) {
                console.log('Partial match found!');
                bestMatch = faq;
                highestScore = 50;
                continue;
            }
            
            // Check word overlap
            const searchWords = searchText.split(' ').filter(w => w.length > 2);
            const faqWords = faqQuestion.split(' ').filter(w => w.length > 2);
            let matches = 0;
            
            for (const word of searchWords) {
                if (faqQuestion.includes(word)) {
                    matches++;
                }
            }
            
            const score = (matches / searchWords.length) * 30;
            if (score > highestScore) {
                console.log('Word match found with score:', score);
                bestMatch = faq;
                highestScore = score;
            }
        }
        
        console.log('Best match:', bestMatch ? bestMatch.question : 'none');
        console.log('Match score:', highestScore);
        
        // Send response
        if (bestMatch && highestScore > 10) {
            console.log('Sending FAQ answer:', bestMatch.answer);
            await sendSlackMessage(channel, bestMatch.answer);
        } else {
            console.log('No good match found, sending default response');
            await sendSlackMessage(channel, "I'll connect you with our HR team for help with that question.");
        }
        
        // Store conversation
        const { error: convError } = await supabase
            .from('slack_conversations')
            .insert({
                slack_user_id: user,
                slack_channel_id: channel,
                user_message: text,
                bot_response: bestMatch ? bestMatch.answer : "I'll connect you with our HR team for help with that question.",
                faq_matched: bestMatch ? bestMatch.id : null
            });
        
        if (convError) {
            console.error('Error storing conversation:', convError);
        }
        
    } catch (error) {
        console.error('Error processing message:', error);
        await sendSlackMessage(channel, "I encountered an error. Please try again or contact IT support.");
    }
}

res.json({ ok: true });

        console.log('Processing message:', userMessage);

        // Remove bot mention from message if it's an app mention
        const cleanMessage = userMessage.replace(/<@[^>]+>/g, '').trim();

        // Find matching FAQ
        const matchingFaq = await findMatchingFAQ(cleanMessage);
        
        let response;
        let responseType;
        let faqId = null;

        if (matchingFaq) {
          response = `*${matchingFaq.question}*\n\n${matchingFaq.answer}`;
          responseType = 'faq_match';
          faqId = matchingFaq.id;
          console.log('FAQ match found:', matchingFaq.question);
        } else {
          response = "I'll connect you with our HR team for help with that question.";
          responseType = 'no_match';
          console.log('No FAQ match found');
        }

        // Send response to Slack
        await sendSlackMessage(channelId, response);

        // Log conversation
        await logConversation(
          userId,
          channelId,
          cleanMessage,
          response,
          faqId,
          responseType
        );
      }
    }

    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error processing Slack event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test connection endpoint
app.get('/api/slack/test-connection', async (req, res) => {
  try {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    
    if (!slackToken) {
      return res.json({ 
        success: false, 
        error: 'SLACK_BOT_TOKEN not configured' 
      });
    }

    // Test Slack connection
    const response = await fetch('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${slackToken}`,
      },
    });

    const result = await response.json();

    if (result.ok) {
      res.json({
        success: true,
        data: {
          user: result.user,
          team: result.team,
          url: result.url,
        },
      });
    } else {
      res.json({
        success: false,
        error: result.error || 'Slack authentication failed',
      });
    }
  } catch (error) {
    console.error('Slack connection test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Find matching FAQ function
async function findMatchingFAQ(userMessage) {
  try {
    const { data: faqs, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    if (!faqs || faqs.length === 0) {
      return null;
    }

    // Simple keyword matching - case insensitive
    const messageWords = userMessage.toLowerCase().split(/\s+/);
    
    let bestMatch = null;
    let bestScore = 0;

    for (const faq of faqs) {
      const questionWords = faq.question.toLowerCase().split(/\s+/);
      const answerWords = faq.answer.toLowerCase().split(/\s+/);
      const categoryWords = faq.category ? faq.category.toLowerCase().split(/\s+/) : [];
      
      let score = 0;
      
      // Check for word matches in question, answer, and category
      for (const messageWord of messageWords) {
        if (messageWord.length < 3) continue; // Skip short words
        
        // Question matches get highest weight
        for (const questionWord of questionWords) {
          if (questionWord.includes(messageWord) || messageWord.includes(questionWord)) {
            score += 3;
          }
        }
        
        // Category matches get medium weight
        for (const categoryWord of categoryWords) {
          if (categoryWord.includes(messageWord) || messageWord.includes(categoryWord)) {
            score += 2;
          }
        }
        
        // Answer matches get lower weight
        for (const answerWord of answerWords) {
          if (answerWord.includes(messageWord) || messageWord.includes(answerWord)) {
            score += 1;
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    // Return match only if score is above threshold
    return bestScore >= 2 ? bestMatch : null;
  } catch (error) {
    console.error('Error finding matching FAQ:', error);
    return null;
  }
}

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
        }
        return result;
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Log conversation to database
async function logConversation(
  slackUserId,
  slackChannelId,
  userMessage,
  botResponse,
  faqMatched = null,
  responseType = 'no_match'
) {
  try {
    const { error } = await supabase
      .from('slack_conversations')
      .insert({
        slack_user_id: slackUserId,
        slack_channel_id: slackChannelId,
        user_message: userMessage,
        bot_response: botResponse,
        faq_matched: faqMatched,
        response_type: responseType,
      });

    if (error) {
      console.error('Error logging conversation:', error);
    } else {
      console.log('Conversation logged successfully');
    }
  } catch (error) {
    console.error('Error logging conversation:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EmazingHR Slack Backend running on port ${PORT}`);
  console.log(`📡 Slack webhook URL: ${process.env.NODE_ENV === 'production' ? 'https://your-app.onrender.com' : `http://localhost:${PORT}`}/api/slack/events`);
  console.log(`🔗 Test connection: ${process.env.NODE_ENV === 'production' ? 'https://your-app.onrender.com' : `http://localhost:${PORT}`}/api/slack/test-connection`);
  console.log(`❤️  Health check: ${process.env.NODE_ENV === 'production' ? 'https://your-app.onrender.com' : `http://localhost:${PORT}`}/health`);
  console.log(`🧪 Test endpoint: ${process.env.NODE_ENV === 'production' ? 'https://your-app.onrender.com' : `http://localhost:${PORT}`}/api/slack/test`);
});

export default app;
