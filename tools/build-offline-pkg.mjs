import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {Readable, Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {once} from 'node:events';

const stamp='2026-11-13T15:00:00Z';
const epoch=Math.floor(Date.parse(stamp)/1000);
const scriptsDir='installer/scripts';
const outPath='output/Clash-Verge-Codex-Monterey-Intel.pkg';
fs.mkdirSync('build',{recursive:true});
const sourceFiles=fs.readdirSync(scriptsDir).sort().map(name=>({name,path:path.join(scriptsDir,name),size:fs.statSync(path.join(scriptsDir,name)).size}));
const oct=(n,width)=>{const s=n.toString(8);if(s.length>width)throw Error('CPIO field overflow');return s.padStart(width,'0');};
const header=(name,size,mode,inode)=>Buffer.from('070707'+oct(0,6)+oct(inode,6)+oct(mode,6)+oct(0,6)+oct(0,6)+oct(1,6)+oct(0,6)+oct(epoch,11)+oct(Buffer.byteLength(name)+1,6)+oct(size,11));
async function* cpio(){
  let inode=1,total=0;
  for(const f of sourceFiles){
    const name='./'+f.name;
    const h=header(name,f.size,/^(preinstall|postinstall)$/.test(f.name)?0o100755:0o100644,inode++);
    const n=Buffer.from(name+'\0');
    total+=h.length+n.length+f.size;
    yield h;yield n;
    yield* fs.createReadStream(f.path);
  }
  const trailer=Buffer.concat([header('TRAILER!!!',0,0,inode),Buffer.from('TRAILER!!!\0')]);
  yield trailer;total+=trailer.length;
  if(total%512)yield Buffer.alloc(512-total%512);
}

console.log('Measuring compressed install resources without temporary copies...');
let scriptSize=0;const scriptHash=crypto.createHash('sha1');
await pipeline(Readable.from(cpio()),zlib.createGzip({level:1}),new Writable({write(chunk,encoding,done){scriptSize+=chunk.length;scriptHash.update(chunk);done();}}));
const scriptDigest=scriptHash.digest('hex');
const packageInfo=Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<pkg-info overwrite-permissions="true" relocatable="false" identifier="local.macsetup.clash-codex.monterey" postinstall-action="none" version="1.0" format-version="2" auth="root" minimumSystemVersion="12.0">
<bundle-version/><upgrade-bundle/><update-bundle/><atomic-update-bundle/><strict-identifier/><relocate/>
<scripts><preinstall file="./preinstall" timeout="600"/><postinstall file="./postinstall" timeout="1800"/></scripts>
</pkg-info>`);
const files=[
  {name:'ClashCodex.component.pkg/Scripts',size:scriptSize,digest:scriptDigest,script:true},
  {name:'ClashCodex.component.pkg/PackageInfo',data:packageInfo},
  {name:'Distribution',data:fs.readFileSync('installer/Distribution')},
  ...fs.readdirSync('installer/resources').sort().map(n=>({name:'Resources/'+n,data:fs.readFileSync('installer/resources/'+n)})),
];
let heapOffset=20;
for(const f of files){if(f.data){f.size=f.data.length;f.digest=crypto.createHash('sha1').update(f.data).digest('hex');}f.offset=heapOffset;heapOffset+=f.size;}
const tree={children:new Map()};
for(const f of files){let node=tree;const parts=f.name.split('/');for(let i=0;i<parts.length;i++){if(!node.children.has(parts[i]))node.children.set(parts[i],{name:parts[i],children:new Map()});node=node.children.get(parts[i]);}node.file=f;}
let id=1;
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function xml(node){
  let s=`<file id="${id++}"><name>${escape(node.name)}</name><type>${node.file?'file':'directory'}</type><mode>${node.file?'0644':'0755'}</mode><uid>0</uid><user>root</user><gid>0</gid><group>wheel</group><mtime>${stamp}</mtime>`;
  if(node.file){const f=node.file;s+=`<data><length>${f.size}</length><offset>${f.offset}</offset><size>${f.size}</size><encoding style="application/octet-stream"/><archived-checksum style="sha1">${f.digest}</archived-checksum><extracted-checksum style="sha1">${f.digest}</extracted-checksum></data>`;}
  for(const child of node.children.values())s+=xml(child);
  return s+'</file>';
}
const toc=Buffer.from('<?xml version="1.0" encoding="UTF-8"?><xar><toc><checksum style="sha1"><offset>0</offset><size>20</size></checksum><creation-time>'+stamp.slice(0,-1)+'</creation-time>'+[...tree.children.values()].map(xml).join('')+'</toc></xar>');
const compressedToc=zlib.deflateSync(toc);
const xarHeader=Buffer.alloc(28);
xarHeader.write('xar!');xarHeader.writeUInt16BE(28,4);xarHeader.writeUInt16BE(1,6);
xarHeader.writeBigUInt64BE(BigInt(compressedToc.length),8);xarHeader.writeBigUInt64BE(BigInt(toc.length),16);xarHeader.writeUInt32BE(1,24);
fs.mkdirSync(path.dirname(outPath),{recursive:true});
const output=fs.createWriteStream(outPath);
output.on('error',()=>{});
async function write(chunk){if(!output.write(chunk))await once(output,'drain');}
await write(xarHeader);await write(compressedToc);await write(crypto.createHash('sha1').update(compressedToc).digest());
console.log('Writing offline installer...');
for(const f of files){
  if(f.script){
    const digest=crypto.createHash('sha1');let size=0;
    await pipeline(Readable.from(cpio()),zlib.createGzip({level:1}),new Writable({write(chunk,encoding,done){size+=chunk.length;digest.update(chunk);write(chunk).then(()=>done(),done);}}));
    if(size!==f.size||digest.digest('hex')!==f.digest)throw Error('Resource archive changed during build');
  }else await write(f.data);
}
output.end();await once(output,'finish');
fs.writeFileSync('build/package-layout.json',JSON.stringify({file:outPath,heapStart:28+compressedToc.length,entries:files.map(({data,...f})=>f),scripts:sourceFiles.map(({path,...f})=>f)},null,2));
console.log(JSON.stringify({file:outPath,bytes:fs.statSync(outPath).size,scriptBytes:scriptSize}));
