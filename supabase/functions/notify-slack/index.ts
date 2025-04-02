
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifySlackRequest {
  type: string;
  userData: {
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!SLACK_WEBHOOK_URL) {
      throw new Error("SLACK_WEBHOOK_URL environment variable is not set");
    }

    const { type, userData } = await req.json() as NotifySlackRequest;

    if (type !== "signup") {
      return new Response(
        JSON.stringify({ error: "Only signup notifications are supported" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the current timestamp
    const timestamp = new Date().toISOString();
    
    // Format the user name for display
    const userName = userData.firstName && userData.lastName
      ? `${userData.firstName} ${userData.lastName}`
      : userData.username || userData.email.split('@')[0];

    // Prepare the message for Slack
    const slackMessage = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 New User Signup!",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:*\n${userData.firstName || "Not provided"} ${userData.lastName || ""}`,
            },
            {
              type: "mrkdwn",
              text: `*Username:*\n${userData.username || "Not provided"}`,
            },
          ],
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Email:*\n${userData.email}`,
            },
            {
              type: "mrkdwn",
              text: `*Time:*\n${new Date(timestamp).toLocaleString()}`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Signup received from F1 RaceHub application`,
            },
          ],
        },
      ],
    };

    console.log("Sending notification to Slack...");
    
    // Send the message to Slack
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from Slack:", errorText);
      throw new Error(`Slack API error: ${response.status} ${errorText}`);
    }

    console.log("Slack notification sent successfully!");

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent to Slack" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in notify-slack function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
