import { AUTH_EXPIRY_LABELS } from '@/lib/auth/constants';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function verificationEmail(params: {
  name: string;
  verifyUrl: string;
}): EmailTemplate {
  const { name, verifyUrl } = params;

  return {
    subject: 'Verify your email — HackForge',
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Verify your email address
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        Hi ${escapeHtml(name)},<br><br>
        Thanks for signing up for HackForge! Please verify your email address by clicking the button below.
      </p>
      ${ctaButton('Verify Email', verifyUrl)}
      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 24px 0 0;">
        This link expires in ${AUTH_EXPIRY_LABELS.emailVerification}. If you didn't create an account, you can safely ignore this email.
      </p>
      <p style="font-size: 13px; color: #999; line-height: 1.6; margin: 16px 0 0;">
        If the button doesn't work, copy and paste this URL into your browser:<br>
        <a href="${escapeHtml(verifyUrl)}" style="color: #666; word-break: break-all;">${escapeHtml(verifyUrl)}</a>
      </p>
    `),
    text: [
      `Hi ${name},`,
      '',
      'Thanks for signing up for HackForge! Please verify your email address by visiting the link below:',
      '',
      verifyUrl,
      '',
      `This link expires in ${AUTH_EXPIRY_LABELS.emailVerification}. If you didn't create an account, you can safely ignore this email.`,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function passwordResetEmail(params: {
  name: string;
  resetUrl: string;
}): EmailTemplate {
  const { name, resetUrl } = params;

  return {
    subject: 'Reset your password — HackForge',
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Reset your password
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        Hi ${escapeHtml(name)},<br><br>
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      ${ctaButton('Reset Password', resetUrl)}
      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 24px 0 0;">
        This link expires in ${AUTH_EXPIRY_LABELS.passwordReset}. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
      </p>
      <p style="font-size: 13px; color: #999; line-height: 1.6; margin: 16px 0 0;">
        If the button doesn't work, copy and paste this URL into your browser:<br>
        <a href="${escapeHtml(resetUrl)}" style="color: #666; word-break: break-all;">${escapeHtml(resetUrl)}</a>
      </p>
    `),
    text: [
      `Hi ${name},`,
      '',
      'We received a request to reset your password. Visit the link below to choose a new one:',
      '',
      resetUrl,
      '',
      `This link expires in ${AUTH_EXPIRY_LABELS.passwordReset}. If you didn't request a password reset, you can safely ignore this email.`,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function orgInviteEmail(params: {
  inviterName: string;
  orgName: string;
  role: string;
  acceptUrl: string;
}): EmailTemplate {
  const { inviterName, orgName, role, acceptUrl } = params;
  const roleLabel = role === 'org_admin' ? 'Admin' : 'Member';

  return {
    subject: `You're invited to join ${orgName} on HackForge`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        You've been invited to ${escapeHtml(orgName)}
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 8px;">
        Hi there,
      </p>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        ${escapeHtml(inviterName)} has invited you to join <strong>${escapeHtml(orgName)}</strong> as a <strong>${escapeHtml(roleLabel)}</strong> on HackForge.
      </p>
      ${ctaButton('Accept Invitation', acceptUrl)}
      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 24px 0 0;">
        This invitation expires in ${AUTH_EXPIRY_LABELS.orgInvite}. If you don't have a HackForge account yet, you'll be able to create one when you accept.
      </p>
      <p style="font-size: 13px; color: #999; line-height: 1.6; margin: 16px 0 0;">
        If the button doesn't work, copy and paste this URL into your browser:<br>
        <a href="${escapeHtml(acceptUrl)}" style="color: #666; word-break: break-all;">${escapeHtml(acceptUrl)}</a>
      </p>
    `),
    text: [
      'Hi there,',
      '',
      `${inviterName} has invited you to join ${orgName} as a ${roleLabel} on HackForge.`,
      '',
      'Accept the invitation by visiting the link below:',
      '',
      acceptUrl,
      '',
      `This invitation expires in ${AUTH_EXPIRY_LABELS.orgInvite}. If you don't have a HackForge account yet, you'll be able to create one when you accept.`,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Phase 3 — Teams
// ---------------------------------------------------------------------------

export function teamDisbandedAdminEmail(params: {
  adminName: string;
  teamName: string;
  hackathonTitle: string;
  reason: string;
}): EmailTemplate {
  return {
    subject: `[FYI] Team "${params.teamName}" has been disbanded`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Team disbanded
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 16px;">
        Hi ${escapeHtml(params.adminName)},
      </p>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 16px;">
        The team <strong>${escapeHtml(params.teamName)}</strong> in <strong>${escapeHtml(params.hackathonTitle)}</strong> has been disbanded.
      </p>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 16px;">
        <strong>Reason:</strong> ${escapeHtml(params.reason)}
      </p>
      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0;">
        All former members retain their registrations and will reappear on the participants browse page.
      </p>
    `),
    text: [
      `Hi ${params.adminName},`,
      '',
      `The team "${params.teamName}" in ${params.hackathonTitle} has been disbanded.`,
      '',
      `Reason: ${params.reason}`,
      '',
      'All former members retain their registrations and will reappear on the participants browse page.',
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function registrationConfirmedEmail(params: {
  name: string;
  hackathonTitle: string;
  hackathonSlug: string;
  appUrl: string;
}): EmailTemplate {
  const landingUrl = `${params.appUrl}/hackathons/${params.hackathonSlug}`;
  return {
    subject: `You're registered for ${params.hackathonTitle}!`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        You're in, ${escapeHtml(params.name)}!
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        Your registration for <strong>${escapeHtml(params.hackathonTitle)}</strong> is confirmed. Next step: find or create your team.
      </p>
      ${ctaButton('Browse Teams', landingUrl)}
    `),
    text: [
      `Hi ${params.name},`,
      '',
      `Your registration for ${params.hackathonTitle} is confirmed!`,
      '',
      'Next step: find or create your team.',
      '',
      landingUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamCreatedPendingReviewEmail(params: {
  leadName: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): EmailTemplate {
  return {
    subject: `Your team "${params.teamName}" is under review`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Almost there, ${escapeHtml(params.leadName)}!
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        Your team <strong>${escapeHtml(params.teamName)}</strong> for <strong>${escapeHtml(params.hackathonTitle)}</strong> has been submitted for organiser review. You'll receive an email once it's approved.
      </p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
    text: [
      `Hi ${params.leadName},`,
      '',
      `Your team "${params.teamName}" for ${params.hackathonTitle} has been submitted for organiser review.`,
      '',
      "You'll receive an email once it's approved.",
      '',
      params.teamUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamApprovedEmail(params: {
  memberName: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): EmailTemplate {
  return {
    subject: `Your team "${params.teamName}" has been approved`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        You're officially in, ${escapeHtml(params.memberName)}!
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        Your team <strong>${escapeHtml(params.teamName)}</strong> has been approved for <strong>${escapeHtml(params.hackathonTitle)}</strong>.
      </p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
    text: [
      `Hi ${params.memberName},`,
      '',
      `Your team "${params.teamName}" has been approved for ${params.hackathonTitle}.`,
      '',
      params.teamUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamRejectedEmail(params: {
  leadName: string;
  teamName: string;
  hackathonTitle: string;
  organizerEmail: string;
}): EmailTemplate {
  return {
    subject: `Update on your team "${params.teamName}"`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Hi ${escapeHtml(params.leadName)},
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 16px;">
        Unfortunately, your team <strong>${escapeHtml(params.teamName)}</strong> was not approved for <strong>${escapeHtml(params.hackathonTitle)}</strong>.
      </p>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0;">
        Please contact the organiser at <a href="mailto:${escapeHtml(params.organizerEmail)}" style="color: #111;">${escapeHtml(params.organizerEmail)}</a> for more information.
      </p>
    `),
    text: [
      `Hi ${params.leadName},`,
      '',
      `Unfortunately, your team "${params.teamName}" was not approved for ${params.hackathonTitle}.`,
      '',
      `Please contact the organiser at ${params.organizerEmail} for more information.`,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamPendingReReviewEmail(params: {
  teamName: string;
  hackathonTitle: string;
  reviewReason: string;
  teamAdminUrl: string;
}): EmailTemplate {
  return {
    subject: `[Action Required] Team "${params.teamName}" needs re-approval`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        A team requires your review
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 16px;">
        The team <strong>${escapeHtml(params.teamName)}</strong> in <strong>${escapeHtml(params.hackathonTitle)}</strong> has been updated and requires re-approval.
      </p>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        <strong>Reason:</strong> ${escapeHtml(params.reviewReason)}
      </p>
      ${ctaButton('Review Team', params.teamAdminUrl)}
    `),
    text: [
      `The team "${params.teamName}" in ${params.hackathonTitle} has been updated and requires re-approval.`,
      '',
      `Reason: ${params.reviewReason}`,
      '',
      params.teamAdminUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamInviteExistingUserEmail(params: {
  name: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): EmailTemplate {
  return {
    subject: `You've been added to team "${params.teamName}"`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Welcome to the team, ${escapeHtml(params.name)}!
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        You've been added to <strong>${escapeHtml(params.teamName)}</strong> for <strong>${escapeHtml(params.hackathonTitle)}</strong>. You can leave the team from your team page if you'd like.
      </p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
    text: [
      `Hi ${params.name},`,
      '',
      `You've been added to "${params.teamName}" for ${params.hackathonTitle}.`,
      '',
      "You can leave the team from your team page if you'd like.",
      '',
      params.teamUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamInviteNewUserEmail(params: {
  teamName: string;
  hackathonTitle: string;
  acceptUrl: string;
}): EmailTemplate {
  return {
    subject: `You've been invited to join "${params.teamName}"`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        You're invited!
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        You've been invited to join <strong>${escapeHtml(params.teamName)}</strong> for <strong>${escapeHtml(params.hackathonTitle)}</strong>. Create your account to accept the invitation and start participating.
      </p>
      ${ctaButton('Accept Invitation', params.acceptUrl)}
      <p style="font-size: 13px; color: #999; line-height: 1.6; margin: 16px 0 0;">
        This invitation expires in 7 days.
      </p>
    `),
    text: [
      `You've been invited to join "${params.teamName}" for ${params.hackathonTitle}.`,
      '',
      'Create your account to accept the invitation and start participating.',
      '',
      params.acceptUrl,
      '',
      'This invitation expires in 7 days.',
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function joinRequestAcceptedEmail(params: {
  name: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): EmailTemplate {
  return {
    subject: `Your request to join "${params.teamName}" was accepted`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        You're on the team, ${escapeHtml(params.name)}!
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        Your request to join <strong>${escapeHtml(params.teamName)}</strong> for <strong>${escapeHtml(params.hackathonTitle)}</strong> has been accepted.
      </p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
    text: [
      `Hi ${params.name},`,
      '',
      `Your request to join "${params.teamName}" for ${params.hackathonTitle} has been accepted.`,
      '',
      params.teamUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function joinRequestRejectedEmail(params: {
  name: string;
  teamName: string;
  hackathonTitle: string;
  browseUrl: string;
}): EmailTemplate {
  return {
    subject: `Update on your request to join "${params.teamName}"`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Hi ${escapeHtml(params.name)},
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        Your request to join <strong>${escapeHtml(params.teamName)}</strong> was not accepted. There are other great teams looking for members — keep exploring!
      </p>
      ${ctaButton('Browse Teams', params.browseUrl)}
    `),
    text: [
      `Hi ${params.name},`,
      '',
      `Your request to join "${params.teamName}" was not accepted.`,
      '',
      'There are other great teams looking for members — keep exploring!',
      '',
      params.browseUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamUpRequestEmail(params: {
  recipientName: string;
  requesterName: string;
  proposedTeamName: string;
  hackathonTitle: string;
  message: string | null;
  respondUrl: string;
}): EmailTemplate {
  return {
    subject: `${params.requesterName} wants to team up with you`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        You've got a team-up request, ${escapeHtml(params.recipientName)}!
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 16px;">
        <strong>${escapeHtml(params.requesterName)}</strong> wants to form a team with you for <strong>${escapeHtml(params.hackathonTitle)}</strong>.
      </p>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 ${params.message ? '16px' : '24px'};">
        <strong>Proposed team name:</strong> ${escapeHtml(params.proposedTeamName)}
      </p>
      ${params.message ? `<p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;"><strong>Message:</strong> ${escapeHtml(params.message)}</p>` : ''}
      ${ctaButton('Respond to Request', params.respondUrl)}
    `),
    text: [
      `Hi ${params.recipientName},`,
      '',
      `${params.requesterName} wants to form a team with you for ${params.hackathonTitle}.`,
      '',
      `Proposed team name: ${params.proposedTeamName}`,
      ...(params.message ? ['', `Message: ${params.message}`] : []),
      '',
      'Log in to accept or decline the request:',
      '',
      params.respondUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamUpAcceptedEmail(params: {
  requesterName: string;
  accepteeName: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): EmailTemplate {
  return {
    subject: `${params.accepteeName} accepted your team-up request`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Your team is ready, ${escapeHtml(params.requesterName)}!
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        <strong>${escapeHtml(params.accepteeName)}</strong> has accepted your team-up request for <strong>${escapeHtml(params.hackathonTitle)}</strong>. Your team <strong>${escapeHtml(params.teamName)}</strong> has been created with you as the lead.
      </p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
    text: [
      `Hi ${params.requesterName},`,
      '',
      `${params.accepteeName} has accepted your team-up request for ${params.hackathonTitle}.`,
      '',
      `Your team "${params.teamName}" has been created with you as the lead.`,
      '',
      params.teamUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

export function teamUpDeclinedEmail(params: {
  requesterName: string;
  declineeName: string;
  proposedTeamName: string;
  hackathonTitle: string;
  browseUrl: string;
}): EmailTemplate {
  return {
    subject: `Update on your team-up request`,
    html: emailLayout(`
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 16px;">
        Hi ${escapeHtml(params.requesterName)},
      </h1>
      <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">
        <strong>${escapeHtml(params.declineeName)}</strong> was unable to join your proposed team <strong>${escapeHtml(params.proposedTeamName)}</strong> for <strong>${escapeHtml(params.hackathonTitle)}</strong> at this time. There are other participants looking for teammates — keep browsing!
      </p>
      ${ctaButton('Browse Participants', params.browseUrl)}
    `),
    text: [
      `Hi ${params.requesterName},`,
      '',
      `${params.declineeName} was unable to join your proposed team "${params.proposedTeamName}" for ${params.hackathonTitle} at this time.`,
      '',
      'There are other participants looking for teammates — keep browsing!',
      '',
      params.browseUrl,
      '',
      '— HackForge',
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function emailLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HackForge</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <p style="font-size: 18px; font-weight: 700; color: #111; margin: 0 0 24px; letter-spacing: -0.02em;">
                HackForge
              </p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e4e4e7;">
              <p style="font-size: 12px; color: #a1a1aa; margin: 0; line-height: 1.5;">
                This email was sent by HackForge. If you have questions, reply to this email or contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function ctaButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #111;">
          <a href="${escapeHtml(url)}" target="_blank" style="display: inline-block; padding: 12px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
