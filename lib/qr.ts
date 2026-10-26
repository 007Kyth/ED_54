export type QRPayload = {
  v: 1;
  event: string;
  title?: string;
  start?: string;
  end?: string;
};

export function buildQRPayload(event: {
  eventId: string;
  title: string;
  start?: string;
  end?: string;
}): string {
  const payload: QRPayload = {
    v: 1,
    event: event.eventId,
  };

  if (event.title) payload.title = event.title;
  if (event.start) payload.start = event.start;
  if (event.end) payload.end = event.end;

  return JSON.stringify(payload);
}

export type ParseQRResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; message: string };

export function parseQRPayload(raw: string): ParseQRResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Invalid QR code.' };
  }

  if (parsed.v !== 1 || typeof parsed.event !== 'string' || !parsed.event) {
    return { ok: false, message: 'Not an attendance QR code.' };
  }

  return { ok: true, payload: parsed as QRPayload };
}

// ---------------------------------------------------------------------------
// PERSONAL QR (shown on a Student's / Teacher's Profile, scanned by an Admin)
// It carries the person's secret qr_token (from the profiles table), NOT their
// user id. This is a different shape from the event QR above, so they never mix.
// ---------------------------------------------------------------------------
export type PersonalQRPayload = {
  t: 'person';
  v: 1;
  tok: string; // profiles.qr_token
};

export function buildPersonalQRPayload(qrToken: string): string {
  const payload: PersonalQRPayload = { t: 'person', v: 1, tok: qrToken };
  return JSON.stringify(payload);
}

export type ParsePersonalQRResult =
  | { ok: true; token: string }
  | { ok: false; message: string };

export function parsePersonalQRPayload(raw: string): ParsePersonalQRResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Invalid QR code.' };
  }
  if (parsed?.t !== 'person' || parsed.v !== 1 || typeof parsed.tok !== 'string' || !parsed.tok) {
    return { ok: false, message: 'This is not a personal QR code.' };
  }
  return { ok: true, token: parsed.tok };
}
