const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const VFX=window.VFXEngine;
const TRANSITIONS=[
  ['crossfade','Crossfade'],['black','Fade through black'],['white','Fade through white'],['blur','Blur dissolve'],['wipe','Directional wipe'],['push','Push / slide'],['zoom','Zoom blend'],['motion','Motion-blur transition'],['flash','Exposure / light flash'],['displace','Displacement blend'],
  ['datamosh','Datamosh transition'],['frameSmear','Frame-smear transition'],['rgbGlitch','RGB / glitch transition'],['pixelSort','Pixel-sort transition'],['feedback','Feedback transition']
];
const COLORS=['#ff5ca8','#64a9ff','#ff9a52','#a88bff','#d5ff3f','#52d6bd'];
const state={
  project:{name:'Untitled Rift',format:'9:16',fps:30,width:1080,height:1920,maxDuration:60},
  assets:[],tracks:[{id:'track-1',kind:'visual',name:'VIDEO 01',clips:[]}],selected:null,selectedTransition:null,
  playing:false,time:0,history:[],future:[],lastSnapshot:null,snap:true,zoom:80,media:new Map(),renderVersion:0,
  automationClipboard:null
};
let raf=0,lastTick=0,toastTimer=0;
const frameCache=new Map();
const uid=(prefix='id')=>`${prefix}-${Math.random().toString(36).slice(2,9)}`;
const clamp=VFX.clamp;
const formatTime=t=>{const m=Math.floor(t/60),s=Math.floor(t%60),cs=Math.floor((t%1)*100);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`};
const totalDuration=()=>Math.min(60,Math.max(0,...state.tracks.flatMap(t=>t.clips.map(c=>c.end))));
const maxTransitionDuration=(a,b)=>Math.max(.01,Math.min(2,a.end-a.start,b.end-b.start));
const getTrackFor=item=>state.tracks.find(track=>track.clips.includes(item));
const getSelectedItem=()=>state.tracks.flatMap(t=>t.clips).find(c=>c.id===state.selected);

function toast(message){const el=$('#toast');clearTimeout(toastTimer);el.textContent=message;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),1700)}
function invalidate(){state.renderVersion++;frameCache.clear()}
function snapshot(){return JSON.stringify({project:state.project,tracks:state.tracks,assets:state.assets})}
function commit(){const current=snapshot();if(state.lastSnapshot&&state.lastSnapshot!==current)state.history.push(state.lastSnapshot);if(state.history.length>40)state.history.shift();state.lastSnapshot=current;state.future=[];invalidate();render()}
function restore(raw){const data=JSON.parse(raw);state.project=data.project;state.tracks=data.tracks;state.assets=data.assets||[];normalizeProject();state.lastSnapshot=snapshot();state.selected=null;state.selectedTransition=null;invalidate();render()}
function normalizeProject(){
  state.tracks=state.tracks||[];
  state.tracks.forEach(track=>{track.kind=track.kind||'visual';track.clips=track.clips||[];track.clips.forEach(item=>{item.kind=item.kind||(track.kind==='adjustment'?'adjustment':'clip');item.effects=(item.effects||[]).map(VFX.normalizeEffect);item.automations=item.automations||[];item.transitions=item.transitions||[]})});
  if(!state.tracks.length)state.tracks=[{id:uid('track'),kind:'visual',name:'VIDEO 01',clips:[]}];
}
function setFormat(format){const dims={'9:16':[1080,1920],'16:9':[1920,1080],'1:1':[1080,1080]};[state.project.width,state.project.height]=dims[format];state.project.format=format;const canvas=$('#preview'),ratio=state.project.width/state.project.height;if(ratio<1){canvas.height=960;canvas.width=Math.round(960*ratio)}else{canvas.width=960;canvas.height=Math.round(960/ratio)}invalidate();render()}

function reconcileTransitions(track){
  if(track.kind==='adjustment')return;
  track.clips.sort((a,b)=>a.start-b.start);
  track.clips.forEach((clip,index)=>{
    const next=track.clips[index+1],adjacent=next&&Math.abs(clip.end-next.start)<.011;
    if(!adjacent){clip.transitions=(clip.transitions||[]).filter(x=>x.manual&&next&&x.to===next.id);return}
    if(clip.blockedBoundary===next.id){clip.transitions=(clip.transitions||[]).filter(x=>x.manual);return}
    if(clip.blockedBoundary&&clip.blockedBoundary!==next.id)delete clip.blockedBoundary;
    let transition=(clip.transitions||[]).find(x=>x.to===next.id);
    if(!transition){transition={id:uid('tr'),to:next.id,preset:'crossfade',duration:.4,params:{},manual:false};clip.transitions=[transition]}
    else clip.transitions=[transition];
    transition.duration=Math.min(transition.duration,maxTransitionDuration(clip,next));
  });
}
function transitionBetween(clip,next){return (clip.transitions||[]).find(x=>x.to===next.id)}
function activeTransition(track,time){for(let i=0;i<track.clips.length-1;i++){const clip=track.clips[i],next=track.clips[i+1],transition=transitionBetween(clip,next);if(!transition)continue;const duration=Math.min(transition.duration,maxTransitionDuration(clip,next)),boundary=clip.end;if(time>=boundary-duration/2&&time<=boundary+duration/2)return {clip,next,transition,p:clamp((time-(boundary-duration/2))/duration,0,1)}}return null}
function getTransition(){for(const track of state.tracks)for(const clip of track.clips)for(const transition of clip.transitions||[])if(transition.id===state.selectedTransition)return {x:transition,c:clip,t:track}}

function addAsset(file){
  const type=file.type.startsWith('video')?'video':file.type.startsWith('image')?'image':file.name.match(/\.(woff2?|ttf|otf)$/i)?'font':'graphic';
  let asset=state.assets.find(existing=>existing.name===file.name&&existing.type===type&&!state.media.has(existing.id));
  if(asset){asset.size=file.size;asset.url=URL.createObjectURL(file)}else{asset={id:uid('asset'),name:file.name,type,size:file.size,url:URL.createObjectURL(file),duration:0};state.assets.push(asset)}
  if(type==='video'){const video=document.createElement('video');video.src=asset.url;video.muted=true;video.playsInline=true;video.preload='auto';video.onloadedmetadata=()=>{asset.duration=Math.min(60,video.duration||3);state.media.set(asset.id,video);render()};state.media.set(asset.id,video)}
  else if(type==='image'||type==='graphic'){const image=new Image();image.src=asset.url;image.onload=render;state.media.set(asset.id,image)}
  else state.media.set(asset.id,file);
  render();
}
function importFiles(files){[...files].forEach(addAsset);if(files.length)toast(`${files.length} local asset${files.length===1?'':'s'} imported — audio ignored`)}
function createClip(asset,trackIndex=0){
  const visualTracks=state.tracks.filter(t=>t.kind==='visual'),track=visualTracks[trackIndex]||visualTracks[0]||state.tracks.find(t=>t.kind==='visual');
  if(!track)return;const start=track.clips.length?Math.max(...track.clips.map(c=>c.end)):0,duration=asset.type==='video'?(asset.duration||3):3;
  if(start+duration>60)return toast('Projects are capped at 60 seconds');
  const clip={id:uid('clip'),kind:'clip',assetId:asset.id,name:asset.name.replace(/\.[^/.]+$/,''),start,end:start+duration,sourceStart:0,sourceEnd:duration,x:0,y:0,scale:1,rotation:0,opacity:1,color:COLORS[state.assets.indexOf(asset)%COLORS.length],effects:[],automations:[],transitions:[]};
  track.clips.push(clip);reconcileTransitions(track);state.selected=clip.id;state.selectedTransition=null;commit();
}

function createEffect(type){const item=getSelectedItem(),effect=VFX.createEffect(type);if(!item||!effect)return;item.effects=item.effects||[];item.effects.push(effect);commit();toast(`${VFX.definitions[type].name} added`)}
function moveEffect(effectId,direction){const item=getSelectedItem(),index=item?.effects.findIndex(x=>x.id===effectId);if(index<0)return;const next=clamp(index+direction,0,item.effects.length-1);[item.effects[index],item.effects[next]]=[item.effects[next],item.effects[index]];commit()}
function duplicateEffect(effectId){const item=getSelectedItem(),effect=item?.effects.find(x=>x.id===effectId);if(!effect)return;const copy=JSON.parse(JSON.stringify(effect));copy.id=uid('fx');for(const automation of Object.values(copy.automation||{}))automation.id=uid('auto');item.effects.splice(item.effects.indexOf(effect)+1,0,copy);commit()}
function resetEffect(effectId){const item=getSelectedItem(),effect=item?.effects.find(x=>x.id===effectId),def=effect&&VFX.definitions[effect.type];if(!def)return;effect.params=Object.fromEntries(Object.entries(def.params).map(([key,p])=>[key,p.value]));effect.automation={};commit()}
function removeEffect(effectId){const item=getSelectedItem();if(!item)return;item.effects=item.effects.filter(x=>x.id!==effectId);commit()}
function createAutomation(effect,paramKey){
  const item=getSelectedItem(),def=VFX.definitions[effect.type]?.params[paramKey];if(!item||!def)return;
  effect.automation=effect.automation||{};
  if(!effect.automation[paramKey])effect.automation[paramKey]={id:uid('auto'),interpolation:'linear',points:[{id:uid('pt'),time:0,value:effect.params[paramKey]},{id:uid('pt'),time:1,value:effect.params[paramKey]}]};
  commit();toast(`${def.label} automation created`);
}
function automationEntries(item){const rows=[];for(const effect of item?.effects||[])for(const [paramKey,automation] of Object.entries(effect.automation||{}))if(automation)rows.push({item,effect,paramKey,automation,definition:VFX.definitions[effect.type].params[paramKey]});return rows}
function removeAutomation(effect,paramKey){delete effect.automation[paramKey];commit()}

function renderEffectPicker(){
  const picker=$('#effect-picker');if(picker.dataset.ready)return;
  const categories={digital:'CORE DIGITAL DESTRUCTION',color:'COLOR / CHANNEL DESTRUCTION',temporal:'TEMPORAL EFFECTS',spatial:'SPATIAL DESTRUCTION',analog:'ANALOG / DISPLAY'};
  picker.innerHTML='<option value="">Choose an effect…</option>';
  for(const [category,label] of Object.entries(categories)){const group=document.createElement('optgroup');group.label=label;VFX.registry.filter(x=>x.category===category).forEach(effect=>{const option=document.createElement('option');option.value=effect.id;option.textContent=effect.name;group.append(option)});picker.append(group)}
  picker.dataset.ready='1';
}
function renderEffectStack(item){
  const stack=$('#effect-stack');stack.innerHTML='';const active=(item.effects||[]).filter(x=>x.enabled).length;$('#effect-count').textContent=`${active} ACTIVE`;
  if(!item.effects?.length){stack.innerHTML='<div class="effect-empty">NO EFFECTS YET<br>Stack simple corruption tools here.</div>';return}
  item.effects.forEach((effect,index)=>{
    VFX.normalizeEffect(effect);const def=VFX.definitions[effect.type],card=document.createElement('section');card.className=`effect-card${effect.enabled?'':' disabled'}`;
    const head=document.createElement('div');head.className='effect-head';head.innerHTML=`<input class="effect-toggle" type="checkbox" ${effect.enabled?'checked':''}><strong>${index+1}. ${def.name}</strong><button class="effect-action up" title="Move up">↑</button><button class="effect-action down" title="Move down">↓</button><button class="effect-action duplicate" title="Duplicate">⧉</button><button class="effect-action reset" title="Reset">↺</button><button class="effect-action remove" title="Remove">×</button>`;
    head.querySelector('.effect-toggle').onchange=e=>{effect.enabled=e.target.checked;commit()};head.querySelector('.up').onclick=()=>moveEffect(effect.id,-1);head.querySelector('.down').onclick=()=>moveEffect(effect.id,1);head.querySelector('.duplicate').onclick=()=>duplicateEffect(effect.id);head.querySelector('.reset').onclick=()=>resetEffect(effect.id);head.querySelector('.remove').onclick=()=>removeEffect(effect.id);card.append(head);
    const body=document.createElement('div');body.className='effect-body';
    for(const [key,p] of Object.entries(def.params)){
      const row=document.createElement('div');row.className='param-row';row.title='Right-click to create automation';const automated=!!effect.automation?.[key];row.innerHTML=`<label>${p.label}</label><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${effect.params[key]}"><output>${formatParam(effect.params[key],p.step)}</output><button class="automation-button${automated?' active':''}" title="Create automation">A</button>`;
      const range=row.querySelector('input'),output=row.querySelector('output');range.oninput=e=>{effect.params[key]=+e.target.value;output.textContent=formatParam(effect.params[key],p.step);invalidate();drawFrame()};range.onchange=commit;row.oncontextmenu=e=>{e.preventDefault();createAutomation(effect,key)};row.querySelector('.automation-button').onclick=()=>createAutomation(effect,key);body.append(row);
    }
    card.append(body);stack.append(card);
  });
}
function formatParam(value,step){return step<1?Number(value).toFixed(step<.01?3:2):Math.round(value)}
function renderAutomationSummary(item){const list=$('#automation-list');list.innerHTML='';const entries=automationEntries(item);if(!entries.length){list.innerHTML='<div class="effect-empty">Automation lanes appear below the selected timeline item.</div>';return}entries.forEach(({effect,paramKey,definition})=>{const row=document.createElement('div');row.className='automation-summary';row.innerHTML=`<span>${VFX.definitions[effect.type].name} · ${definition.label}</span><button title="Reset automation">×</button>`;row.querySelector('button').onclick=()=>removeAutomation(effect,paramKey);list.append(row)})}

