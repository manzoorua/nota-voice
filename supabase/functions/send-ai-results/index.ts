import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  email: string;
  result: {
    content: string;
    type: 'summary' | 'translation' | 'enhancement';
    labels?: string[];
    timestamp: string;
    metadata?: any;
  };
  userFullName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, result, userFullName }: EmailRequest = await req.json();

    if (!email || !result) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Format the result type for display
    const formatType = (type: string) => {
      return type.charAt(0).toUpperCase() + type.slice(1);
    };

    // Format labels for display
    const labelsHtml = result.labels && result.labels.length > 0 
      ? `
        <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
          <h3 style="color: #495057; margin: 0 0 10px 0; font-size: 16px;">Labels:</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${result.labels.map(label => 
              `<span style="background-color: #e9ecef; color: #495057; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${label}</span>`
            ).join('')}
          </div>
        </div>
      `
      : '';

    // Get appropriate emoji for result type
    const getTypeEmoji = (type: string) => {
      switch (type) {
        case 'summary': return '📄';
        case 'translation': return '🌐';
        case 'enhancement': return '✨';
        default: return '🤖';
      }
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your AI Result - NotaVoice</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e9ecef;">
          <h1 style="color: #2563eb; margin: 0; font-size: 28px;">
            ${getTypeEmoji(result.type)} NotaVoice AI Result
          </h1>
          <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">
            Your ${formatType(result.type)} Result
          </p>
        </div>

        <!-- Greeting -->
        <div style="margin-bottom: 25px;">
          <p style="font-size: 16px; margin: 0;">
            Hi ${userFullName},
          </p>
          <p style="font-size: 16px; margin: 10px 0 0 0;">
            Here's your AI-generated ${result.type} result from NotaVoice:
          </p>
        </div>

        <!-- Result Info -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <span style="background-color: #e3f2fd; color: #1976d2; padding: 6px 12px; border-radius: 16px; font-size: 14px; font-weight: 500;">
              ${getTypeEmoji(result.type)} ${formatType(result.type)}
            </span>
            <span style="color: #6b7280; font-size: 14px;">
              ${new Date(result.timestamp).toLocaleString()}
            </span>
          </div>
        </div>

        ${labelsHtml}

        <!-- Content -->
        <div style="background-color: #ffffff; border: 1px solid #e9ecef; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
          <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 18px;">Content:</h3>
          <div style="white-space: pre-wrap; font-size: 15px; line-height: 1.7; color: #333;">
${result.content}
          </div>
        </div>

        <!-- Actions -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 16px;">What's next?</h3>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
            <li style="margin-bottom: 8px;">Copy and paste this content where you need it</li>
            <li style="margin-bottom: 8px;">Use the labels to organize your content for social media</li>
            <li style="margin-bottom: 8px;">Return to NotaVoice to generate more AI results</li>
          </ul>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6b7280; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            This email was sent from <strong>NotaVoice</strong> - Your AI-powered voice note assistant
          </p>
          <p style="margin: 0;">
            Keep creating amazing content! 🚀
          </p>
        </div>

      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "NotaVoice <noreply@lovable.app>",
      to: [email],
      subject: `${getTypeEmoji(result.type)} Your ${formatType(result.type)} Result from NotaVoice`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email sent successfully",
      emailId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-ai-results function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Failed to send AI result email"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);