// Supabase Edge Function: send-walkin-reminders
// Deploy with: supabase functions deploy send-walkin-reminders
// Trigger: Supabase CRON scheduler or pg_cron — run daily (e.g., 08:00 UTC)
//
// Required Supabase Secrets:
//   RESEND_API_KEY  — your Resend API key
//   EMAIL_FROM      — verified sender email (e.g., "JobTrack <noreply@yourdomain.com>")

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';

serve(async (_req) => {
  try {
    // Service-role client (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'JobTrack <noreply@jobtrack.app>';

    // Get today's date and tomorrow's date
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Find walk-ins scheduled for tomorrow where:
    // - reminder_enabled = true
    // - email_reminder = true
    // - reminder_sent = false
    // - reminder_days_before = 1 (default)
    const { data: walkins, error: walkinErr } = await supabase
      .from('walkin_drives')
      .select(`
        id,
        user_id,
        company,
        job_title,
        date,
        start_time,
        end_time,
        location,
        address,
        registration_url,
        notes,
        resume:resumes(name, version)
      `)
      .eq('date', tomorrowStr)
      .eq('reminder_enabled', true)
      .eq('email_reminder', true)
      .eq('reminder_sent', false);

    if (walkinErr) {
      console.error('Error fetching walkins:', walkinErr);
      return new Response(JSON.stringify({ error: walkinErr.message }), { status: 500 });
    }

    if (!walkins || walkins.length === 0) {
      return new Response(JSON.stringify({ message: 'No reminders to send.', sent: 0 }), { status: 200 });
    }

    let totalSent = 0;
    const results: { walkin_id: string; status: string }[] = [];

    for (const walkin of walkins) {
      // Get enabled notification emails for this user
      const { data: emailRecipients } = await supabase
        .from('notification_emails')
        .select('email, name')
        .eq('user_id', walkin.user_id)
        .eq('enabled', true);

      if (!emailRecipients || emailRecipients.length === 0) {
        results.push({ walkin_id: walkin.id, status: 'skipped_no_emails' });
        continue;
      }

      const resumeLabel = walkin.resume
        ? `${(walkin.resume as { name: string; version: string }).name} ${(walkin.resume as { name: string; version: string }).version}`
        : 'Not specified';

      const formattedDate = new Date(walkin.date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const timeRange = walkin.start_time
        ? `${walkin.start_time}${walkin.end_time ? ` – ${walkin.end_time}` : ''}`
        : 'Time not specified';

      const subject = `🚨 Walk-in Tomorrow – ${walkin.company} – ${walkin.job_title}`;

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Walk-in Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">🚨 Walk-in Drive Tomorrow!</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Your JobTrack reminder</p>
    </div>
    <div style="padding: 28px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px; width: 120px;">Company</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #111; font-size: 14px; font-weight: 600;">${walkin.company}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px;">Role</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #111; font-size: 14px; font-weight: 600;">${walkin.job_title}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px;">Date</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #111; font-size: 14px;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px;">Time</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #111; font-size: 14px;">${timeRange}</td>
        </tr>
        ${walkin.location ? `<tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px;">Location</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #111; font-size: 14px;">${walkin.location}</td>
        </tr>` : ''}
        ${walkin.address ? `<tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px;">Address</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #111; font-size: 14px;">${walkin.address}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px;">Resume</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #111; font-size: 14px;">${resumeLabel}</td>
        </tr>
        ${walkin.registration_url ? `<tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px;">Registration</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px;"><a href="${walkin.registration_url}" style="color: #4f46e5;">Open Registration Link</a></td>
        </tr>` : ''}
        ${walkin.notes ? `<tr>
          <td style="padding: 10px 0; color: #666; font-size: 13px; vertical-align: top;">Notes</td>
          <td style="padding: 10px 0; color: #111; font-size: 14px;">${walkin.notes}</td>
        </tr>` : ''}
      </table>
      <div style="margin-top: 24px; padding: 16px; background: #fef9c3; border-radius: 8px; border: 1px solid #fde68a;">
        <p style="margin: 0; color: #78350f; font-size: 13px; font-weight: 600;">📋 Don't forget:</p>
        <ul style="margin: 8px 0 0; padding-left: 20px; color: #92400e; font-size: 13px;">
          <li>Print your resume</li>
          <li>Carry original ID proof</li>
          <li>Check the venue location in advance</li>
        </ul>
      </div>
      <p style="margin-top: 24px; color: #666; font-size: 13px; text-align: center;">Good luck! 🍀 — JobTrack</p>
    </div>
  </div>
</body>
</html>`;

      const toEmails = emailRecipients.map((r) => r.email);

      const resendRes = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: toEmails,
          subject,
          html: htmlBody,
        }),
      });

      if (resendRes.ok) {
        // Mark reminder as sent to prevent duplicate emails
        await supabase
          .from('walkin_drives')
          .update({ reminder_sent: true })
          .eq('id', walkin.id);

        totalSent += toEmails.length;
        results.push({ walkin_id: walkin.id, status: `sent_to_${toEmails.length}_recipients` });
      } else {
        const errText = await resendRes.text();
        console.error(`Resend error for walkin ${walkin.id}:`, errText);
        results.push({ walkin_id: walkin.id, status: 'email_send_failed' });
      }
    }

    return new Response(
      JSON.stringify({ message: 'Reminder job completed', sent: totalSent, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
