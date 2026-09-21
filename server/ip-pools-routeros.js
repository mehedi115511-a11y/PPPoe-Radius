import tls from 'node:tls';

const fail=(message,status=502)=>Object.assign(new Error(message),{status});
const wordLength=n=>n<0x80?Buffer.from([n]):n<0x4000?Buffer.from([(n>>8)|0x80,n&255]):n<0x200000?Buffer.from([(n>>16)|0xc0,(n>>8)&255,n&255]):n<0x10000000?Buffer.from([(n>>24)|0xe0,(n>>16)&255,(n>>8)&255,n&255]):Buffer.from([0xf0,(n>>24)&255,(n>>16)&255,(n>>8)&255,n&255]);
export const encodeSentence=words=>Buffer.concat([...words.map(value=>{const b=Buffer.from(String(value));return Buffer.concat([wordLength(b.length),b])}),Buffer.from([0])]);
function decoder(onSentence){let data=Buffer.alloc(0),words=[];return chunk=>{data=Buffer.concat([data,chunk]);for(;;){if(!data.length)return;let n=data[0],head=1;if(n===0){data=data.subarray(1);onSentence(words);words=[];continue}if((n&0x80)===0)n=n;else if((n&0xc0)===0x80){if(data.length<2)return;n=((n&0x3f)<<8)|data[1];head=2}else if((n&0xe0)===0xc0){if(data.length<3)return;n=((n&0x1f)<<16)|(data[1]<<8)|data[2];head=3}else if((n&0xf0)===0xe0){if(data.length<4)return;n=((n&15)<<24)|(data[1]<<16)|(data[2]<<8)|data[3];head=4}else{if(data.length<5)return;n=(data[1]<<24)|(data[2]<<16)|(data[3]<<8)|data[4];head=5}if(data.length<head+n)return;words.push(data.subarray(head,head+n).toString());data=data.subarray(head+n)}}}
const row=words=>Object.fromEntries(words.slice(1).filter(w=>w.startsWith('=')).map(w=>{const i=w.indexOf('=',1);return [w.slice(1,i),w.slice(i+1)]}));
export function createRouterOsApi(options){
 const connect=options?.connect||tls.connect,timeoutMs=options?.timeoutMs||5000;
 const run=words=>new Promise((resolve,reject)=>{let settled=false,authenticated=false,rows=[];const socket=connect({host:options.host,port:options.port,servername:options.host,rejectUnauthorized:options.rejectUnauthorized!==false},()=>socket.write(encodeSentence(['/login',`=name=${options.username}`,`=password=${options.password}`])));
  const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();error?reject(error):resolve(value)};
  const timer=setTimeout(()=>done(fail('RouterOS API timeout',504)),timeoutMs);
  socket.on('data',decoder(sentence=>{if(sentence[0]==='!re')rows.push(row(sentence));else if(sentence[0]==='!trap')done(fail(row(sentence).message||'RouterOS API rejected operation'));else if(sentence[0]==='!done'&&!authenticated){authenticated=true;socket.write(encodeSentence(words))}else if(sentence[0]==='!done')done(null,rows)}));
  socket.on('error',()=>done(fail('RouterOS API connection failed')));
 });
 const command=words=>run(words);
 return Object.freeze({
  listPools:()=>command(['/ip/pool/print','=.proplist=.id,name,ranges']),
  addPool:(name,ranges)=>command(['/ip/pool/add',`=name=${name}`,`=ranges=${ranges}`]),
  setPool:(id,name,ranges)=>command(['/ip/pool/set',`=.id=${id}`,`=name=${name}`,`=ranges=${ranges}`]),
  removePool:id=>command(['/ip/pool/remove',`=.id=${id}`]),
 });
}
export function cidrUsableRange(cidr){const [address,prefixText]=cidr.split('/'),prefix=Number(prefixText),parts=address.split('.').map(Number);let n=parts.reduce((v,x)=>(v*256+x)>>>0,0),size=2**(32-prefix);const format=v=>[24,16,8,0].map(s=>(v>>>s)&255).join('.');return `${format((n+1)>>>0)}-${format((n+size-2)>>>0)}`}
export function usableRangeToCidr(range){for(let prefix=30;prefix>=8;prefix--){const [start]=String(range).split('-'),octets=start.split('.').map(Number);if(octets.length!==4||octets.some(n=>!Number.isInteger(n)||n<0||n>255))break;const first=octets.reduce((v,x)=>(v*256+x)>>>0,0),network=(first-1)>>>0,size=2**(32-prefix),format=v=>[24,16,8,0].map(s=>(v>>>s)&255).join('.'),cidr=`${format(network)}/${prefix}`;if((network%(size)===0)&&cidrUsableRange(cidr)===range)return cidr}throw fail('RouterOS pool range is not an exact /8 to /30 CIDR usable range',422)}
