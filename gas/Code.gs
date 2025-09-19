const SHEET_NAMES = {
  seasons: 'Seasons',
  teams: 'Teams',
  members: 'Members',
  sessions: 'Sessions',
  meetings: 'Meetings',
  lookups: 'Lookups',
};

const STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  PENDING: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const SESSION_TYPES = {
  IN_PERSON: 'in_person',
  OFFLINE: 'offline',
};

const SOURCES = {
  KIOSK: 'kiosk',
  HOME: 'home',
};

const SCRIPT_PROPS = PropertiesService.getScriptProperties();

function doPost(e) {
  try {
    const origin = (e?.headers?.origin || '').toString();
    const allowedOrigins = (SCRIPT_PROPS.getProperty('ALLOWED_ORIGINS') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (allowedOrigins.length && origin && !allowedOrigins.includes(origin)) {
      return respondError('Origin not allowed', 403);
    }

    const path = (e?.pathInfo || '').replace(/^\/+|\/+$/g, '');
    const body = e?.postData?.contents ? JSON.parse(e.postData.contents) : {};
    body._userEmail = Session.getActiveUser().getEmail();
    body._origin = origin;
    body._userAgent = e?.headers?.['user-agent'] || '';
    body._ip = e?.parameter?.['x-forwarded-for'] || '';

    switch (path) {
      case 'api/roster.list':
        return respondOk(handleRosterList(body));
      case 'api/status.now':
        return respondOk(handleStatusNow(body));
      case 'api/session.toggle':
        return respondOk(handleSessionToggle(body));
      case 'api/offline.submit':
        return respondOk(handleOfflineSubmit(body));
      case 'api/offline.review':
        requireAdmin(body._userEmail);
        return respondOk(handleOfflineReview(body));
      case 'api/admin.clockout_all':
        requireAdmin(body._userEmail);
        return respondOk(handleClockoutAll(body));
      case 'api/admin.import_members':
        requireAdmin(body._userEmail);
        return respondOk(handleImportMembers(body));
      case 'api/offline.history':
        return respondOk(handleOfflineHistory(body));
      default:
        return respondError(`Unsupported path: ${path}`, 404);
    }
  } catch (error) {
    return respondError(error.message, 500);
  }
}

function requireAdmin(email) {
  const admins = (SCRIPT_PROPS.getProperty('ADMIN_EMAILS') || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !admins.includes(email.toLowerCase())) {
    throw new Error('Admin privileges required');
  }
}

function respondOk(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, data }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function respondError(message, status) {
  const output = ContentService.createTextOutput(
    JSON.stringify({ ok: false, error: message }),
  ).setMimeType(ContentService.MimeType.JSON);
  if (typeof output.setResponseCode === 'function') {
    output.setResponseCode(status || 500);
  }
  return output;
}

function openSheet(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) {
    throw new Error(`Missing sheet: ${name}`);
  }
  return sheet;
}

function readSheet(name) {
  const sheet = openSheet(name);
  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    return [];
  }
  const [headers, ...rows] = values;
  return rows
    .filter((row) => row.some((value) => value !== ''))
    .map((row) => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index];
      });
      return entry;
    });
}

function appendRow(name, rowObject) {
  const sheet = openSheet(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((header) => rowObject[header] ?? '');
  sheet.appendRow(row);
}

function updateRow(name, predicate, updates) {
  const sheet = openSheet(name);
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const entry = {};
    headers.forEach((header, columnIndex) => {
      entry[header] = row[columnIndex];
    });
    if (predicate(entry)) {
      Object.keys(updates).forEach((key) => {
        const columnIndex = headers.indexOf(key);
        if (columnIndex >= 0) {
          sheet.getRange(rowIndex + 1, columnIndex + 1).setValue(updates[key]);
        }
      });
    }
  }
}

function findRows(name, predicate) {
  return readSheet(name).filter(predicate);
}

