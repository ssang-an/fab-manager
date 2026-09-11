import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'); const name=decodeURIComponent(url.pathname); if(!(name==='/' || name==='/index.html' || name.startsWith('/src/') || name.startsWith('/data/'))) {res.writeHead(404).end();return;} const file=resolve(root,'.'+(name==='/'?'/index.html':name)); if(!file.startsWith(root+sep)) {res.writeHead(403).end();return;} res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(file));}catch{res.writeHead(404).end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Fab Manager: http://127.0.0.1:4173'));
