require('dotenv').config();
const fs=require('node:fs/promises'); const path=require('node:path'); const {Pool}=require('pg'); const {createApp}=require('./app');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:true}:undefined,max:10});
async function migrate(){const sql=await fs.readFile(path.join(__dirname,'..','db/migrations/001_initial.sql'),'utf8');await pool.query(sql);}
(async()=>{try{await migrate();const port=Number(process.env.PORT)||3000;createApp(pool).listen(port,()=>console.log(`CampusCare listening on :${port}`));}catch(e){console.error('Startup failed:',e.message);process.exit(1)}})();
process.on('SIGTERM',async()=>{await pool.end();process.exit(0)});process.on('SIGINT',async()=>{await pool.end();process.exit(0)});
