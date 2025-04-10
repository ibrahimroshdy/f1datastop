import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  console.log("📣 Notify-Slack function started");
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!SLACK_WEBHOOK_URL) {
      console.error("❌ SLACK_WEBHOOK_URL environment variable is not set");
      throw new Error("SLACK_WEBHOOK_URL environment variable is not set");
    }
    console.log("✅ SLACK_WEBHOOK_URL is set");
    
    // Check if it's a GET request (for health checks)
    if (req.method === "GET") {
      return new Response(JSON.stringify({
        status: "healthy",
        message: "Notify-Slack function is running"
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Log the request body for debugging
    const requestBody = await req.text();
    console.log("Request body:", requestBody);
    
    // Validate request body
    if (!requestBody || requestBody.trim() === "") {
      console.error("❌ Empty request body");
      return new Response(JSON.stringify({
        error: "Empty request body"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Parse the JSON body
    let parsedData;
    try {
      parsedData = JSON.parse(requestBody);
    } catch (jsonError) {
      console.error("❌ Invalid JSON in request body:", jsonError);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    const { type, userData } = parsedData;
    console.log("Parsed request data:", {
      type,
      userData
    });
    
    if (!type || !userData) {
      console.error("❌ Missing required fields in request");
      return new Response(JSON.stringify({
        error: "Missing type or userData fields"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    if (type !== "signup") {
      console.error("❌ Invalid notification type:", type);
      return new Response(JSON.stringify({
        error: "Only signup notifications are supported"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Get the current timestamp
    const timestamp = new Date().toISOString();
    
    // Get the auth provider (default to "email" if not provided)
    const provider = userData.provider || "email";
    
    // Create custom header text based on provider
    const headerText = provider === "twitter" 
      ? "🐦 New Twitter/X User Signup!" 
      : provider === "google" 
        ? "🔍 New Google User Signup!" 
        : "✉️ New Email User Signup!";
    
    // Format the user name for display
    const userName = userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.username || userData.email.split('@')[0];
    console.log("Formatted user name:", userName);
    console.log("Auth provider:", provider);
    
    // Prepare the message for Slack
    const slackMessage = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: headerText,
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:*\n${userData.firstName || "Not provided"} ${userData.lastName || ""}`
            },
            {
              type: "mrkdwn",
              text: `*Username:*\n${userData.username || "Not provided"}`
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Email:*\n${userData.email || "Not provided"}`
            },
            {
              type: "mrkdwn",
              text: `*Auth Provider:*\n${provider}`
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Time:*\n${new Date(timestamp).toLocaleString()}`
            }
          ]
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Signup received from F1 DataStop application`
            }
          ]
        }
      ]
    };
    console.log("Sending notification to Slack...");
    console.log("Webhook URL (masked):", SLACK_WEBHOOK_URL.substring(0, 15) + "...");
    console.log("Slack message:", JSON.stringify(slackMessage, null, 2));
    // Send the message to Slack
    console.log("Sending POST request to Slack webhook...");
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(slackMessage)
    });
    console.log("Slack API response status:", response.status);
    const responseText = await response.text();
    console.log("Slack API response body:", responseText);
    if (!response.ok) {
      console.error("❌ Error response from Slack:", responseText);
      throw new Error(`Slack API error: ${response.status} ${responseText}`);
    }
    console.log("✅ Slack notification sent successfully!");
    return new Response(JSON.stringify({
      success: true,
      message: "Notification sent to Slack"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("❌ Error in notify-slack function:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}); 