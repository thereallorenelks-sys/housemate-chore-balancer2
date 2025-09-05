import React, { useMemo, useState, useEffect } from "react";

/**
 * Housemate Chore Balancer — v1
 * Patch: CRLF newlines for Outlook + per-person buttons + CRLF in .txt download
 */

// ... keep rest of your existing code unchanged ...

// Example patch points:
function buildEmailBody(personName, widx) {
  // ... build lines ...
  return lines.join("\r\n"); // CRLF for Outlook
}

function downloadWeeklyEmailsTxt() {
  const widx = getCurrentWeekIndex();
  const lines = [];
  for (const o of peopleObjs) {
    lines.push(`# ${o.name}${o.email ? ' <' + o.email + '>' : ''}`);
    lines.push(buildEmailBody(o.name, widx));
    lines.push("");
  }
  downloadText('weekly_chore_emails.txt', lines.join("\r\n")); // CRLF here too
}

// ... rest of your JSX and logic remains unchanged ...
