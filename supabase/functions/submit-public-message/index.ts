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

class PublicFormError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function text(value: unknown, maximum: number, required = false): string | null {
  if (typeof value !== "string") {
    if (required) throw new PublicFormError("Please complete all required fields.", 400);
    return null;
  }
  const result = value.trim();
  if (required && !result) throw new PublicFormError("Please complete all required fields.", 400);
  if (result.length > maximum) throw new PublicFormError("One or more fields are too long.", 400);
  return result || null;
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

async function verifyTurnstile(token: string, remoteIp: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) throw new PublicFormError("Secure enquiry forms are not configured. Please contact the school directly.", 503);
  if (!token || token.length > 2048) throw new PublicFormError("Complete the security check and try again.", 400);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    }),
  });
  if (!response.ok) throw new PublicFormError("The security check is temporarily unavailable.", 503);
  const verification = await response.json();
  const expectedHostname = Deno.env.get("TURNSTILE_HOSTNAME");
  if (!verification.success || (expectedHostname && verification.hostname !== expectedHostname)) {
    throw new PublicFormError("The security check expired or could not be verified. Please try again.", 400);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });

  const expectedOrigin = Deno.env.get("PUBLIC_SITE_ORIGIN");
  const origin = request.headers.get("origin");
  if (!expectedOrigin) return jsonResponse(503, { error: "Secure enquiry forms are not configured. Please contact the school directly." });
  if (expectedOrigin && origin !== expectedOrigin) return jsonResponse(403, { error: "This website is not allowed to submit enquiries." });
  if (!Deno.env.get("TURNSTILE_SECRET_KEY") || !Deno.env.get("TURNSTILE_HOSTNAME")) {
    return jsonResponse(503, { error: "Secure enquiry forms are not configured. Please contact the school directly." });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(400, { error: "Invalid enquiry." });
    }

    const honeypot = text(body.website, 200);
    if (honeypot) return jsonResponse(200, { success: true });

    await verifyTurnstile(text(body.captchaToken, 2048, true)!, request.headers.get("cf-connecting-ip"));
    const kind = text(body.kind, 20, true)!;
    if (!["admission", "contact", "visit", "newsletter"].includes(kind)) {
      return jsonResponse(400, { error: "Invalid enquiry type." });
    }

    const name = kind === "newsletter"
      ? "Newsletter subscriber"
      : text(body.name, 120, true)!;
    const email = text(body.email, 254, true)!;
    if (!validEmail(email)) return jsonResponse(400, { error: "Enter a valid email address." });

    const phone = text(body.phone, 40);
    const studentName = text(body.studentName, 120);
    const grade = text(body.grade, 60);
    const department = text(body.department, 80);
    const subject = text(body.subject, 160);
    const message = text(body.message, 3000);
    const preferredVisitDate = text(body.preferredVisitDate, 10);
    if (kind === "admission" && (!phone || !studentName || !grade)) {
      return jsonResponse(400, { error: "Include a contact number, learner name and requested grade." });
    }
    const visitDate = preferredVisitDate ? new Date(`${preferredVisitDate}T00:00:00.000Z`) : null;
    const validVisitDate = Boolean(visitDate && !Number.isNaN(visitDate.getTime())
      && visitDate.toISOString().slice(0, 10) === preferredVisitDate);
    if (kind === "visit" && (!phone || !preferredVisitDate || !validVisitDate)) {
      return jsonResponse(400, { error: "Include a contact number and a valid preferred visit date." });
    }
    if (kind === "contact" && !message) return jsonResponse(400, { error: "Please include your message." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server environment configuration.");
      return jsonResponse(503, { error: "The school enquiry service is temporarily unavailable." });
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    if (kind === "admission") {
      const { data: settings, error: settingsError } = await db
        .from("site_settings")
        .select("admissions_open")
        .eq("id", 1)
        .maybeSingle();
      if (settingsError) {
        console.error("Could not verify whether admissions are open.", settingsError.message);
        return jsonResponse(500, { error: "The school could not verify the admissions status." });
      }
      if (!settings?.admissions_open) {
        return jsonResponse(403, { error: "Online admissions are currently closed. Please contact the school office." });
      }
    }

    const { error } = await db.from("public_submissions").insert({
      kind,
      name,
      email,
      phone,
      student_name: studentName,
      grade,
      department,
      subject,
      message,
      preferred_visit_date: preferredVisitDate,
    });
    if (error) {
      console.error("Could not save public school enquiry.", error.message);
      return jsonResponse(500, { error: "The school could not save your message. Please try again." });
    }

    const inboxEmail = Deno.env.get("SCHOOL_INBOX_EMAIL");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("SCHOOL_FROM_EMAIL");
    if (inboxEmail && resendKey && fromEmail) {
      const schoolName = Deno.env.get("SCHOOL_NAME") || "The Little Harvard Academy";
      const label = kind === "admission" ? "New admission enquiry"
        : kind === "visit" ? "New campus visit request"
          : kind === "newsletter" ? "New newsletter subscriber" : "New contact message";
      const details = [
        `Name: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : "",
        studentName ? `Learner: ${studentName}` : "",
        grade ? `Grade: ${grade}` : "",
        department ? `Department: ${department}` : "",
        subject ? `Subject: ${subject}` : "",
        preferredVisitDate ? `Preferred visit date: ${preferredVisitDate}` : "",
        message ? `Message:\n${message}` : "",
      ].filter(Boolean).join("\n\n");
      try {
        const notification = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${schoolName} <${fromEmail}>`,
            to: [inboxEmail],
            reply_to: email,
            subject: `${label} — ${name}`,
            text: details,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(details)}</div>`,
          }),
        });
        if (!notification.ok) console.error("The enquiry was saved, but the school email notification failed.", notification.status, await notification.text());
      } catch (notificationError) {
        console.error("The enquiry was saved, but the school email notification could not be sent.", notificationError);
      }
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    if (error instanceof PublicFormError) return jsonResponse(error.status, { error: error.message });
    if (error instanceof SyntaxError) return jsonResponse(400, { error: "The enquiry form data is invalid." });
    const message = error instanceof Error ? error.message : "The enquiry could not be submitted.";
    console.error("Could not process public school enquiry.", message);
    return jsonResponse(500, { error: "The enquiry could not be submitted. Please try again." });
  }
});