function renderInspector(){
  renderEffectPicker();const item=getSelectedItem(),transition=getTransition();
  $('#project-inspector').classList.toggle('hidden',!!item||!!transition);$('#clip-inspector').classList.toggle('hidden',!item||!!transition);$('#transition-inspector').classList.toggle('hidden',!transition);$('#inspector-kind').textContent=transition?'TRANSITION':item?(item.kind==='adjustment'?'ADJUSTMENT':'CLIP'):'PROJECT';
  $('#project-name').value=state.project.name;$('#project-format').value=state.project.format;$('#project-fps').value=state.project.fps;
  if(item){$('#clip-name').textContent=item.name;$('#clip-color').style.background=item.color||'#61e49d';$('#transform-controls').classList.toggle('hidden',item.kind==='adjustment');if(item.kind!=='adjustment')[['clip-x','x'],['clip-y','y'],['clip-scale','scale'],['clip-rotation','rotation'],['clip-opacity','opacity']].forEach(([id,key])=>$('#'+id).value=item[key]);renderEffectStack(item);renderAutomationSummary(item)}
  if(transition){const select=$('#transition-preset');select.innerHTML=TRANSITIONS.map(([value,name])=>`<option value="${value}">${name}</option>`).join('');select.value=transition.x.preset;const next=transition.t.clips[transition.t.clips.indexOf(transition.c)+1],max=maxTransitionDuration(transition.c,next);$('#transition-duration').max=max;$('#transition-duration').value=Math.min(transition.x.duration,max);$('#transition-duration-output').textContent=Math.min(transition.x.duration,max).toFixed(2)+'s'}
}

