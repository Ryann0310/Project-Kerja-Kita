const express=require('express'),Database=require('better-sqlite3'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const SECRET=process.env.JWT_SECRET||'ganti-rahasia-ini',db=new Database('kerjakita.db');
const LOCS=['Semarang','Jakarta','Bandung','Surabaya','Yogyakarta','Remote'],TYPES=['Full-time','Part-time','Kontrak','Magang','Freelance'],STATUS=['Dikirim','Ditinjau','Wawancara','Diterima','Ditolak'];
const fs=require('fs'),path=require('path'),CVDIR=path.join(__dirname,'uploads','cv');fs.mkdirSync(CVDIR,{recursive:true});
db.pragma('foreign_keys=ON');
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT,email TEXT UNIQUE,pass TEXT,role TEXT,blocked INT DEFAULT 0,phone TEXT DEFAULT '',loc TEXT DEFAULT '',about TEXT DEFAULT '',cv TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS companies(id INTEGER PRIMARY KEY,user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,name TEXT,industry TEXT DEFAULT '',loc TEXT DEFAULT '',web TEXT DEFAULT '',about TEXT DEFAULT '',verified INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,company_id INT REFERENCES companies(id) ON DELETE CASCADE,title TEXT,category TEXT,location TEXT,type TEXT,salary TEXT,descr TEXT,req TEXT,status TEXT DEFAULT 'pending',date TEXT DEFAULT CURRENT_DATE);
CREATE TABLE IF NOT EXISTS apps(id INTEGER PRIMARY KEY,job_id INT REFERENCES jobs(id) ON DELETE CASCADE,user_id INT REFERENCES users(id) ON DELETE CASCADE,date TEXT DEFAULT CURRENT_DATE,status TEXT DEFAULT 'Dikirim',UNIQUE(job_id,user_id));`);
const all=(s,...a)=>db.prepare(s).all(...a),one=(s,...a)=>db.prepare(s).get(...a),run=(s,...a)=>db.prepare(s).run(...a);
const fail=(m,c=400)=>{throw Object.assign(new Error(m),{code:c})};
if(!one('SELECT 1 FROM users')){
 const h=bcrypt.hashSync('demo1234',10),u=(n,e,r)=>run('INSERT INTO users(name,email,pass,role) VALUES(?,?,?,?)',n,e,h,r).lastInsertRowid;
 u('Admin','admin@demo.id','admin');
 const p=u('Rina Pelamar','pelamar@demo.id','pelamar');
 run('UPDATE users SET loc=? WHERE id=?','Semarang',p);
 const c=u('PT Nusantara Digital','perusahaan@demo.id','perusahaan');
 run('INSERT INTO companies(user_id,name,industry,loc,about,verified) VALUES(?,?,?,?,?,1)',c,'PT Nusantara Digital','Teknologi Informasi','Semarang','Perusahaan perangkat lunak untuk UMKM dan instansi.');
 ['Teknologi','Pemasaran','Keuangan','Desain','Pendidikan','Kesehatan'].forEach(n=>run('INSERT INTO categories(name) VALUES(?)',n));
 [['Web Developer','Teknologi','Semarang','Full-time','Rp6–9 juta'],['UI/UX Designer','Desain','Remote','Kontrak','Rp5–8 juta'],['Magang Data Analyst','Teknologi','Semarang','Magang','Rp1,5 juta']]
  .forEach(j=>run("INSERT INTO jobs(company_id,title,category,location,type,salary,descr,req,status) VALUES(1,?,?,?,?,?,?,?,'approved')",...j,'Mengerjakan proyek nyata bersama tim.','Minimal D3/S1 terkait.\nMampu bekerja dalam tim.'));
}
const app=express();app.use(express.json(),express.static('public'));app.use('/api/me/cv',express.raw({type:'application/pdf',limit:'5mb'}));
const auth=role=>(req,res,next)=>{try{const t=jwt.verify((req.headers.authorization||'').slice(7),SECRET),u=one('SELECT * FROM users WHERE id=?',t.id);
 if(!u||u.blocked)throw 0;if(role!='any'&&u.role!=role)return res.status(403).json({error:'Akses ditolak'});req.user=u;next()}catch{res.status(401).json({error:'Silakan masuk terlebih dahulu'})}};
const A=(m,p,role,fn)=>app[m](p,...(role?[auth(role)]:[]),(req,res)=>{try{res.json(fn(req))}catch(e){res.status(e.code||400).json({error:e.message})}});
const pub=u=>({id:u.id,name:u.name,email:u.email,role:u.role,phone:u.phone,loc:u.loc,about:u.about,cv:JSON.parse(u.cv)}),
 tok=u=>({token:jwt.sign({id:u.id},SECRET,{expiresIn:'7d'}),user:pub(u)}),mine=u=>one('SELECT * FROM companies WHERE user_id=?',u.id),ok=()=>({ok:1});
const JC='SELECT j.*,c.name company FROM jobs j JOIN companies c ON c.id=j.company_id ';
// ---- Publik
A('get','/api/meta',0,()=>({categories:all('SELECT name FROM categories').map(c=>c.name),locs:LOCS,types:TYPES}));
A('get','/api/jobs',0,r=>{const{q='',loc='',cat='',typ=''}=r.query;
 return all(JC+`WHERE j.status='approved' AND (?='' OR j.location=?) AND (?='' OR j.category=?) AND (?='' OR j.type=?) AND (j.title LIKE ? OR c.name LIKE ?) ORDER BY j.id DESC`,loc,loc,cat,cat,typ,typ,`%${q}%`,`%${q}%`)});
A('get','/api/jobs/:id',0,r=>one(JC+"WHERE j.id=? AND j.status='approved'",r.params.id)||fail('Lowongan tidak ditemukan',404));
A('get','/api/companies/:id',0,r=>{const c=one('SELECT id,name,industry,loc,web,about,verified FROM companies WHERE id=?',r.params.id)||fail('Perusahaan tidak ditemukan',404);
 c.jobs=all("SELECT * FROM jobs WHERE company_id=? AND status='approved'",c.id);return c});
A('post','/api/register',0,r=>{const{name,password,role}=r.body,email=String(r.body.email||'').toLowerCase().trim();
 if(!name||!email||!password||password.length<6)fail('Lengkapi data. Kata sandi minimal 6 karakter.');
 if(!['pelamar','perusahaan'].includes(role))fail('Peran tidak valid');
 if(one('SELECT 1 FROM users WHERE email=?',email))fail('Email sudah terdaftar');
 const id=run('INSERT INTO users(name,email,pass,role) VALUES(?,?,?,?)',name,email,bcrypt.hashSync(password,10),role).lastInsertRowid;
 if(role=='perusahaan')run('INSERT INTO companies(user_id,name) VALUES(?,?)',id,name);
 return tok(one('SELECT * FROM users WHERE id=?',id))});
A('post','/api/login',0,r=>{const u=one('SELECT * FROM users WHERE email=?',String(r.body.email||'').toLowerCase().trim());
 if(!u||!bcrypt.compareSync(String(r.body.password||''),u.pass))fail('Email atau kata sandi salah',401);
 if(u.blocked)fail('Akun ini diblokir oleh admin',403);return tok(u)});
A('get','/api/me','any',r=>pub(r.user));
// ---- Pelamar
A('put','/api/me','pelamar',r=>{const b=r.body;run('UPDATE users SET name=?,phone=?,loc=?,about=? WHERE id=?',b.name||r.user.name,b.phone||'',b.loc||'',b.about||'',r.user.id);return pub(one('SELECT * FROM users WHERE id=?',r.user.id))});
// CV berupa file PDF (disimpan di folder uploads/cv, tidak publik)
A('put','/api/me/cv','pelamar',r=>{const f=r.body;
 if(!Buffer.isBuffer(f)||!f.length)fail('Pilih file PDF CV terlebih dahulu');
 if(f.length>5*1024*1024)fail('Ukuran CV maksimal 5 MB');
 if(f.subarray(0,5).toString('latin1')!=='%PDF-')fail('File harus berformat PDF');
 let name='cv.pdf';try{name=path.basename(decodeURIComponent(r.headers['x-filename']||'cv.pdf')).slice(0,100)||'cv.pdf'}catch{}
 fs.writeFileSync(path.join(CVDIR,r.user.id+'.pdf'),f);
 run('UPDATE users SET cv=? WHERE id=?',JSON.stringify({file:name,size:f.length,date:new Date().toISOString().slice(0,10)}),r.user.id);
 return pub(one('SELECT * FROM users WHERE id=?',r.user.id))});
// Boleh dibuka oleh: pemilik CV, admin, dan perusahaan yang menerima lamaran dari pelamar tsb
app.get('/api/cv/:id',auth('any'),(req,res)=>{const id=+req.params.id,u=req.user,co=u.role=='perusahaan'?mine(u):null,f=path.join(CVDIR,id+'.pdf');
 const allowed=u.role=='admin'||u.id==id||(co&&one('SELECT 1 FROM apps a JOIN jobs j ON j.id=a.job_id WHERE a.user_id=? AND j.company_id=?',id,co.id));
 if(!allowed)return res.status(403).json({error:'Akses ditolak'});
 if(!Number.isInteger(id)||!fs.existsSync(f))return res.status(404).json({error:'CV belum diunggah'});
 res.type('application/pdf').sendFile(f)});
A('post','/api/jobs/:id/apply','pelamar',r=>{
 if(!JSON.parse(r.user.cv).file||!fs.existsSync(path.join(CVDIR,r.user.id+'.pdf')))fail('Unggah file CV Anda di tab CV pada dashboard terlebih dahulu');
 if(!one("SELECT 1 FROM jobs WHERE id=? AND status='approved'",r.params.id))fail('Lowongan tidak tersedia',404);
 try{run('INSERT INTO apps(job_id,user_id) VALUES(?,?)',r.params.id,r.user.id)}catch{fail('Anda sudah melamar lowongan ini')}return ok()});
A('get','/api/my/apps','pelamar',r=>all('SELECT a.*,j.title,c.name company FROM apps a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.user_id=? ORDER BY a.id DESC',r.user.id));
// ---- Perusahaan
A('get','/api/my/company','perusahaan',r=>mine(r.user));
A('put','/api/my/company','perusahaan',r=>{const b=r.body;if(!b.name)fail('Nama wajib diisi');run('UPDATE companies SET name=?,industry=?,loc=?,web=?,about=? WHERE user_id=?',b.name,b.industry||'',b.loc||'',b.web||'',b.about||'',r.user.id);return mine(r.user)});
A('get','/api/my/jobs','perusahaan',r=>all('SELECT j.*,(SELECT COUNT(*) FROM apps WHERE job_id=j.id) applicants FROM jobs j WHERE company_id=? ORDER BY id DESC',mine(r.user).id));
const jf=b=>[b.title,b.category,b.location,b.type,b.salary,b.descr,b.req].map(x=>x||'');
A('post','/api/my/jobs','perusahaan',r=>{if(!r.body.title)fail('Judul posisi wajib diisi');run('INSERT INTO jobs(title,category,location,type,salary,descr,req,company_id) VALUES(?,?,?,?,?,?,?,?)',...jf(r.body),mine(r.user).id);return ok()});
A('put','/api/my/jobs/:id','perusahaan',r=>{if(!r.body.title)fail('Judul posisi wajib diisi');
 return run("UPDATE jobs SET title=?,category=?,location=?,type=?,salary=?,descr=?,req=?,status='pending' WHERE id=? AND company_id=?",...jf(r.body),r.params.id,mine(r.user).id).changes?ok():fail('Tidak ditemukan',404)});
A('delete','/api/my/jobs/:id','perusahaan',r=>(run('DELETE FROM jobs WHERE id=? AND company_id=?',r.params.id,mine(r.user).id),ok()));
A('get','/api/my/applicants','perusahaan',r=>all('SELECT a.id,a.date,a.status,j.title job,u.id uid,u.name,u.email,u.phone,u.cv FROM apps a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.user_id WHERE j.company_id=? ORDER BY a.id DESC',mine(r.user).id).map(a=>({...a,cv:JSON.parse(a.cv)})));
A('put','/api/applicants/:id/status','perusahaan',r=>{if(!STATUS.includes(r.body.status))fail('Status tidak valid');
 return run('UPDATE apps SET status=? WHERE id=? AND job_id IN (SELECT id FROM jobs WHERE company_id=?)',r.body.status,r.params.id,mine(r.user).id).changes?ok():fail('Tidak ditemukan',404)});
// ---- Admin
A('get','/api/admin/users','admin',()=>all('SELECT id,name,email,role,blocked FROM users'));
A('put','/api/admin/users/:id/block','admin',r=>(run("UPDATE users SET blocked=1-blocked WHERE id=? AND role!='admin'",r.params.id),ok()));
A('delete','/api/admin/users/:id','admin',r=>(run("DELETE FROM users WHERE id=? AND role!='admin'",r.params.id),ok()));
A('get','/api/admin/categories','admin',()=>all('SELECT c.id,c.name,(SELECT COUNT(*) FROM jobs WHERE category=c.name) used FROM categories c'));
A('post','/api/admin/categories','admin',r=>{const n=String(r.body.name||'').trim();if(!n)fail('Nama kategori wajib diisi');try{run('INSERT INTO categories(name) VALUES(?)',n)}catch{fail('Kategori sudah ada')}return ok()});
A('delete','/api/admin/categories/:id','admin',r=>(run('DELETE FROM categories WHERE id=? AND name NOT IN (SELECT category FROM jobs)',r.params.id),ok()));
A('get','/api/admin/companies','admin',()=>all('SELECT c.*,(SELECT COUNT(*) FROM jobs WHERE company_id=c.id) jobs FROM companies c'));
A('put','/api/admin/companies/:id/verify','admin',r=>(run('UPDATE companies SET verified=1-verified WHERE id=?',r.params.id),ok()));
A('delete','/api/admin/companies/:id','admin',r=>(run('DELETE FROM users WHERE id=(SELECT user_id FROM companies WHERE id=?)',r.params.id),ok()));
A('get','/api/admin/jobs','admin',()=>all(JC+"ORDER BY (j.status='pending') DESC,j.id DESC"));
A('put','/api/admin/jobs/:id/status','admin',r=>{if(!['approved','rejected','pending'].includes(r.body.status))fail('Status tidak valid');run('UPDATE jobs SET status=? WHERE id=?',r.body.status,r.params.id);return ok()});
A('delete','/api/admin/jobs/:id','admin',r=>(run('DELETE FROM jobs WHERE id=?',r.params.id),ok()));
const PORT=process.env.PORT||3000;app.listen(PORT,()=>console.log('KerjaKita berjalan di http://localhost:'+PORT));
