import fs from 'node:fs';
const dir = 'public/songs/neon-dueto/';
const bpm = 120, gap = 2, sampleRate = 22050, duration = 36;
const patterns = [
  [0,4,7,4], [2,5,9,5], [4,7,11,7],
  [0,4,7,4], [2,5,9,5], [4,7,11,7],
  [5,9,12,9], [0,4,7,0],
];
const lyrics = [
  ['Vem ', 'can', 'tar ', 'aqui'],
  ['Dei', 'xa a ', 'voz ', 'voar'],
  ['Es', 'sa ', 'noite é ', 'nossa'],
  ['É ', 'sua ', 'vez ', 'agora'],
  ['Bri', 'lha ', 'sem ', 'parar'],
  ['Sol', 'ta ', 'sua ', 'voz'],
  ['Jun', 'tos ', 'no ', 'refrão'],
  ['Uma ', 'só ', 'can', 'ção'],
];
const notes = [];
let txt = '#TITLE:Nosso dueto\n#ARTIST:CantaMiau · Demo original\n#BPM:120\n#GAP:2000\n#MP3:audio.wav\n\n';
patterns.forEach((pitches,p) => {
  pitches.forEach((pitch,n) => {
    const start = p * 32 + n * 7, len = 6;
    txt += (p >= 6 ? '*' : ':') + ' ' + start + ' ' + len + ' ' + pitch + ' ' + lyrics[p][n] + '\n';
    notes.push({start: gap + start / 8, end: gap + (start + len) / 8, midi: pitch + 60});
  });
  txt += '- ' + (p * 32 + 28) + '\n';
});
txt += 'E\n';
fs.writeFileSync(dir + 'song.txt',txt.replace(/\n/g,'\r\n'));
const dataSize = sampleRate * duration * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF'); wav.writeUInt32LE(36+dataSize,4); wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
wav.writeUInt32LE(sampleRate,24); wav.writeUInt32LE(sampleRate*2,28); wav.writeUInt16LE(2,32);
wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(dataSize,40);
for(let i=0;i<dataSize/2;i++){
  const t=i/sampleRate;
  const note=notes.find(n=>t>=n.start&&t<n.end);
  let value=0;
  if(note){
    const age=t-note.start, remain=note.end-t;
    const env=Math.min(1,age/.025,remain/.08);
    const freq=440*2**((note.midi-69)/12);
    value+=.20*env*(Math.sin(2*Math.PI*freq*age)+.15*Math.sin(4*Math.PI*freq*age));
  }
  if(t>=gap&&t<34){
    const beat=(t-gap)%.5;
    value+=.10*Math.exp(-beat*24)*Math.sin(2*Math.PI*(65*beat+1.8*(1-Math.exp(-beat*18))));
    const bar=Math.floor((t-gap)/4)%4;
    const bass=[48,50,52,48][bar];
    value+=.045*Math.sin(2*Math.PI*(440*2**((bass-69)/12))*t)*Math.min(1,(34-t)*2);
  }
  if(t<gap){
    const tick=t%.5;
    value+=.13*Math.exp(-tick*70)*Math.sin(2*Math.PI*880*t);
  }
  wav.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(value*32767))),44+i*2);
}
fs.writeFileSync(dir+'audio.wav',wav);
console.log('Demo original gerada: 36 segundos, 8 frases, 2 frases em dueto.');