function renderBin(){
  const bin=$('#media-bin');$('#media-count').textContent=`${state.assets.length} asset${state.assets.length===1?'':'s'}`;
  if(!state.assets.length){bin.className='media-bin empty-state';bin.innerHTML='<div class="drop-symbol">↓</div><b>Drop media here</b><span>Video, images, GIFs, graphics, fonts</span>';return}
  bin.className='media-bin';bin.innerHTML='';
  state.assets.forEach(asset=>{const card=document.createElement('div');card.className='media-card';card.draggable=true;card.dataset.id=asset.id;const media=state.media.get(asset.id);if(asset.type!=='font'&&media?.src){const image=document.createElement('img');image.className='media-thumb';image.src=asset.url;card.append(image)}else{const thumb=document.createElement('div');thumb.className='media-thumb';thumb.style.display='grid';thumb.style.placeItems='center';thumb.textContent=asset.type==='font'?'Aa':asset.type==='video'?'▶':'▧';card.append(thumb)}const meta=document.createElement('div');meta.className='media-meta';meta.innerHTML=`<strong>${asset.name}</strong><small>${asset.type.toUpperCase()}${asset.duration?` · ${asset.duration.toFixed(1)}s`:''}</small>`;card.append(meta);card.ondblclick=()=>createClip(asset);card.ondragstart=e=>e.dataTransfer.setData('asset',asset.id);bin.append(card)});
}

