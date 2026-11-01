const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('node:path');
const fs = require('node:fs');
const { saveUpload } = require('./storage');

const CATEGORIES = ['Facilities','IT & Wi-Fi','Cleaning','Safety','Other'];
const PRIORITIES = ['Low','Normal','High','Urgent'];
const STATUSES = ['Open','In progress','Resolved','Closed'];
function validateTicket(body = {}) {
  const errors = {};
  const category = String(body.category || '').trim();
  const location = String(body.location || '').trim();
  const priority = String(body.priority || '').trim();
  const description = String(body.description || '').trim();
  if (!CATEGORIES.includes(category)) errors.category = 'Choose a valid category.';
  if (!location || location.length > 160) errors.location = 'Location is required (max 160 characters).';
  if (!PRIORITIES.includes(priority)) errors.priority = 'Choose a valid priority.';
  if (description.length < 10 || description.length > 2000) errors.description = 'Description must be 10–2000 characters.';
  return { errors, values: { category, location, priority, description } };
}
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
function requireAuth(req,res,next) { if (!req.session.user) return res.status(401).json({error:'Sign in required.'}); next(); }
function requireStaff(req,res,next) { if (req.session.user?.role !== 'staff') return res.status(403).json({error:'Staff access required.'}); next(); }
function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(require('helmet')({ contentSecurityPolicy: { directives: { defaultSrc:["'self'"], styleSrc:["'self'","'unsafe-inline'"], scriptSrc:["'self'"], imgSrc:["'self'",'data:'] } } }));
  app.use(express.json({limit:'20kb'}));
  app.use(session({ name:'campuscare.sid', secret:process.env.SESSION_SECRET || 'dev-only-change-me-please-32-chars', resave:false, saveUninitialized:false, cookie:{ httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV === 'production', maxAge:8*60*60*1000 } }));
  app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads'), { fallthrough:false, dotfiles:'deny', index:false }));
  app.use(express.static(path.join(__dirname,'..','public')));
  app.get('/api/health', (req,res) => res.json({ok:true}));
  app.post('/api/login', rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false}), asyncRoute(async (req,res) => {
    const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
    if (email.length>254 || password.length>200 || !email) return res.status(400).json({error:'Email and password are required.'});
    const {rows}=await pool.query('SELECT id,email,password_hash,role,display_name FROM users WHERE email=$1',[email]);
    if (!rows[0] || !await bcrypt.compare(password,rows[0].password_hash)) return res.status(401).json({error:'Email or password is incorrect.'});
    req.session.regenerate(err=> { if(err) return res.status(500).json({error:'Could not start session.'}); req.session.user={id:rows[0].id,email:rows[0].email,role:rows[0].role,name:rows[0].display_name}; res.json({user:req.session.user}); });
  }));
  app.post('/api/logout', requireAuth, (req,res)=>req.session.destroy(()=>res.json({ok:true})));
  app.get('/api/me', (req,res)=>res.json({user:req.session.user||null}));
  app.get('/api/dashboard', requireAuth, asyncRoute(async (req,res)=>{
    const where=req.session.user.role==='student'?'WHERE student_id=$1':'';
    const params=where?[req.session.user.id]:[];
    const {rows}=await pool.query(`SELECT status,count(*)::int AS count FROM tickets ${where} GROUP BY status`,params);
    res.json(Object.fromEntries(STATUSES.map(s=>[s,rows.find(r=>r.status===s)?.count||0])));
  }));
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
  app.post('/api/tickets',requireAuth,upload.single('photo'),asyncRoute(async(req,res)=>{
    const {errors,values}=validateTicket(req.body); if(Object.keys(errors).length) return res.status(400).json({errors});
    if(req.file && !['image/jpeg','image/png','image/webp'].includes(req.file.mimetype)) return res.status(400).json({error:'Photo must be JPEG, PNG, or WebP.'});
    const photoUrl=await saveUpload(req.file);
    const code=`CC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const {rows}=await pool.query('INSERT INTO tickets(ticket_code,student_id,category,location,priority,description,photo_url) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,ticket_code,category,location,priority,description,photo_url,status,created_at,updated_at',[code,req.session.user.id,values.category,values.location,values.priority,values.description,photoUrl]);
    res.status(201).json({ticket:rows[0]});
  }));
  app.get('/api/tickets',requireAuth,asyncRoute(async(req,res)=>{
    const status=String(req.query.status||''); if(status && !STATUSES.includes(status)) return res.status(400).json({error:'Invalid status filter.'});
    const conditions=[], params=[];
    if(req.session.user.role==='student'){params.push(req.session.user.id);conditions.push(`t.student_id=$${params.length}`);}
    if(status){params.push(status);conditions.push(`t.status=$${params.length}`);}
    const sql=`SELECT t.id,t.ticket_code,t.category,t.location,t.priority,t.description,t.photo_url,t.status,t.created_at,t.updated_at,u.display_name AS student_name FROM tickets t JOIN users u ON u.id=t.student_id ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY t.created_at DESC LIMIT 100`;
    const {rows}=await pool.query(sql,params); res.json({tickets:rows});
  }));
  app.patch('/api/tickets/:id/status',requireAuth,requireStaff,asyncRoute(async(req,res)=>{
    const id=Number(req.params.id),status=String(req.body.status||''); if(!Number.isSafeInteger(id)||id<1||!STATUSES.includes(status)) return res.status(400).json({error:'Valid ticket ID and status required.'});
    const {rows}=await pool.query('UPDATE tickets SET status=$1,updated_at=now() WHERE id=$2 RETURNING id,ticket_code,status,updated_at',[status,id]);
    if(!rows[0]) return res.status(404).json({error:'Ticket not found.'}); res.json({ticket:rows[0]});
  }));
  app.use((err,req,res,next)=>{ if(res.headersSent)return next(err); if(err instanceof multer.MulterError) return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Photo must be 5 MB or smaller.':'Invalid upload.'}); console.error(err); res.status(500).json({error:'Something went wrong.'}); });
  return app;
}
module.exports={createApp,validateTicket,CATEGORIES,PRIORITIES,STATUSES};