function handleRosterList(body) {
  const { season_id, team_id } = body;
  const members = findRows(SHEET_NAMES.members, (row) => row.season_id === season_id && row.team_id === team_id);
  const status = handleStatusNow({ season_id, team_id });
  const stateMap = {};
  status.entries.forEach((entry) => {
    stateMap[entry.member_id] = entry.is_in ? 'clocked_in' : 'clocked_out';
  });
  return {
    members: members.map((member) => ({
      member_id: member.member_id,
      first_name: member.first_name,
      last_initial: member.last_initial,
      photo_url: member.photo_url,
      active_state: stateMap[member.member_id] || 'clocked_out',
    })),
  };
}

function handleStatusNow(body) {
  const { season_id, team_id } = body;
  const sessions = findRows(
    SHEET_NAMES.sessions,
    (row) =>
      row.season_id === season_id &&
      row.team_id === team_id &&
      row.type === SESSION_TYPES.IN_PERSON &&
      row.status === STATUS.OPEN,
  );

  const now = new Date();
  return {
    entries: sessions.map((session) => {
      const started = new Date(session.start_ts);
      return {
        member_id: session.member_id,
        is_in: true,
        started_at: session.start_ts,
        elapsed_sec: Math.round((now - started) / 1000),
      };
    }),
  };
}

function handleSessionToggle(body) {
  const { season_id, team_id, member_id, client_ref } = body;
  const nowIso = new Date().toISOString();
  const sessions = readSheet(SHEET_NAMES.sessions);
  const existing = sessions.find(
    (row) => row.season_id === season_id && row.client_ref === client_ref && row.client_ref,
  );
  if (existing) {
    return {
      state: existing.status === STATUS.OPEN ? 'clocked_in' : 'clocked_out',
      session_id: existing.session_id,
      start_ts: existing.start_ts,
      end_ts: existing.end_ts,
      minutes: existing.minutes,
    };
  }

  const openSession = sessions.find(
    (row) =>
      row.season_id === season_id &&
      row.team_id === team_id &&
      row.member_id === member_id &&
      row.type === SESSION_TYPES.IN_PERSON &&
      row.status === STATUS.OPEN,
  );

  if (openSession) {
    const end = new Date();
    const start = new Date(openSession.start_ts);
    const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
    updateRow(
      SHEET_NAMES.sessions,
      (row) => row.session_id === openSession.session_id,
      {
        end_ts: end.toISOString(),
        minutes: diffMinutes,
        status: STATUS.CLOSED,
        updated_at: nowIso,
      },
    );
    return {
      state: 'clocked_out',
      session_id: openSession.session_id,
      start_ts: openSession.start_ts,
      end_ts: end.toISOString(),
      minutes: diffMinutes,
    };
  }

  const sessionId = Utilities.getUuid();
  appendRow(SHEET_NAMES.sessions, {
    session_id: sessionId,
    member_id,
    team_id,
    season_id,
    source: SOURCES.KIOSK,
    type: SESSION_TYPES.IN_PERSON,
    start_ts: nowIso,
    end_ts: '',
    minutes: '',
    category: '',
    note: '',
    status: STATUS.OPEN,
    created_by: 'kiosk',
    created_at: nowIso,
    updated_at: nowIso,
    client_ref: client_ref || Utilities.getUuid(),
    ua: body._userAgent || '',
    ip_hint: body._ip || '',
  });

  return {
    state: 'clocked_in',
    session_id: sessionId,
    start_ts: nowIso,
  };
}

function handleOfflineSubmit(body) {
  const { season_id, member_id, minutes, category, note } = body;
  if (!member_id) {
    throw new Error('member_id is required');
  }
  const nowIso = new Date().toISOString();
  const sessionId = Utilities.getUuid();
  appendRow(SHEET_NAMES.sessions, {
    session_id: sessionId,
    member_id,
    team_id: body.team_id || lookupTeamForMember(season_id, member_id),
    season_id,
    source: SOURCES.HOME,
    type: SESSION_TYPES.OFFLINE,
    start_ts: body.start_ts || nowIso,
    end_ts: body.end_ts || nowIso,
    minutes: minutes || '',
    category: category || 'Other',
    note: note || '',
    status: STATUS.PENDING,
    created_by: body._userEmail || 'anonymous',
    created_at: nowIso,
    updated_at: nowIso,
    client_ref: body.client_ref || Utilities.getUuid(),
    ua: body._userAgent || '',
    ip_hint: body._ip || '',
  });
  return {
    status: STATUS.PENDING,
    session_id: sessionId,
  };
}