function renderTimeline(){
  const tracks=$('#tracks'),scale=state.zoom;$('#timeline').style.setProperty('--timeline-scale',scale+'px');$('#ruler').style.setProperty('--timeline-scale',scale+'px');tracks.innerHTML='';
  state.tracks.forEach((track,trackIndex)=>{
    reconcileTransitions(track);const row=document.createElement('div');row.className=`track-row${track.kind==='adjustment'?' adjustment-row':''}`;row.dataset.track=track.id;const label=document.createElement('div');label.className='track-label';label.textContent=track.name;row.append(label);const content=document.createElement('div');content.className='track-content';content.dataset.track=track.id;
    track.clips.forEach((item,index)=>{
      const block=document.createElement('div');block.className=`clip-block${item.kind==='adjustment'?' adjustment-block':''}${item.id===state.selected?' selected':''}`;block.draggable=true;block.dataset.item=item.id;block.style.left=item.start*scale+'px';block.style.width=Math.max(8,(item.end-item.start)*scale)+'px';block.style.borderColor=item.color||'#61e49d';block.innerHTML=`<span class="clip-label">${item.name}</span><span class="clip-time">${formatTime(item.end-item.start)} · ${(item.effects||[]).length} FX</span>`;block.onclick=e=>{e.stopPropagation();state.selected=item.id;state.selectedTransition=null;render()};block.oncontextmenu=e=>{e.preventDefault();if(confirm(`Delete ${item.name}?`)){track.clips=track.clips.filter(x=>x.id!==item.id);state.selected=null;reconcileTransitions(track);commit()}};content.append(block);
      if(track.kind==='visual')for(const transition of item.transitions||[]){const next=track.clips[index+1];if(!next||transition.to!==next.id)continue;const duration=Math.min(transition.duration,maxTransitionDuration(item,next)),marker=document.createElement('div');marker.className=`transition-block${transition.id===state.selectedTransition?' selected':''}`;marker.style.left=(item.end-duration/2)*scale+'px';marker.style.width=Math.max(10,duration*scale)+'px';marker.title=transition.preset;marker.onclick=e=>{e.stopPropagation();state.selectedTransition=transition.id;state.selected=null;render()};content.append(marker)}
    });
    content.ondragover=e=>e.preventDefault();content.ondrop=e=>handleTimelineDrop(e,track,trackIndex);row.append(content);tracks.append(row);
    const selected=track.clips.find(x=>x.id===state.selected);if(selected)renderAutomationLanes(tracks,selected);
  });
  $('#playhead').style.left=(90+state.time*scale)+'px';
}
function renderAutomationLanes(container,item){
  for(const entry of automationEntries(item)){
    const {effect,paramKey,automation,definition}=entry,row=document.createElement('div');row.className='automation-lane-row';const label=document.createElement('div');label.className='automation-lane-label';label.innerHTML=`<b>${definition.label}</b><div class="lane-tools"><select title="Curve"><option>hold</option><option>linear</option><option>ease</option><option>bezier</option></select><button class="copy">COPY</button><button class="paste">PASTE</button><button class="reset">RESET</button></div>`;const select=label.querySelector('select');select.value=automation.interpolation||'linear';select.onchange=e=>{automation.interpolation=e.target.value;commit()};label.querySelector('.copy').onclick=()=>{state.automationClipboard=JSON.parse(JSON.stringify(automation.points));toast('Automation copied')};label.querySelector('.paste').onclick=()=>{if(state.automationClipboard){automation.points=JSON.parse(JSON.stringify(state.automationClipboard)).map(p=>({...p,id:uid('pt')}));commit()}};label.querySelector('.reset').onclick=()=>removeAutomation(effect,paramKey);row.append(label);
    const lane=document.createElement('div');lane.className='automation-lane';lane.dataset.automation=automation.id;drawAutomationLane(lane,item,entry);lane.ondblclick=e=>{if(e.target.classList.contains('automation-point'))return;const rect=lane.getBoundingClientRect(),projectTime=clamp((e.clientX-rect.left+$('#timeline').scrollLeft)/state.zoom,0,60),normalized=clamp((projectTime-item.start)/(item.end-item.start),0,1),pointValue=definition.max-(e.clientY-rect.top)/rect.height*(definition.max-definition.min);automation.points.push({id:uid('pt'),time:normalized,value:clamp(pointValue,definition.min,definition.max)});automation.points.sort((a,b)=>a.time-b.time);commit()};row.append(lane);container.append(row);
  }
}
function drawAutomationLane(lane,item,{automation,definition}){
  const points=[...automation.points].sort((a,b)=>a.time-b.time),height=48;
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],x1=(item.start+a.time*(item.end-item.start))*state.zoom,x2=(item.start+b.time*(item.end-item.start))*state.zoom,y1=height-(a.value-definition.min)/(definition.max-definition.min)*height,y2=height-(b.value-definition.min)/(definition.max-definition.min)*height,length=Math.hypot(x2-x1,y2-y1),angle=Math.atan2(y2-y1,x2-x1)*180/Math.PI,segment=document.createElement('div');segment.className='automation-segment';segment.style.left=x1+'px';segment.style.top=y1+'px';segment.style.width=length+'px';segment.style.transform=`rotate(${angle}deg)`;lane.append(segment)}
  points.forEach(point=>{const dot=document.createElement('div');dot.className='automation-point';dot.style.left=(item.start+point.time*(item.end-item.start))*state.zoom+'px';dot.style.top=(height-(point.value-definition.min)/(definition.max-definition.min)*height)+'px';dot.onpointerdown=e=>startPointDrag(e,lane,item,point,definition);dot.oncontextmenu=e=>{e.preventDefault();if(automation.points.length<=2)return toast('Keep at least two automation points');automation.points=automation.points.filter(x=>x.id!==point.id);commit()};lane.append(dot)})
}
function startPointDrag(event,lane,item,point,definition){
  event.preventDefault();event.stopPropagation();const dot=event.currentTarget,move=e=>{const rect=lane.getBoundingClientRect(),projectTime=clamp((e.clientX-rect.left+$('#timeline').scrollLeft)/state.zoom,item.start,item.end);point.time=(projectTime-item.start)/(item.end-item.start);point.value=clamp(definition.max-(e.clientY-rect.top)/rect.height*(definition.max-definition.min),definition.min,definition.max);dot.style.left=(item.start+point.time*(item.end-item.start))*state.zoom+'px';dot.style.top=(48-(point.value-definition.min)/(definition.max-definition.min)*48)+'px';invalidate();drawFrame()};const up=()=>{document.removeEventListener('pointermove',move);commit()};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});
}
function handleTimelineDrop(event,targetTrack){
  event.preventDefault();const assetId=event.dataTransfer.getData('asset');if(assetId){if(targetTrack.kind==='adjustment')return toast('Media cannot be placed on an adjustment track');const asset=state.assets.find(x=>x.id===assetId);if(asset)createClip(asset,state.tracks.filter(t=>t.kind==='visual').indexOf(targetTrack));return}
  const itemId=event.dataTransfer.getData('item'),item=state.tracks.flatMap(t=>t.clips).find(x=>x.id===itemId);if(!item)return;if((item.kind==='adjustment')!==(targetTrack.kind==='adjustment'))return toast('Adjustment layers stay on adjustment tracks');const source=getTrackFor(item),rect=event.currentTarget.getBoundingClientRect(),duration=item.end-item.start;let start=(event.clientX-rect.left+$('#timeline').scrollLeft)/state.zoom;if(state.snap)start=Math.round(start*10)/10;start=clamp(start,0,60-duration);source.clips=source.clips.filter(x=>x!==item);targetTrack.clips.push(item);item.start=start;item.end=start+duration;delete item.blockedBoundary;reconcileTransitions(source);reconcileTransitions(targetTrack);commit();
}

