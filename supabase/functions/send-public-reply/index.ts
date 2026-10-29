import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("PUBLIC_SITE_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });

  const expectedOrigin = Deno.env.get("PUBLIC_SITE_ORIGIN");
  const origin = request.headers.get("origin");
  if (!expectedOrigin) return jsonResponse(503, { error: "School email replies are not configured yet." });
  if (expectedOrigin && origin !== expectedOrigin) return jsonResponse(403, { error: "This website is not allowed to send replies." });

  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token || token === authorization) return jsonResponse(401, { error: "Staff sign-in is required." });

    const body = await request.json();
    const submissionId = typeof body?.submissionId === "string" ? body.submissionId : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
      return jsonResponse(400, { error: "Select a valid enquiry before replying." });
    }
    if (message.length < 2 || message.length > 5000) return jsonResponse(400, { error: "Replies must be between 2 and 5,000 characters." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("SCHOOL_FROM_EMAIL");
    const replyTo = Deno.env.get("SCHOOL_REPLY_TO") || fromEmail;
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendKey || !fromEmail) {
      console.error("Missing Supabase or email-provider server environment configuration.");
      return jsonResponse(503, { error: "School email replies are not configured yet." });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse(401, { error: "Your staff session has expired. Sign in again." });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: roleRecord, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (roleError) {
      console.error("Could not verify staff role.", roleError.message);
      return jsonResponse(500, { error: "The school could not verify your staff permissions." });
    }
    if (!roleRecord) return jsonResponse(403, { error: "Your account has no school staff role." });

    const { data: submission, error: submissionError } = await adminClient
      .from("public_submissions")
      .select("id, kind, name, email")
      .eq("id", submissionId)
      .maybeSingle();
    if (submissionError) {
      console.error("Could not load reply recipient.", submissionError.message);
      return jsonResponse(500, { error: "The school could not load this enquiry." });
    }
    if (!submission) return jsonResponse(404, { error: "This enquiry no longer exists." });

    const permissions: Record<string, string[]> = {
      admin: ["admission", "contact", "visit", "newsletter"],
      admissions: ["admission", "visit"],
      communications: ["contact", "visit", "newsletter"],
    };
    if (!permissions[roleRecord.role]?.includes(submission.kind)) {
      return jsonResponse(403, { error: "Your role cannot reply to this type of enquiry." });
    }

    const schoolName = Deno.env.get("SCHOOL_NAME") || "The Little Harvard Academy";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${schoolName} <${fromEmail}>`,
        to: [submission.email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: `A message from ${schoolName}`,
        text: `${message}\n\n${schoolName}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</div><p>${escapeHtml(schoolName)}</p>`,
      }),
    });
    if (!response.ok) {
      console.error("Email provider rejected school reply.", response.status, await response.text());
      return jsonResponse(502, { error: "The email could not be delivered. Please try again shortly." });
    }

    const repliedAt = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("public_submissions")
      .update({ reply: message, replied_at: repliedAt, status: "Handled", handled_by: userData.user.id })
      .eq("id", submissionId);
    if (updateError) {
      console.error("Reply was sent but its delivery record could not be updated.", updateError.message);
      return jsonResponse(500, { error: "The email was sent, but the school could not record the reply. Refresh the inbox before sending again." });
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error("Could not send school reply.", error);
    return jsonResponse(500, { error: "The school reply could not be sent." });
  }
});
