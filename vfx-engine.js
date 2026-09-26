/* RIFT Phase 2 VFX engine. Canvas-only, local, deterministic. */
(() => {
  const param = (label, min, max, step, value) => ({ label, min, max, step, value });
  const registry = [
    ['digital', 'datamosh', 'Datamosh', { intensity:param('Intensity',0,100,1,55), persistence:param('Persistence',0,100,1,65), block:param('Block size',4,64,1,20), bleed:param('Bleed',0,100,1,35) }],
    ['digital', 'pixelSort', 'Pixel sorting', { intensity:param('Intensity',0,100,1,65), threshold:param('Threshold',0,255,1,105), direction:param('Direction',0,1,1,0) }],
    ['digital', 'frameSmear', 'Frame smear', { intensity:param('Intensity',0,100,1,55), length:param('Length',2,80,1,30), direction:param('Direction',-1,1,.01,.4) }],
    ['digital', 'frameFeedback', 'Frame feedback', { amount:param('Amount',0,100,1,45), zoom:param('Zoom',.9,1.15,.001,1.025), rotation:param('Rotation',-8,8,.1,.7) }],
    ['digital', 'compressionGlitch', 'Compression glitch', { intensity:param('Intensity',0,100,1,55), blocks:param('Blocks',2,40,1,15), jitter:param('Jitter',0,60,1,22) }],
    ['digital', 'rgbDisplacement', 'RGB displacement', { amount:param('Amount',0,80,1,18), angle:param('Angle',0,360,1,0), split:param('Split',0,100,1,75) }],
    ['digital', 'posterization', 'Posterization', { levels:param('Levels',2,32,1,6), mix:param('Mix',0,100,1,100) }],
    ['digital', 'thresholdCrush', 'Threshold crush', { threshold:param('Threshold',0,255,1,128), mix:param('Mix',0,100,1,100) }],
    ['digital', 'colorQuantization', 'Color quantization', { colors:param('Colors',2,24,1,8), mix:param('Mix',0,100,1,90) }],
    ['digital', 'resolutionCrush', 'Resolution crush', { pixelSize:param('Pixel size',1,64,1,12), mix:param('Mix',0,100,1,100) }],
    ['digital', 'dithering', 'Dithering', { amount:param('Amount',0,100,1,80), scale:param('Scale',1,8,1,2) }],
    ['digital', 'dataBend', 'Data-bend corruption', { corruption:param('Corruption',0,100,1,50), seed:param('Seed',0,99,1,13), streak:param('Streak',0,100,1,45) }],
    ['color', 'paletteCycle', 'Palette cycling', { speed:param('Speed',0,12,.1,3), amount:param('Amount',0,100,1,75) }],
    ['color', 'hueMelt', 'Hue melt', { amount:param('Amount',0,100,1,55), speed:param('Speed',0,10,.1,2), bands:param('Bands',2,40,1,14) }],
    ['color', 'solarization', 'Solarization', { threshold:param('Threshold',0,255,1,125), mix:param('Mix',0,100,1,100) }],
    ['color', 'channelSwap', 'Channel swapping', { mode:param('Mode',0,5,1,1), mix:param('Mix',0,100,1,100) }],
    ['color', 'colorTrails', 'Color trails', { amount:param('Amount',0,100,1,60), steps:param('Steps',2,12,1,5) }],
    ['color', 'negativeFlash', 'Negative flash', { amount:param('Amount',0,100,1,85), rate:param('Rate',1,20,1,8) }],
    ['color', 'chromaticBloom', 'Chromatic bloom', { radius:param('Radius',0,40,1,14), intensity:param('Intensity',0,100,1,55) }],
    ['temporal', 'motionEcho', 'Motion echo', { amount:param('Amount',0,100,1,55), echoes:param('Echoes',2,12,1,5), spacing:param('Spacing',1,40,1,12) }],
    ['temporal', 'temporalSlicing', 'Temporal slicing', { slices:param('Slices',2,40,1,14), offset:param('Offset',0,100,1,45) }],
    ['temporal', 'timeDisplacement', 'Time displacement', { amount:param('Amount',0,100,1,45), frequency:param('Frequency',1,20,1,8) }],
    ['temporal', 'slitScan', 'Slit scan', { slices:param('Slices',4,80,1,32), travel:param('Travel',0,100,1,55) }],
    ['temporal', 'frameRepeat', 'Frame repeat', { frames:param('Frames',1,24,1,6), mix:param('Mix',0,100,1,100) }],
    ['temporal', 'frameSkipping', 'Frame skipping', { interval:param('Interval',2,16,1,4), mix:param('Mix',0,100,1,100) }],
    ['temporal', 'frameShuffle', 'Frame shuffle', { window:param('Window',2,30,1,8), mix:param('Mix',0,100,1,100) }],
    ['temporal', 'temporalTrails', 'Temporal trails', { amount:param('Amount',0,100,1,65), decay:param('Decay',0,100,1,55) }],
    ['spatial', 'blockDisplacement', 'Block displacement', { amount:param('Amount',0,100,1,55), blockSize:param('Block size',4,80,1,22), density:param('Density',0,100,1,55) }],
    ['spatial', 'scanlineDisplacement', 'Scanline displacement', { amount:param('Amount',0,100,1,50), frequency:param('Frequency',2,60,1,20) }],
    ['spatial', 'waveWarp', 'Wave / turbulence warp', { amplitude:param('Amplitude',0,100,1,45), frequency:param('Frequency',1,30,1,10), speed:param('Speed',0,12,.1,2) }],
    ['spatial', 'pixelStretch', 'Pixel stretch', { amount:param('Amount',0,100,1,55), axis:param('Axis',0,1,1,0) }],
    ['spatial', 'mosaicExplosion', 'Mosaic explosion', { size:param('Tile size',4,80,1,20), spread:param('Spread',0,100,1,45), mix:param('Mix',0,100,1,100) }],
    ['spatial', 'kaleidoscope', 'Kaleidoscope / mirror', { segments:param('Segments',2,16,1,6), rotation:param('Rotation',0,360,1,0), mix:param('Mix',0,100,1,100) }],
    ['spatial', 'feedbackZoom', 'Feedback zoom', { amount:param('Amount',0,100,1,55), zoom:param('Zoom',.85,1.15,.001,.965), rotation:param('Rotation',-12,12,.1,1.5) }],
    ['spatial', 'droste', 'Droste feedback', { depth:param('Depth',1,10,1,5), scale:param('Scale',.35,.9,.01,.7), rotation:param('Rotation',-20,20,.1,2) }],
    ['spatial', 'edgeFeedback', 'Edge feedback', { amount:param('Amount',0,100,1,55), offset:param('Offset',1,30,1,8) }],
    ['analog', 'vhsTracking', 'VHS tracking destruction', { intensity:param('Intensity',0,100,1,55), tracking:param('Tracking',0,100,1,45), noise:param('Noise',0,100,1,25) }],
    ['analog', 'scanlines', 'Scanlines', { amount:param('Amount',0,100,1,45), size:param('Size',1,8,1,2) }],
    ['analog', 'horizontalTearing', 'Horizontal tearing', { amount:param('Amount',0,100,1,55), bands:param('Bands',2,40,1,16) }],
    ['analog', 'verticalRoll', 'Vertical roll', { amount:param('Amount',0,100,1,50), speed:param('Speed',0,12,.1,3) }],
    ['analog', 'crtCollapse', 'CRT collapse / distortion', { amount:param('Amount',0,100,1,55), curve:param('Curve',0,100,1,35), collapse:param('Collapse',0,100,1,20) }],
    ['analog', 'asciiCrush', 'ASCII / character crush', { size:param('Character size',3,20,1,8), contrast:param('Contrast',0,100,1,70), mix:param('Mix',0,100,1,100) }]
  ].map(([category,id,name,params]) => ({ category,id,name,params }));

  const definitions = Object.fromEntries(registry.map(effect => [effect.id, effect]));
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const makeCanvas = (w,h) => { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
  const copyCanvas = source => { const c=makeCanvas(source.width,source.height); c.getContext('2d').drawImage(source,0,0); return c; };
  const seeded = n => { const x=Math.sin(n*12.9898+78.233)*43758.5453; return x-Math.floor(x); };

  function createEffect(type){
    const def=definitions[type];
    if(!def) return null;
    return { id:`fx-${Math.random().toString(36).slice(2,9)}`, type, enabled:true, params:Object.fromEntries(Object.entries(def.params).map(([k,p])=>[k,p.value])), automation:{} };
  }

  function normalizeEffect(effect){
    const def=definitions[effect.type];
    if(!def) return effect;
    effect.params=effect.params||{}; effect.automation=effect.automation||{};
    for(const [key,p] of Object.entries(def.params)) if(effect.params[key]===undefined) effect.params[key]=p.value;
    if(effect.enabled===undefined) effect.enabled=true;
    return effect;
  }

  function interpolate(a,b,t,mode){
    if(mode==='hold') return a;
    if(mode==='ease') t=t*t*(3-2*t);
    if(mode==='bezier') t=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    return a+(b-a)*t;
  }

  function evaluateAutomation(automation, normalizedTime, fallback){
    if(!automation?.points?.length) return fallback;
    const points=[...automation.points].sort((a,b)=>a.time-b.time);
    const t=clamp(normalizedTime,0,1);
    if(t<=points[0].time) return points[0].value;
    if(t>=points.at(-1).time) return points.at(-1).value;
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1];
      if(t>=a.time&&t<=b.time) return interpolate(a.value,b.value,(t-a.time)/Math.max(.0001,b.time-a.time),automation.interpolation||'linear');
    }
    return fallback;
  }

  function value(effect,key,time,item){
    const base=effect.params[key];
    const local=(time-item.start)/Math.max(.001,item.end-item.start);
    return evaluateAutomation(effect.automation?.[key],local,base);
  }

  function adjustSourceTime(item,time,fps){
    let local=time-item.start;
    for(const effect of item.effects||[]){
      if(!effect.enabled) continue;
      if(effect.type==='frameRepeat') local=Math.floor(local*fps/Math.max(1,value(effect,'frames',time,item)))*Math.max(1,value(effect,'frames',time,item))/fps;
      if(effect.type==='frameSkipping') local=Math.floor(local*fps/Math.max(1,value(effect,'interval',time,item)))*Math.max(1,value(effect,'interval',time,item))/fps;
      if(effect.type==='frameShuffle'){
        const window=Math.max(2,Math.round(value(effect,'window',time,item))),frame=Math.floor(local*fps),group=Math.floor(frame/window),inside=frame%window;
        local=(group*window+Math.floor(seeded(group+effect.id.length)*window+inside)%window)/fps;
      }
      if(effect.type==='timeDisplacement') local+=Math.sin(local*value(effect,'frequency',time,item))*value(effect,'amount',time,item)/500;
    }
    return item.start+clamp(local,0,item.end-item.start);
  }

  function withPixels(canvas, fn){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    try{ const image=ctx.getImageData(0,0,canvas.width,canvas.height); fn(image.data,canvas.width,canvas.height); ctx.putImageData(image,0,0); }catch(_){ /* local media only; defensive */ }
  }

  function blendOriginal(canvas, original, mix){
    if(mix>=.999) return;
    const result=copyCanvas(canvas),ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=1;ctx.drawImage(original,0,0);ctx.globalAlpha=mix;ctx.drawImage(result,0,0);ctx.globalAlpha=1;
  }

  function applyPixelSort(canvas,intensity,threshold,vertical){
    if(intensity<=0) return;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    try{
      const im=ctx.getImageData(0,0,canvas.width,canvas.height),d=im.data,w=canvas.width,h=canvas.height,step=Math.max(1,Math.round(6-intensity/20));
      const lines=vertical?w:h,length=vertical?h:w;
      for(let line=0;line<lines;line+=step){
        let run=[];
        const flush=()=>{if(run.length<3){run=[];return}const pixels=run.map(pos=>{const i=vertical?(pos*w+line)*4:(line*w+pos)*4;return [d[i],d[i+1],d[i+2],d[i+3]]}).sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));run.forEach((pos,n)=>{const i=vertical?(pos*w+line)*4:(line*w+pos)*4,p=pixels[n];d[i]=p[0];d[i+1]=p[1];d[i+2]=p[2];d[i+3]=p[3]});run=[]};
        for(let pos=0;pos<length;pos++){const i=vertical?(pos*w+line)*4:(line*w+pos)*4,lum=(d[i]+d[i+1]+d[i+2])/3;if(lum>threshold&&seeded(line*991+pos)>1-intensity/100)run.push(pos);else flush()}flush();
      }
      ctx.putImageData(im,0,0);
    }catch(_){}
  }

  function applyRGB(canvas,amount,angle,split){
    if(amount<=0) return;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    try{
      const im=ctx.getImageData(0,0,canvas.width,canvas.height),src=new Uint8ClampedArray(im.data),d=im.data,w=canvas.width,h=canvas.height,dx=Math.round(Math.cos(angle*Math.PI/180)*amount),dy=Math.round(Math.sin(angle*Math.PI/180)*amount),m=split/100;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,r=((clamp(y+dy,0,h-1)*w+clamp(x+dx,0,w-1))*4),b=((clamp(y-dy,0,h-1)*w+clamp(x-dx,0,w-1))*4);d[i]=src[i]*(1-m)+src[r]*m;d[i+2]=src[i+2]*(1-m)+src[b+2]*m}
      ctx.putImageData(im,0,0);
    }catch(_){}
  }

  function drawBands(canvas,amount,bands,time,vertical=false,seed=0){
    const src=copyCanvas(canvas),ctx=canvas.getContext('2d'),count=Math.max(2,Math.round(bands));ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<count;i++){
      if(vertical){const x=Math.floor(i*canvas.width/count),bw=Math.ceil(canvas.width/count),shift=(seeded(i+time*17+seed)-.5)*amount;ctx.drawImage(src,x,0,bw,canvas.height,x,shift,bw,canvas.height)}
      else{const y=Math.floor(i*canvas.height/count),bh=Math.ceil(canvas.height/count),shift=(seeded(i+time*17+seed)-.5)*amount;ctx.drawImage(src,0,y,canvas.width,bh,shift,y,canvas.width,bh)}
    }
  }

  function blockDisplace(canvas,amount,size,density,time,seed=0){
    const src=copyCanvas(canvas),ctx=canvas.getContext('2d'),s=Math.max(2,Math.round(size));
    for(let y=0;y<canvas.height;y+=s)for(let x=0;x<canvas.width;x+=s){const r=seeded(x*3+y*7+Math.floor(time*30)+seed);if(r>density/100)continue;const dx=(seeded(x+y+seed)-.5)*amount,dy=(seeded(x*11+y+seed)-.5)*amount*.45;ctx.drawImage(src,x,y,s,s,x+dx,y+dy,s,s)}
  }

  function feedback(canvas,amount,zoom,rotation,depth=5){
    const src=copyCanvas(canvas),ctx=canvas.getContext('2d');
    for(let i=1;i<=depth;i++){ctx.save();ctx.globalAlpha=(amount/100)*(1-i/(depth+1))*.55;ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180*i);const scale=Math.pow(zoom,i);ctx.scale(scale,scale);ctx.drawImage(src,-canvas.width/2,-canvas.height/2);ctx.restore()}
  }

  function resolutionCrush(canvas,size,mix){
    const original=copyCanvas(canvas),small=makeCanvas(Math.max(1,Math.round(canvas.width/size)),Math.max(1,Math.round(canvas.height/size))),sctx=small.getContext('2d');sctx.imageSmoothingEnabled=false;sctx.drawImage(canvas,0,0,small.width,small.height);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(small,0,0,canvas.width,canvas.height);blendOriginal(canvas,original,mix/100);ctx.imageSmoothingEnabled=true;
  }

  function applyColorEffect(canvas,effect,time,item){
    const type=effect.type,v=k=>value(effect,k,time,item),original=copyCanvas(canvas),mix=('mix' in effect.params?v('mix'):100)/100;
    withPixels(canvas,(d,w,h)=>{
      const levels=type==='posterization'?Math.round(v('levels')):type==='colorQuantization'?Math.round(v('colors')):0;
      for(let i=0;i<d.length;i+=4){let r=d[i],g=d[i+1],b=d[i+2];
        if(levels){const s=255/Math.max(1,levels-1);r=Math.round(r/s)*s;g=Math.round(g/s)*s;b=Math.round(b/s)*s}
        if(type==='thresholdCrush'){const z=(r+g+b)/3>=v('threshold')?255:0;r=g=b=z}
        if(type==='solarization'){const t=v('threshold');r=r>t?255-r:r;g=g>t?255-g:g;b=b>t?255-b:b}
        if(type==='channelSwap'){const mode=Math.round(v('mode'))%6,[rr,gg,bb]=[r,g,b];if(mode===0)[r,g,b]=[rr,bb,gg];if(mode===1)[r,g,b]=[gg,bb,rr];if(mode===2)[r,g,b]=[bb,rr,gg];if(mode===3)[r,g,b]=[bb,gg,rr];if(mode===4)[r,g,b]=[gg,rr,bb];if(mode===5)[r,g,b]=[rr,gg,bb]}
        if(type==='negativeFlash'&&Math.sin(time*v('rate')*Math.PI*2)>1-v('amount')/50){r=255-r;g=255-g;b=255-b}
        if(type==='paletteCycle'){const phase=time*v('speed')*40,amt=v('amount')/100,[rr,gg,bb]=[r,g,b];r=rr*(1-amt)+((gg+phase)%256)*amt;g=gg*(1-amt)+((bb+phase*1.3)%256)*amt;b=bb*(1-amt)+((rr+phase*1.7)%256)*amt}
        if(type==='hueMelt'){const y=Math.floor(i/4/w),phase=Math.sin(y/h*v('bands')*Math.PI*2+time*v('speed'))*v('amount')/100,[rr,gg,bb]=[r,g,b];r=clamp(rr+phase*gg,0,255);g=clamp(gg+phase*bb,0,255);b=clamp(bb+phase*rr,0,255)}
        if(type==='dithering'){const x=(i/4)%w,y=Math.floor(i/4/w),matrix=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],bias=(matrix[(y%4)*4+(x%4)]/16-.5)*v('amount')*2;r=r+bias;g=g+bias;b=b+bias}
        if(type==='dataBend'){const n=seeded(i/4+v('seed')+Math.floor(time*30));if(n>1-v('corruption')/700){r=(g+v('streak')*2)%256;g=(b+r)%256;b=(r+v('seed')*7)%256}}
        d[i]=clamp(r,0,255);d[i+1]=clamp(g,0,255);d[i+2]=clamp(b,0,255);
      }
    });
    blendOriginal(canvas,original,mix);
  }

  function applyEffect(canvas,effect,time,item){
    normalizeEffect(effect); if(!effect.enabled) return;
    const v=k=>value(effect,k,time,item),type=effect.type,ctx=canvas.getContext('2d');
    if(['posterization','thresholdCrush','colorQuantization','dithering','dataBend','paletteCycle','hueMelt','solarization','channelSwap','negativeFlash'].includes(type)){applyColorEffect(canvas,effect,time,item);return}
    if(type==='pixelSort'){applyPixelSort(canvas,v('intensity'),v('threshold'),v('direction')>.5);return}
    if(type==='rgbDisplacement'){applyRGB(canvas,v('amount'),v('angle'),v('split'));return}
    if(type==='resolutionCrush'){resolutionCrush(canvas,v('pixelSize'),v('mix'));return}
    if(type==='datamosh'){blockDisplace(canvas,v('intensity')*.9,v('block'),v('persistence'),time,effect.id.length);drawBands(canvas,v('bleed')*.7,Math.max(3,v('block')/2),time,false,9);return}
    if(type==='compressionGlitch'){blockDisplace(canvas,v('jitter'),Math.max(3,canvas.width/v('blocks')),v('intensity'),time,17);return}
    if(type==='blockDisplacement'){blockDisplace(canvas,v('amount'),v('blockSize'),v('density'),time,23);return}
    if(type==='frameSmear'||type==='pixelStretch'){drawBands(canvas,v('intensity')||v('amount'),v('length')||18,time,(v('direction')||v('axis'))>.5,31);return}
    if(type==='scanlineDisplacement'||type==='horizontalTearing'){drawBands(canvas,v('amount'),v('frequency')||v('bands'),time,false,41);return}
    if(type==='temporalSlicing'||type==='slitScan'){drawBands(canvas,v('offset')||v('travel'),v('slices'),time,true,53);return}
    if(type==='waveWarp'){
      const src=copyCanvas(canvas),amp=v('amplitude'),freq=v('frequency'),speed=v('speed');ctx.clearRect(0,0,canvas.width,canvas.height);for(let y=0;y<canvas.height;y+=2){const dx=Math.sin(y/canvas.height*freq*Math.PI*2+time*speed)*amp;ctx.drawImage(src,0,y,canvas.width,2,dx,y,canvas.width,2)}return;
    }
    if(type==='frameFeedback'){feedback(canvas,v('amount'),v('zoom'),v('rotation'),6);return}
    if(type==='feedbackZoom'){feedback(canvas,v('amount'),v('zoom'),v('rotation'),7);return}
    if(type==='droste'){feedback(canvas,78,v('scale'),v('rotation'),Math.round(v('depth')));return}
    if(type==='motionEcho'||type==='temporalTrails'||type==='colorTrails'){
      const src=copyCanvas(canvas),count=Math.round(v('echoes')||v('steps')||6),amount=v('amount')/100,spacing=v('spacing')||8;for(let i=1;i<=count;i++){ctx.save();ctx.globalAlpha=amount*(1-i/(count+1))*.6;ctx.globalCompositeOperation=type==='colorTrails'?'screen':'source-over';ctx.drawImage(src,i*spacing/count*Math.sin(time*3),i*spacing/count*Math.cos(time*2));ctx.restore()}return;
    }
    if(type==='mosaicExplosion'){
      const original=copyCanvas(canvas),s=Math.max(3,Math.round(v('size'))),spread=v('spread');ctx.clearRect(0,0,canvas.width,canvas.height);for(let y=0;y<canvas.height;y+=s)for(let x=0;x<canvas.width;x+=s){const dx=(x-canvas.width/2)/canvas.width*spread,dy=(y-canvas.height/2)/canvas.height*spread;ctx.drawImage(original,x,y,s,s,x+dx,y+dy,s,s)}blendOriginal(canvas,original,v('mix')/100);return;
    }
    if(type==='kaleidoscope'){
      const original=copyCanvas(canvas),segments=Math.round(v('segments')),angle=Math.PI*2/segments;ctx.clearRect(0,0,canvas.width,canvas.height);for(let i=0;i<segments;i++){ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(i*angle+v('rotation')*Math.PI/180);if(i%2)ctx.scale(-1,1);ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,Math.max(canvas.width,canvas.height),-angle/2,angle/2);ctx.clip();ctx.drawImage(original,-canvas.width/2,-canvas.height/2);ctx.restore()}blendOriginal(canvas,original,v('mix')/100);return;
    }
    if(type==='edgeFeedback'){
      const src=copyCanvas(canvas),off=v('offset');ctx.save();ctx.globalCompositeOperation='difference';ctx.globalAlpha=v('amount')/100;ctx.drawImage(src,off,0);ctx.drawImage(src,-off,0);ctx.restore();return;
    }
    if(type==='chromaticBloom'){
      const src=copyCanvas(canvas);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=v('intensity')/100;ctx.filter=`blur(${v('radius')}px)`;ctx.drawImage(src,0,0);ctx.restore();return;
    }
    if(type==='scanlines'){
      ctx.save();ctx.globalAlpha=v('amount')/100*.75;ctx.fillStyle='#000';const size=Math.max(1,Math.round(v('size')));for(let y=0;y<canvas.height;y+=size*2)ctx.fillRect(0,y,canvas.width,size);ctx.restore();return;
    }
    if(type==='vhsTracking'){
      drawBands(canvas,v('tracking'),Math.max(4,v('intensity')/4),time,false,67);withPixels(canvas,(d)=>{for(let i=0;i<d.length;i+=4)if(seeded(i+Math.floor(time*30))>1-v('noise')/1000){const n=(seeded(i*2)-.5)*90;d[i]+=n;d[i+1]+=n;d[i+2]+=n}});return;
    }
    if(type==='verticalRoll'){
      const src=copyCanvas(canvas),shift=Math.round((time*v('speed')*canvas.height+v('amount')/100*canvas.height)%canvas.height);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(src,0,shift);ctx.drawImage(src,0,shift-canvas.height);return;
    }
    if(type==='crtCollapse'){
      const src=copyCanvas(canvas),amount=v('amount')/100,collapse=v('collapse')/100,margin=canvas.width*v('curve')/500;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.filter=`contrast(${1+amount}) saturate(${1+amount*.5})`;ctx.drawImage(src,margin,canvas.height*collapse*.45,canvas.width-margin*2,canvas.height*(1-collapse*.9));ctx.restore();return;
    }
    if(type==='asciiCrush'){
      const original=copyCanvas(canvas),size=Math.round(v('size')),small=makeCanvas(Math.max(1,Math.floor(canvas.width/size)),Math.max(1,Math.floor(canvas.height/size)));small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.filter=`grayscale(1) contrast(${1+v('contrast')/35})`;ctx.drawImage(small,0,0,canvas.width,canvas.height);ctx.filter='none';blendOriginal(canvas,original,v('mix')/100);ctx.imageSmoothingEnabled=true;
    }
  }

  function applyStack(canvas,effects,time,item){ for(const effect of effects||[]) applyEffect(canvas,effect,time,item); return canvas; }

  window.VFXEngine={registry,definitions,createEffect,normalizeEffect,evaluateAutomation,value,adjustSourceTime,applyEffect,applyStack,makeCanvas,copyCanvas,clamp};
})();