function addAdjustmentLayer(){
  const duration=totalDuration()||5,start=Math.min(state.time,Math.max(0,duration-.1)),end=Math.min(60,Math.max(start+1,duration)),count=state.tracks.filter(t=>t.kind==='adjustment').length+1,layer={id:uid('adjustment'),kind:'adjustment',name:`ADJUSTMENT ${String(count).padStart(2,'0')}`,start,end,effects:[],automations:[],transitions:[],color:'#61e49d'};
  const track={id:uid('track'),kind:'adjustment',name:`ADJUST ${String(count).padStart(2,'0')}`,clips:[layer]};state.tracks.push(track);state.selected=layer.id;state.selectedTransition=null;commit();toast('Adjustment layer added')
}

function renderSize(canvas,quality){if(quality==='export')return {width:canvas.width,height:canvas.height};const max=480,scale=Math.min(1,max/Math.max(canvas.width,canvas.height));return {width:Math.max(1,Math.round(canvas.width*scale)),height:Math.max(1,Math.round(canvas.height*scale))}}
function drawSource(item,time,width,height){
  const canvas=VFX.makeCanvas(width,height),ctx=canvas.getContext('2d'),asset=state.assets.find(x=>x.id===item.assetId),media=asset&&state.media.get(asset.id);if(!media)return canvas;
  const adjusted=VFX.adjustSourceTime(item,time,state.project.fps),local=clamp((adjusted-item.start)/Math.max(.001,item.end-item.start),0,1);ctx.save();ctx.globalAlpha=item.opacity;ctx.translate(width/2+item.x*width/state.project.width,height/2+item.y*height/state.project.height);ctx.rotate(item.rotation*Math.PI/180);const scale=item.scale;let w=width*scale,h=height*scale;
  if(media.videoWidth){const ratio=Math.max(width/media.videoWidth,height/media.videoHeight);w=media.videoWidth*ratio*scale;h=media.videoHeight*ratio*scale;try{media.currentTime=item.sourceStart+(item.sourceEnd-item.sourceStart)*local}catch(_){}}
  else if(media.naturalWidth){const ratio=Math.max(width/media.naturalWidth,height/media.naturalHeight);w=media.naturalWidth*ratio*scale;h=media.naturalHeight*ratio*scale}
  try{ctx.drawImage(media,-w/2,-h/2,w,h)}catch(_){}ctx.restore();return canvas;
}
function renderClipFrame(item,time,width,height,quality){
  const frame=Math.round(time*state.project.fps),key=`${item.id}|${frame}|${width}x${height}|${state.renderVersion}|${quality}`;if(frameCache.has(key))return frameCache.get(key);const canvas=drawSource(item,time,width,height);VFX.applyStack(canvas,item.effects,time,item);if(quality==='preview'){frameCache.set(key,canvas);if(frameCache.size>36)frameCache.delete(frameCache.keys().next().value)}return canvas;
}
function blendFrames(outgoing,incoming,transition,p,width,height){
  const canvas=VFX.makeCanvas(width,height),ctx=canvas.getContext('2d'),mode=transition.preset,draw=(source,alpha=1,x=0,scale=1)=>{ctx.save();ctx.globalAlpha=alpha;ctx.translate(width/2+x,height/2);ctx.scale(scale,scale);ctx.drawImage(source,-width/2,-height/2);ctx.restore()};
  if(mode==='black'||mode==='white'){ctx.fillStyle=mode==='black'?'#000':'#fff';ctx.fillRect(0,0,width,height);if(p<.5)draw(outgoing,1-p*2);else draw(incoming,(p-.5)*2)}
  else if(mode==='wipe'){draw(outgoing);ctx.save();ctx.beginPath();ctx.rect(0,0,width*p,height);ctx.clip();draw(incoming);ctx.restore()}
  else if(mode==='push'){draw(outgoing,1,-p*width);draw(incoming,1,(1-p)*width)}
  else if(mode==='zoom'){draw(outgoing,1-p,0,1+p*.3);draw(incoming,p,0,1.3-p*.3)}
  else{draw(outgoing,1-p);draw(incoming,p)}
  if(mode==='flash'){ctx.fillStyle=`rgba(255,255,255,${Math.max(0,1-Math.abs(p-.5)*4)*.7})`;ctx.fillRect(0,0,width,height)}
  if(mode==='blur'||mode==='motion'){const copy=VFX.copyCanvas(canvas);ctx.clearRect(0,0,width,height);ctx.filter=`blur(${Math.sin(p*Math.PI)*(mode==='motion'?18:9)}px)`;ctx.drawImage(copy,0,0);ctx.filter='none'}
  if(mode==='displace'){const effect=VFX.createEffect('scanlineDisplacement');effect.params={amount:Math.sin(p*Math.PI)*65,frequency:22};VFX.applyEffect(canvas,effect,p,{start:0,end:1})}
  const destructive={datamosh:['datamosh',{intensity:Math.sin(p*Math.PI)*95,persistence:80,block:22,bleed:70}],frameSmear:['frameSmear',{intensity:Math.sin(p*Math.PI)*90,length:45,direction:.5}],rgbGlitch:['rgbDisplacement',{amount:Math.sin(p*Math.PI)*55,angle:0,split:100}],pixelSort:['pixelSort',{intensity:Math.sin(p*Math.PI)*95,threshold:90,direction:0}],feedback:['feedbackZoom',{amount:Math.sin(p*Math.PI)*90,zoom:.95,rotation:2.5}]};
  if(destructive[mode]){const [type,params]=destructive[mode],effect=VFX.createEffect(type);effect.params=params;VFX.applyEffect(canvas,effect,p,{start:0,end:1})}
  return canvas;
}
function renderTrack(track,time,width,height,quality){
  const canvas=VFX.makeCanvas(width,height),ctx=canvas.getContext('2d'),active=activeTransition(track,time);
  if(active){const outgoing=renderClipFrame(active.clip,time,width,height,quality),incoming=renderClipFrame(active.next,time,width,height,quality);ctx.drawImage(blendFrames(outgoing,incoming,active.transition,active.p,width,height),0,0);return canvas}
  const item=track.clips.find(x=>time>=x.start&&time<=x.end);if(item)ctx.drawImage(renderClipFrame(item,time,width,height,quality),0,0);return canvas;
}
function drawComposition(ctx,output,time=state.time,quality='preview'){
  const size=renderSize(output,quality),master=VFX.makeCanvas(size.width,size.height),mctx=master.getContext('2d');mctx.fillStyle='#11141a';mctx.fillRect(0,0,size.width,size.height);let drawn=false;
  for(const track of state.tracks){
    if(track.kind==='visual'){const active=track.clips.some(item=>time>=item.start&&time<=item.end)||!!activeTransition(track,time);if(active){mctx.drawImage(renderTrack(track,time,size.width,size.height,quality),0,0);drawn=true}}
    else for(const layer of track.clips)if(time>=layer.start&&time<=layer.end)VFX.applyStack(master,layer.effects,time,layer);
  }
  if(!drawn&&totalDuration()){mctx.fillStyle='#242832';mctx.fillRect(0,0,size.width,size.height);mctx.fillStyle='#9ba2ad';mctx.font='12px DM Mono';mctx.textAlign='center';mctx.fillText('MEDIA PREVIEW',size.width/2,size.height/2)}
  ctx.clearRect(0,0,output.width,output.height);ctx.imageSmoothingEnabled=true;ctx.drawImage(master,0,0,output.width,output.height);
}
function drawFrame(){const canvas=$('#preview');drawComposition(canvas.getContext('2d'),canvas,state.time,'preview')}

