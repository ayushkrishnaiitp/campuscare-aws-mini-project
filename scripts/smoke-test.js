const assert = require('node:assert/strict');

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function request(path, { method = 'GET', cookie, body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body,
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { response, data };
}

async function login(email) {
  const { response, data } = await request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.DEMO_PASSWORD || 'campus123' }),
  });
  assert.equal(response.status, 200, `${email} login should succeed`);
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, `${email} login should issue a session cookie`);
  return { cookie: setCookie.split(';')[0], user: data.user };
}

(async () => {
  let passed = 0;
  const check = (condition, message) => { assert.ok(condition, message); passed += 1; console.log(`PASS ${passed}: ${message}`); };

  const health = await request('/api/health');
  check(health.response.status === 200 && health.data.ok === true, 'health endpoint responds');

  const student = await login('student@campus.edu');
  check(student.user.role === 'student', 'student account receives student role');
  const staff = await login('staff@campus.edu');
  check(staff.user.role === 'staff', 'staff account receives staff role');

  const form = new FormData();
  form.set('category', 'Facilities');
  form.set('location', 'North hostels, Block A, room 12');
  form.set('priority', 'Urgent');
  form.set('description', 'Water is leaking near the washroom entrance.');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN7cAAAAASUVORK5CYII=', 'base64');
  form.set('photo', new Blob([png], { type: 'image/png' }), 'test-evidence.png');
  const created = await request('/api/tickets', { method: 'POST', cookie: student.cookie, body: form });
  check(created.response.status === 201 && Boolean(created.data.ticket?.id), 'student can submit a ticket with a photo');
  const ticket = created.data.ticket;
  check(String(ticket.photo_url || '').startsWith('/uploads/'), 'photo is saved by the local upload adapter');

  const studentTickets = await request('/api/tickets', { cookie: student.cookie });
  check(studentTickets.response.status === 200 && studentTickets.data.tickets.some(t => t.id === ticket.id), 'student can see their own submitted ticket');

  const denied = await request(`/api/tickets/${ticket.id}/status`, {
    method: 'PATCH', cookie: student.cookie,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Resolved' }),
  });
  check(denied.response.status === 403, 'student cannot change ticket status');

  const staffTickets = await request('/api/tickets?status=Open', { cookie: staff.cookie });
  check(staffTickets.response.status === 200 && staffTickets.data.tickets.some(t => t.id === ticket.id), 'staff can filter and find open tickets');

  const updated = await request(`/api/tickets/${ticket.id}/status`, {
    method: 'PATCH', cookie: staff.cookie,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'In progress' }),
  });
  check(updated.response.status === 200 && updated.data.ticket.status === 'In progress', 'staff can update ticket status');

  const dashboard = await request('/api/dashboard', { cookie: staff.cookie });
  check(dashboard.response.status === 200 && dashboard.data['In progress'] >= 1, 'dashboard counts reflect the status update');

  const photoCheck = await fetch(`${base}${ticket.photo_url}`);
  check(photoCheck.status === 200, 'uploaded photo is retrievable from local storage');

  console.log(`\n${passed}/11 workflow checks passed.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
