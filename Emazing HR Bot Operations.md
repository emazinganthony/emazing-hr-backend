\# EmazingHR Slack Bot \- Operations Guide  
\*\*Last Updated\*\*: January 18, 2025  
\*\*Status\*\*: Development (Not Production)

\#\# Quick Reference

\#\#\# Is the Bot Down?  
1\. Check UptimeRobot: https://uptimerobot.com  
2\. Test directly: https://emazing-hr-backend.onrender.com/health  
3\. Check Render: https://dashboard.render.com

\#\#\# How It Works (Simple Version)  
The EmazingHR bot listens for employee questions in Slack, searches our FAQ database for matches, and responds with answers. It tracks feedback via reactions (👍/👎) and asks for details when responses aren't helpful.

\#\# System Components

\#\#\# 1\. Code Location  
\- \*\*GitHub Repository\*\*: https://github.com/\[emazinganthony\]/emazing-hr-backend  
\- \*\*Main File\*\*: \`index.js\`  
\- \*\*Auto-Deploy\*\*: Any commit to GitHub triggers automatic deployment

\#\#\# 2\. Hosting (Render)  
\- \*\*Service URL\*\*: https://emazing-hr-backend.onrender.com  
\- \*\*Dashboard\*\*: https://dashboard.render.com  
\- \*\*Plan\*\*: Free (spins down after 15 min inactivity, takes 30-60 sec to wake)  
\- \*\*Login\*\*: anthony@emazinggroup.com

\#\#\# 3\. Database (Supabase)  
\- \*\*Dashboard\*\*: https://supabase.com/dashboard  
\- \*\*Project\*\*: EmazingHR  
\- \*\*Tables\*\*:   
  \- \`faqs\` \- Questions and answers  
  \- \`slack\_conversations\` \- All interactions  
  \- \`feedback\_logs\` \- User satisfaction tracking  
\- \*\*Login\*\*: anthony@emazinggroup.com

\#\#\# 4\. Slack Integration  
\- \*\*Workspace\*\*: EmazingGroup  
\- \*\*App Name\*\*: EmazingHR Bot  
\- \*\*Slack App Dashboard\*\*: https://api.slack.com/apps  
\- \*\*Bot User ID\*\*: U09FYC4GSSW

\#\# Environment Variables (in Render)  
\- \`SLACK\_BOT\_TOKEN\` \- xoxb-\[masked\]  
\- \`SUPABASE\_URL\` \- https://\[your-project\].supabase.co  
\- \`SUPABASE\_ANON\_KEY\` \- \[masked\]  
\- \`BOT\_USER\_ID\` \- U09FYC4GSSW

\#\# How to Restart if Down

\#\#\# Quick Fix (Usually Works)  
1\. Visit https://emazing-hr-backend.onrender.com/health  
2\. Wait 30-60 seconds for it to wake up  
3\. Refresh the page \- should show "healthy"

\#\#\# If Quick Fix Doesn't Work  
1\. Log into Render Dashboard  
2\. Click on "emazing-hr-backend" service  
3\. Click "Manual Deploy" → "Deploy latest commit"  
4\. Wait 3-5 minutes for deployment  
5\. Test health endpoint again

\#\#\# If Still Broken  
1\. Check Render logs for error messages  
2\. Verify all environment variables are set  
3\. Check Supabase is not paused (free tier pauses after 1 week inactive)  
4\. Contact Anthony 

\#\# Common Issues & Solutions

| Problem | Solution |  
|---------|----------|  
| Bot not responding | Service sleeping \- wait 60 seconds and try again |  
| "Database error" in logs | Check Supabase dashboard \- might be paused |  
| Reactions not working | Check BOT\_USER\_ID environment variable |  
| FAQs not matching | Add more keywords to FAQ questions in database |

\#\# Manual Backup Process (Every Monday)

1\. \*\*Export Supabase Data\*\*:  
   \- Go to Supabase dashboard  
   \- Table Editor → Select table → Export → CSV  
   \- Save all 3 tables (faqs, slack\_conversations, feedback\_logs)  
   \- Store in: Google Drive/EmazingHR\_Bot/Backups/\[DATE\]/

2\. \*\*Backup Code\*\*:  
   \- Already automatic via GitHub  
   \- For extra safety: Download ZIP from GitHub monthly

\#\# Testing the Bot

1\. \*\*In Slack\*\*:   
   \- Direct message the bot  
   \- Try: "My zoom is not working"  
   \- Should get response \+ reactions

2\. \*\*Check Feedback\*\*:  
   \- Click 👎 on response  
   \- Bot should ask for details in thread  
   \- Reply with feedback  
   \- Check Supabase \`feedback\_logs\` table

\#\# Development Workflow

1\. \*\*Small Changes\*\*: Edit directly on GitHub  
2\. \*\*New Features\*\*: Build in Bolt.new first, test, then integrate  
3\. \*\*Testing\*\*: Always test in Slack after deployment

\#\# Emergency Contacts

\*\*Primary Contact\*\*: Anthony Lim  
\- Email: Anthony@EmazingGroup.com  
\- Phone: 626-780-0948

\*\*Backup Contact\*\*: \[Colleague Name\]  
\- Email: \[Their email\]  
\- Phone: \[Their phone\]

\#\# Credentials Needed for Takeover

If someone else needs to maintain this:  
1\. GitHub access to repository  
2\. Render account access  
3\. Supabase project access  
4\. Slack workspace admin access  
5\. This documentation

\#\# Cost Breakdown (Current)  
\- \*\*Render\*\*: $0 (Free tier)  
\- \*\*Supabase\*\*: $0 (Free tier)  
\- \*\*Slack\*\*: $0 (Already have workspace)  
\- \*\*Total\*\*: $0/month

\#\# Future Upgrade Costs (Production)  
\- \*\*Render\*\*: $7/month (Prevent sleeping)  
\- \*\*Supabase\*\*: $25/month (Automatic backups, better performance)  
\- \*\*OpenAI\*\*: \~$30-50/month (When Phase 4 implemented)  
\- \*\*Total\*\*: \~$65/month

\#\# Notes for Future Development  
\- Phase 2: Google Drive integration for FAQ management (planned)  
\- Phase 4: OpenAI integration for better matching (planned)  
\- Phase 5-8: Personal employee data features (planned)