function updateReadout(){const duration=totalDuration(),item=getSelectedItem(),transition=getTransition();$('#time-readout').textContent=`${formatTime(state.time)} / ${formatTime(60)}`;$('#timeline-duration').textContent=formatTime(duration);$('#project-readout').textContent=`${state.project.width} × ${state.project.height} · ${state.project.fps} FPS · ${formatTime(duration)}`;$('#selection-readout').textContent=item?.name.toUpperCase()||transition?.x.preset.toUpperCase()||'NO SELECTION';$('#play-state').textContent=state.playing?'PLAYING':'READY';$('#preview-empty').style.display=duration?'none':'flex';$('#play-btn').textContent=state.playing?'Ⅱ':'▶'}
function render(){normalizeProject();renderBin();renderInspector();renderTimeline();updateReadout();drawFrame()}
function togglePlay(){if(!totalDuration())return toast('Import media and add clips first');state.playing=!state.playing;if(state.playing){lastTick=performance.now();raf=requestAnimationFrame(tick)}else cancelAnimationFrame(raf);updateReadout()}
function tick(now){if(!state.playing)return;state.time+=(now-lastTick)/1000;lastTick=now;if(state.time>=totalDuration()){state.time=0;state.playing=false}renderTimeline();updateReadout();drawFrame();if(state.playing)raf=requestAnimationFrame(tick)}

