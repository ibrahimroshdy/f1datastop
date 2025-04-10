import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers to allow cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// Handle CORS preflight requests
function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  return null;
}

serve(async (req) => {
  console.log("📣 CAPTCHA verification function started");
  
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Only POST requests are supported"
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  
  try {
    // Use your actual secret key here (I've included it directly, but better to use an env var)
    const RECAPTCHA_SECRET_KEY = Deno.env.get("RECAPTCHA_SECRET_KEY") || "6LcYyxIrAAAAAJWBK2smjrbBsPyq5k2nX3yIQbHU";
    
    // Get request body
    let requestBody: string;
    try {
      requestBody = await req.text();
      if (!requestBody || requestBody.trim() === "") {
        throw new Error("Empty request body");
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Failed to read request body"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Parse JSON body
    let parsedData;
    try {
      parsedData = JSON.parse(requestBody);
    } catch (jsonError) {
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
    
    // Extract token from request
    const { token } = parsedData;
    if (!token) {
      return new Response(JSON.stringify({
        error: "Missing token in request"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    console.log("Verifying reCAPTCHA token with Google API");
    
    // Verify token with Google reCAPTCHA API
    const verificationURL = "https://www.google.com/recaptcha/api/siteverify";
    const formData = new URLSearchParams();
    formData.append("secret", RECAPTCHA_SECRET_KEY);
    formData.append("response", token);
    
    const response = await fetch(verificationURL, {
      method: "POST",
      body: formData
    });
    
    const verification = await response.json();
    console.log("Google verification response:", JSON.stringify(verification));
    
    // For reCAPTCHA v3, we need to check both success and score
    if (verification.success) {
      console.log("CAPTCHA verification successful");
      
      // For reCAPTCHA v3, check the score (0.0 to 1.0, where 1.0 is very likely a human)
      if (verification.score !== undefined) {
        console.log("reCAPTCHA v3 score:", verification.score);
        
        // You can adjust this threshold based on your risk tolerance
        const scoreThreshold = 0.5;
        
        if (verification.score >= scoreThreshold) {
          return new Response(JSON.stringify({
            success: true,
            message: "CAPTCHA verification successful",
            score: verification.score
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        } else {
          console.log("CAPTCHA score too low:", verification.score);
          return new Response(JSON.stringify({
            success: false,
            error: "CAPTCHA score too low",
            score: verification.score
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      } else {
        // For reCAPTCHA v2, we just check success
        return new Response(JSON.stringify({
          success: true,
          message: "CAPTCHA verification successful"
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    } else {
      console.log("CAPTCHA verification failed:", verification["error-codes"]);
      return new Response(JSON.stringify({
        success: false,
        error: "CAPTCHA verification failed",
        details: verification["error-codes"] || []
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  } catch (error) {
    console.error("❌ Error in CAPTCHA verification function:", error);
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