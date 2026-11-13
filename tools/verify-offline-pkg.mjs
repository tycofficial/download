import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {Writable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const layout=JSON.parse(fs.readFileSync('build/package-layout.json','utf8'));
const file=layout.file;
const fd=fs.openSync(file,'r');
const header=Buffer.alloc(28);fs.readSync(fd,header,0,28,0);
if(header.toString('ascii',0,4)!=='xar!'||header.readUInt32BE(24)!==1)throw Error('Wrong XAR header');
const tocLength=Number(header.readBigUInt64BE(8));
const toc=Buffer.alloc(tocLength);fs.readSync(fd,toc,0,toc.length,28);
const check=Buffer.alloc(20);fs.readSync(fd,check,0,20,28+tocLength);
if(!crypto.createHash('sha1').update(toc).digest().equals(check))throw Error('XAR TOC digest mismatch');
zlib.inflateSync(toc);fs.closeSync(fd);

const expected={
  './Codex.zip':'5a8eb9bca0c021b994e56c93ef3502bdbc105975bcb83f99aef40f2ae56d48cc',
  './ClashVerge.tar.gz':'5d72465f401e78e9b6238cf9ce8a32dfdd16d7d7c3389d1584085a4d2835e59e',
};
const records=[];let buffer=Buffer.alloc(0),state='header',info=null,remaining=0,hash=null;
const parser=new Writable({write(chunk,encoding,done){
  try{
    buffer=Buffer.concat([buffer,chunk]);
    while(true){
      if(state==='trailer'){if(buffer.some(x=>x!==0))throw Error('Nonzero CPIO padding');buffer=Buffer.alloc(0);break;}
      if(state==='header'){
        if(buffer.length<76)break;
        const h=buffer.subarray(0,76).toString('ascii');buffer=buffer.subarray(76);
        if(h.slice(0,6)!=='070707')throw Error('Bad CPIO header');
        info={mode:parseInt(h.slice(18,24),8),nameSize:parseInt(h.slice(59,65),8),size:parseInt(h.slice(65,76),8)};state='name';
      }
      if(state==='name'){
        if(buffer.length<info.nameSize)break;
        info.name=buffer.subarray(0,info.nameSize-1).toString('utf8');buffer=buffer.subarray(info.nameSize);
        if(info.name==='TRAILER!!!'){state='trailer';continue;}
        if(!info.name.startsWith('./')||info.name.includes('..'))throw Error('Unsafe CPIO path');
        remaining=info.size;hash=crypto.createHash('sha256');state='body';
      }
      if(state==='body'){
        const n=Math.min(remaining,buffer.length);hash.update(buffer.subarray(0,n));buffer=buffer.subarray(n);remaining-=n;
        if(remaining)break;
        info.sha256=hash.digest('hex');
        if(expected[info.name]&&expected[info.name]!==info.sha256)throw Error('Embedded original archive digest mismatch');
        if(/\/(preinstall|postinstall)$/.test(info.name)&&(info.mode&0o777)!==0o755)throw Error('Script is not executable');
        records.push(info);state='header';
      }
    }
    done();
  }catch(error){done(error);}
}});
for(const entry of layout.entries){
  const start=layout.heapStart+entry.offset;const end=start+entry.size-1;
  const digest=crypto.createHash('sha1');
  if(entry.script){
    await pipeline(fs.createReadStream(file,{start,end}),new Transform({transform(chunk,encoding,done){digest.update(chunk);done(null,chunk);}}),zlib.createGunzip(),parser);
  }else for await(const chunk of fs.createReadStream(file,{start,end}))digest.update(chunk);
  if(digest.digest('hex')!==entry.digest)throw Error('XAR file digest mismatch: '+entry.name);
}
if(state!=='trailer')throw Error('Incomplete CPIO archive');
for(const name of Object.keys(expected))if(!records.some(r=>r.name===name))throw Error('Missing original archive');
if(records.length!==layout.scripts.length)throw Error('Incorrect script resource count');
const digest=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))digest.update(chunk);
const result={file,bytes:fs.statSync(file).size,sha256:digest.digest('hex'),originalArchives:records.filter(r=>expected[r.name]),scriptResources:records.length,checks:['XAR header and TOC checksum','all XAR entries and checksums','complete gzip/CPIO archive','both original installer archive SHA256 values','script execution permissions']};
fs.writeFileSync('build/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