function split(){const item=getSelectedItem();if(!item)return toast('Select a clip or adjustment layer first');if(state.time<=item.start+.05||state.time>=item.end-.05)return toast('Place the playhead inside the selected item');const track=getTrackFor(item),right=JSON.parse(JSON.stringify(item));right.id=uid(item.kind);right.start=state.time;right.end=item.end;right.name=item.name+' B';right.transitions=[];for(const effect of right.effects||[]){effect.id=uid('fx');for(const automation of Object.values(effect.automation||{})){automation.id=uid('auto');automation.points.forEach(point=>point.id=uid('pt'))}}item.end=state.time;if(track.kind==='visual')item.blockedBoundary=right.id;track.clips.splice(track.clips.indexOf(item)+1,0,right);reconcileTransitions(track);state.selected=right.id;commit();toast('Split created with a hard cut')}
function duplicateSelected(){const item=getSelectedItem();if(!item)return toast('Select an item first');const track=getTrackFor(item),duration=item.end-item.start,end=track.clips.length?Math.max(...track.clips.map(x=>x.end)):0;if(end+duration>60)return toast('Duplicate would exceed 60 seconds');const copy=JSON.parse(JSON.stringify(item));copy.id=uid(item.kind);copy.name=item.name+' COPY';copy.start=end;copy.end=end+duration;copy.transitions=[];for(const effect of copy.effects||[]){effect.id=uid('fx');for(const automation of Object.values(effect.automation||{})){automation.id=uid('auto');automation.points.forEach(point=>point.id=uid('pt'))}}track.clips.push(copy);reconcileTransitions(track);state.selected=copy.id;commit()}
function rippleDelete(){const item=getSelectedItem();if(!item)return toast('Select an item first');const track=getTrackFor(item),duration=item.end-item.start;track.clips=track.clips.filter(x=>x!==item);if(track.kind==='visual')track.clips.filter(x=>x.start>item.start).forEach(x=>{x.start-=duration;x.end-=duration});reconcileTransitions(track);state.selected=null;commit();toast('Ripple deleted')}
function addTransition(){const item=getSelectedItem(),track=item&&getTrackFor(item);if(!item||track.kind!=='visual')return toast('Select the clip before the transition');const next=track.clips[track.clips.indexOf(item)+1];if(!next)return toast('Place another clip after this one');const transition={id:uid('tr'),to:next.id,preset:'crossfade',duration:Math.min(.4,maxTransitionDuration(item,next)),params:{},manual:true};item.transitions=[transition];delete item.blockedBoundary;state.selectedTransition=transition.id;state.selected=null;commit()}
function deleteTransition(){const selected=getTransition();if(!selected)return;const next=selected.t.clips[selected.t.clips.indexOf(selected.c)+1];selected.c.transitions=[];if(next)selected.c.blockedBoundary=next.id;state.selectedTransition=null;commit();toast('Hard cut restored')}

