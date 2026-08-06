
const categories = ["mostre","food","vintage","arturo"];
const data = {};
const maps = {};
const layers = {};
let allPlaces = [];

const search = document.getElementById("search-input");
const status = document.getElementById("status");
const nearbyBox = document.getElementById("nearby-results");
const nearbyList = document.getElementById("nearby-list");

async function start(){
  for(const category of categories){
    const r = await fetch(`data/${category}.json`);
    data[category] = (await r.json()).map(x => ({...x,category}));
  }
  allPlaces = categories.flatMap(c => data[c]);
  initMaps();
  renderAll();
}

function initMaps(){
  categories.forEach(category=>{
    const map=L.map(`map-${category}`,{scrollWheelZoom:false}).setView([48.8566,2.3522],12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,attribution:"&copy; OpenStreetMap"
    }).addTo(map);
    maps[category]=map;
    layers[category]=L.layerGroup().addTo(map);
  });
}

function text(place){
  return [place.name,place.subtitle,place.description,...(place.tags||[])].join(" ").toLowerCase();
}

function createCard(place,withDistance=false){
  const d=document.createElement("details");
  d.className="place";
  const s=document.createElement("summary");
  s.innerHTML=`
    <span class="place-summary">
      <strong>${place.name}${place.tested?'<span class="tested">✓ Testato da noi</span>':""}</strong>
      <small>${place.subtitle}${place.tags?.length?" · "+place.tags.slice(0,2).join(" · "):""}${withDistance?" · "+formatDistance(place.distance):""}</small>
    </span>
    <span class="chevron">⌄</span>`;
  const b=document.createElement("div");
  b.className="place-body";
  b.innerHTML=`
    <p>${place.description||""}</p>
    <div class="tags">${(place.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    <div class="link-row">${(place.links||[]).map(l=>`<a class="link-button ${l.kind==="site"?"secondary":""}" href="${l.url}" target="_blank" rel="noopener">${l.kind==="maps"?"Google Maps":l.label||"Sito"}</a>`).join("")}</div>`;
  d.append(s,b);
  return d;
}

function renderAll(){
  const q=search.value.trim().toLowerCase();
  categories.forEach(category=>{
    const items=data[category].filter(p=>!q||text(p).includes(q));
    const list=document.getElementById(`list-${category}`);
    list.innerHTML="";
    items.forEach(p=>list.appendChild(createCard(p)));
    if(!items.length) list.innerHTML='<div class="nearby-empty">Nessun risultato.</div>';
    updateMap(category,items);
  });
}

function pin(n){
  return L.divIcon({className:"",html:`<span class="paris-pin">${n}</span>`,iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-16]});
}

function updateMap(category,items){
  layers[category].clearLayers();
  const bounds=[];
  let n=0;
  items.forEach(p=>{
    if(typeof p.lat!=="number"||typeof p.lon!=="number") return;
    n++;
    const m=L.marker([p.lat,p.lon],{icon:pin(n)});
    const link=(p.links||[]).find(l=>l.kind==="maps")?.url||"#";
    m.bindPopup(`<strong>${p.name}</strong><br><small>${p.subtitle}</small><br><br><a href="${link}" target="_blank">Apri in Google Maps</a>`);
    layers[category].addLayer(m);
    bounds.push([p.lat,p.lon]);
  });
  if(bounds.length) maps[category].fitBounds(bounds,{padding:[28,28],maxZoom:14});
  document.getElementById(`map-status-${category}`).textContent=`${bounds.length} luoghi sulla mappa`;
  setTimeout(()=>maps[category].invalidateSize(),100);
}

function km(a,b,c,d){
  const r=x=>x*Math.PI/180,R=6371,dl=r(c-a),dn=r(d-b);
  const x=Math.sin(dl/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dn/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function formatDistance(x){return x<1?`${Math.round(x*1000)} m`:`${x.toFixed(1)} km`}

document.getElementById("nearby-button").onclick=()=>{
  if(!navigator.geolocation){status.textContent="Geolocalizzazione non supportata.";return}
  status.textContent="Ricerca della posizione in corso…";
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude}=pos.coords;
    const nearest=allPlaces.filter(p=>typeof p.lat==="number").map(p=>({...p,distance:km(latitude,longitude,p.lat,p.lon)})).sort((a,b)=>a.distance-b.distance).slice(0,12);
    nearbyList.innerHTML="";
    nearest.forEach(p=>nearbyList.appendChild(createCard(p,true)));
    nearbyBox.hidden=false;
    status.textContent="Posizione usata una sola volta. Nessun tracciamento continuo.";
    document.getElementById("strumenti").scrollIntoView({behavior:"smooth"});
  },()=>status.textContent="Non riesco a leggere la posizione.",{timeout:10000,maximumAge:120000});
};

document.getElementById("reset-button").onclick=()=>{
  search.value="";
  nearbyBox.hidden=true;
  renderAll();
};

search.addEventListener("input",renderAll);
start().catch(()=>status.textContent="Errore nel caricamento dei dati.");