function handleOfflineReview(body) {
  const { session_id, action, minutes, note } = body;
  const updates = {
    status: action === 'approve' ? STATUS.APPROVED : action === 'reject' ? STATUS.REJECTED : STATUS.PENDING,
    updated_at: new Date().toISOString(),
  };
  if (action === 'edit' && minutes) {
    updates.minutes = minutes;
  }
  if (note) {
    updates.note = note;
  }
  updateRow(SHEET_NAMES.sessions, (row) => row.session_id === session_id, updates);
  return {
    status: updates.status,
  };
}

function handleClockoutAll(body) {
  const { season_id, team_id } = body;
  const nowIso = new Date().toISOString();
  const sessions = readSheet(SHEET_NAMES.sessions);
  const openSessions = sessions.filter(
    (row) =>
      row.season_id === season_id &&
      row.team_id === team_id &&
      row.type === SESSION_TYPES.IN_PERSON &&
      row.status === STATUS.OPEN,
  );
  openSessions.forEach((session) => {
    const start = new Date(session.start_ts);
    const end = new Date();
    const minutes = Math.max(1, Math.round((end - start) / 60000));
    updateRow(
      SHEET_NAMES.sessions,
      (row) => row.session_id === session.session_id,
      {
        end_ts: nowIso,
        minutes,
        status: STATUS.CLOSED,
        updated_at: nowIso,
      },
    );
  });
  return {
    count_closed: openSessions.length,
  };
}

function handleImportMembers(body) {
  const { season_id, team_id, rows } = body;
  if (!Array.isArray(rows)) {
    throw new Error('rows must be an array');
  }
  const existing = readSheet(SHEET_NAMES.members);
  let added = 0;
  rows.forEach((row) => {
    if (!row.first_name || !row.last_initial) {
      return;
    }
    const memberId = `${season_id}-${team_id}-${row.first_name}-${row.last_initial}`.replace(/\s+/g, '_');
    const found = existing.find((entry) => entry.member_id === memberId);
    if (found) {
      return;
    }
    appendRow(SHEET_NAMES.members, {
      member_id: memberId,
      team_id,
      season_id,
      first_name: row.first_name,
      last_initial: row.last_initial,
      photo_url: row.photo_url || '',
      student_email: row.student_email || '',
      guardian_email: row.guardian_email || '',
      is_active: true,
    });
    added += 1;
  });
  return { added };
}

function handleOfflineHistory(body) {
  const { season_id, member_id } = body;
  const sessions = findRows(
    SHEET_NAMES.sessions,
    (row) => row.season_id === season_id && row.member_id === member_id,
  );
  sessions.sort((a, b) => new Date(b.start_ts) - new Date(a.start_ts));
  return {
    sessions: sessions.map((session) => ({
      session_id: session.session_id,
      type: session.type,
      category: session.category,
      minutes: Number(session.minutes) || 0,
      start_ts: session.start_ts,
      end_ts: session.end_ts,
      status: session.status,
      note: session.note,
    })),
  };
}

function lookupTeamForMember(seasonId, memberId) {
  const members = readSheet(SHEET_NAMES.members);
  const member = members.find((row) => row.season_id === seasonId && row.member_id === memberId);
  if (!member) {
    throw new Error(`Member not found: ${memberId}`);
  }
  return member.team_id;
}

function nightlyAutoClockout() {
  const now = new Date();
  const sessions = readSheet(SHEET_NAMES.sessions);
  sessions
    .filter((session) => session.status === STATUS.OPEN && session.type === SESSION_TYPES.IN_PERSON)
    .forEach((session) => {
      const start = new Date(session.start_ts);
      const minutes = Math.max(1, Math.round((now - start) / 60000));
      updateRow(
        SHEET_NAMES.sessions,
        (row) => row.session_id === session.session_id,
        {
          end_ts: now.toISOString(),
          minutes,
          status: STATUS.CLOSED,
          updated_at: now.toISOString(),
        },
      );
    });
}