function saveProject(){const data={version:2,project:state.project,tracks:state.tracks,assets:state.assets.map(a=>({id:a.id,name:a.name,type:a.type,duration:a.duration}))};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=(state.project.name||'rift-project')+'.rift.json';link.click();$('#save-status').textContent='SAVED LOCALLY';toast('Phase 2 project saved')}
function openProject(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{restore(reader.result);toast('Project reopened — re-import media to relink source files')}catch(_){toast('Could not open project')}};reader.readAsText(file)}
async function exportVideo(){
  const duration=totalDuration();if(!duration)return toast('Add footage before exporting');const canvas=document.createElement('canvas');canvas.width=state.project.width;canvas.height=state.project.height;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(state.project.fps),mp4=MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E'),mime=mp4?'video/mp4':'video/webm;codecs=vp9',extension=mp4?'mp4':'webm',bitrate=+$('#export-quality').value,recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:bitrate}),chunks=[];
  recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);recorder.onstop=()=>{const blob=new Blob(chunks,{type:mime}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=(state.project.name||'rift-export')+'-silent.'+extension;link.click();toast(`Silent ${extension.toUpperCase()} exported`)};recorder.start();const start=performance.now();
  function frame(now){const time=Math.min(duration,(now-start)/1000);drawComposition(ctx,canvas,time,'export');if(time<duration)requestAnimationFrame(frame);else recorder.stop()}requestAnimationFrame(frame);toast(`Rendering effects and automation to ${extension.toUpperCase()}…`);
}

$('#import-btn').onclick=()=>$('#media-input').click();$('#media-input').onchange=e=>importFiles(e.target.files);$('#media-bin').ondragover=e=>{e.preventDefault();$('#media-bin').classList.add('drag')};$('#media-bin').ondragleave=()=>$('#media-bin').classList.remove('drag');$('#media-bin').ondrop=e=>{e.preventDefault();$('#media-bin').classList.remove('drag');importFiles(e.dataTransfer.files)};
document.addEventListener('dragstart',e=>{const block=e.target.closest('.clip-block');if(block)e.dataTransfer.setData('item',block.dataset.item)});
$('#play-btn').onclick=togglePlay;$('#step-back').onclick=()=>{state.time=Math.max(0,state.time-1/state.project.fps);render()};$('#step-forward').onclick=()=>{state.time=Math.min(totalDuration(),state.time+1/state.project.fps);render()};
$('#timeline').onclick=e=>{if(e.target.closest('.clip-block,.transition-block,.track-label,.automation-lane-row'))return;const rect=$('#timeline').getBoundingClientRect(),x=e.clientX-rect.left-90+$('#timeline').scrollLeft;state.time=clamp(x/state.zoom,0,60);render()};$('#timeline-zoom').oninput=e=>{state.zoom=+e.target.value;renderTimeline()};$('#snap-toggle').onchange=e=>state.snap=e.target.checked;
$('#add-track').onclick=()=>{const count=state.tracks.filter(t=>t.kind==='visual').length+1;state.tracks.push({id:uid('track'),kind:'visual',name:`VIDEO ${String(count).padStart(2,'0')}`,clips:[]});commit()};$('#add-adjustment').onclick=addAdjustmentLayer;$('#split-clip').onclick=split;$('#duplicate-clip').onclick=duplicateSelected;$('#ripple-delete').onclick=rippleDelete;$('#add-transition').onclick=addTransition;
$('#add-effect').onclick=()=>{const type=$('#effect-picker').value;if(type){createEffect(type);$('#effect-picker').value=''}};
$('#project-format').onchange=e=>{setFormat(e.target.value);commit()};$('#project-fps').onchange=e=>{state.project.fps=+e.target.value;commit()};$('#project-name').onchange=e=>{state.project.name=e.target.value;commit()};
[['clip-x','x'],['clip-y','y'],['clip-scale','scale'],['clip-rotation','rotation'],['clip-opacity','opacity']].forEach(([id,key])=>$('#'+id).onchange=e=>{const item=getSelectedItem();if(item){item[key]=+e.target.value;commit()}});
$('#new-project').onclick=()=>{if(confirm('Start a new project?')){state.assets=[];state.tracks=[{id:uid('track'),kind:'visual',name:'VIDEO 01',clips:[]}];state.selected=null;state.selectedTransition=null;state.time=0;state.media.clear();commit()}};$('#save-project').onclick=saveProject;$('#open-project').onclick=()=>$('#project-file').click();$('#project-file').onchange=e=>openProject(e.target.files[0]);$('#export-project').onclick=exportVideo;
$('#transition-preset').onchange=e=>{const selected=getTransition();if(selected){selected.x.preset=e.target.value;selected.x.manual=true;commit()}};$('#transition-duration').oninput=e=>{const selected=getTransition();if(selected){const next=selected.t.clips[selected.t.clips.indexOf(selected.c)+1],max=maxTransitionDuration(selected.c,next);selected.x.duration=Math.min(+e.target.value,max);selected.x.manual=true;$('#transition-duration-output').textContent=selected.x.duration.toFixed(2)+'s';invalidate();drawFrame();renderTimeline()}};$('#transition-duration').onchange=commit;$('#delete-transition').onclick=deleteTransition;
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();togglePlay()}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();const source=e.shiftKey?state.future:state.history,target=e.shiftKey?state.history:state.future,raw=source.pop();if(raw){target.push(snapshot());restore(raw)}}});

normalizeProject();setFormat(state.project.format);state.lastSnapshot=snapshot();render();
