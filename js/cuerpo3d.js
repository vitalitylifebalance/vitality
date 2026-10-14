// Shaders de la silueta de partículas. Clásico (sin modules) para que funcione en file://.
window.CUERPO_SHADERS = {
  vert: `
    attribute float aKind;   // 0 cuerpo, 1 pies/suelo, 2 nervio, 3 corazón
    attribute float aSeed;
    attribute float aS;      // 0..1 posición a lo largo del nervio / radio del anillo del suelo
    uniform float uTime;
    uniform float uPx;       // pixel ratio * factor de tamaño
    uniform vec4  uW;        // pesos suavizados de los 4 pasos: pies, piel, nervio, corazón
    uniform float uBeat;     // latido 0..1
    varying float vGlow;
    varying float vKind;
    void main(){
      vec3 p = position;
      float size = 1.6;
      float glow = 0.30;
      if(aKind < 0.5){                       // CUERPO
        float wave = smoothstep(0.55, 1.0, sin(p.y*7.0 - uTime*1.6 + aSeed*0.6)*0.5+0.5);
        glow += uW.y * (0.35 + 0.9*wave);
        size += uW.y * 1.1 * wave;
        glow *= 1.0 - 0.45*(uW.z + uW.w);    // baja el cuerpo cuando destacan nervio/corazón
        glow *= 1.0 - 0.35*uW.x;
        p += normalize(p + vec3(0.001)) * 0.0;
      } else if(aKind < 1.5){                // PIES + anillos del suelo
        float ring = fract(aS - uTime*0.18);
        float pulse = smoothstep(0.0, 0.15, ring) * (1.0 - smoothstep(0.15, 1.0, ring));
        glow = 0.05 + uW.x * (0.25 + 1.4*pulse);
        size = 1.2 + uW.x * 2.2 * pulse;
      } else if(aKind < 2.5){                // NERVIO
        float head = fract(uTime*0.22 + aSeed*0.0);
        float d = abs(fract(aS - uTime*0.35) - 0.0);
        float pulse = smoothstep(0.18, 0.0, min(d, 1.0-d));
        glow = 0.04 + uW.z * (0.35 + 1.6*pulse);
        size = 1.0 + uW.z * (1.2 + 2.6*pulse);
      } else {                               // CORAZÓN
        float k = 1.0 + 0.35*uBeat*uW.w;
        p.x = (p.x - 0.05) * k + 0.05; p.y = (p.y - 1.33) * k + 1.33; p.z = (p.z - 0.04) * k + 0.04;
        glow = 0.05 + uW.w * (0.45 + 0.55*uBeat);
        size = 1.0 + uW.w * (1.0 + 1.4*uBeat);
      }
      vGlow = glow; vKind = aKind;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = size * uPx * (1.6 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  frag: `
    precision mediump float;
    varying float vGlow;
    varying float vKind;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if(d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      vec3 cyan = vec3(0.282, 0.792, 0.894);   // #48CAE4
      vec3 deep = vec3(0.0, 0.737, 0.831);     // #00BCD4
      vec3 col = mix(deep, cyan, clamp(vGlow, 0.0, 1.0));
      col = mix(col, vec3(0.85, 0.98, 1.0), clamp(vGlow - 0.9, 0.0, 1.0));
      gl_FragColor = vec4(col, a * clamp(vGlow, 0.0, 1.0));
    }`
};
// Silueta estilizada por partículas (no anatomía): primitivas muestreadas con RNG con semilla.
(function(){
  function rng(seed){ let s = seed >>> 0; return function(){ s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const V = (x,y,z)=>({x,y,z});
  const lerp = (a,b,t)=>a+(b-a)*t;

  // [centro, radios] elipsoides
  const ELL = [
    [[0,1.69,0],[0.095,0.12,0.105]],        // cabeza
    [[0,1.32,0],[0.19,0.22,0.10]],          // pecho
    [[0,1.08,0],[0.155,0.20,0.09]],         // abdomen
    [[0,0.90,0],[0.17,0.11,0.10]],          // pelvis
    [[-0.22,1.43,0],[0.06,0.06,0.06]],[[0.22,1.43,0],[0.06,0.06,0.06]],     // hombros
    [[-0.10,0.03,0.07],[0.05,0.03,0.12]],[[0.10,0.03,0.07],[0.05,0.03,0.12]] // pies
  ];
  // [a, b, ra, rb] cápsulas cónicas
  const CAP = [
    [[0,1.54,0],[0,1.62,0],0.05,0.045],
    [[-0.22,1.43,0],[-0.33,1.14,0],0.050,0.040],[[-0.33,1.14,0],[-0.38,0.90,0.02],0.040,0.032],[[-0.38,0.90,0.02],[-0.395,0.80,0.02],0.032,0.026],
    [[0.22,1.43,0],[0.33,1.14,0],0.050,0.040],[[0.33,1.14,0],[0.38,0.90,0.02],0.040,0.032],[[0.38,0.90,0.02],[0.395,0.80,0.02],0.032,0.026],
    [[-0.09,0.88,0],[-0.10,0.48,0.01],0.080,0.058],[[-0.10,0.48,0.01],[-0.10,0.09,0],0.058,0.042],
    [[0.09,0.88,0],[0.10,0.48,0.01],0.080,0.058],[[0.10,0.48,0.01],[0.10,0.09,0],0.058,0.042]
  ];
  function sphereDir(r){ const u = r()*2-1, a = r()*Math.PI*2, s = Math.sqrt(1-u*u); return V(s*Math.cos(a), u, s*Math.sin(a)); }

  function surfaceArea(){ // pesos de muestreo ~ área
    const w = [];
    ELL.forEach(e=>{ const [a,b,c]=e[1]; w.push({t:'e',e, w: 4*Math.PI*Math.pow((Math.pow(a*b,1.6)+Math.pow(a*c,1.6)+Math.pow(b*c,1.6))/3,1/1.6)}); });
    CAP.forEach(c=>{ const len=Math.hypot(c[1][0]-c[0][0],c[1][1]-c[0][1],c[1][2]-c[0][2]); w.push({t:'c',c, w: 2*Math.PI*(c[2]+c[3])/2*len}); });
    const tot = w.reduce((s,x)=>s+x.w,0); let acc=0; w.forEach(x=>{ acc+=x.w/tot; x.cum=acc; }); return w;
  }

  // Camino del sistema nervioso: lista de polilíneas (cabeza → columna → ramas)
  const NERVE = [
    [[0,1.69,0],[0,1.55,0],[0,1.35,-0.02],[0,1.10,-0.03],[0,0.92,-0.02]],
    [[0,1.40,-0.02],[-0.22,1.43,0],[-0.33,1.14,0],[-0.38,0.90,0.02],[-0.395,0.80,0.02]],
    [[0,1.40,-0.02],[0.22,1.43,0],[0.33,1.14,0],[0.38,0.90,0.02],[0.395,0.80,0.02]],
    [[0,0.92,-0.02],[-0.09,0.88,0],[-0.10,0.48,0.01],[-0.10,0.09,0],[-0.10,0.03,0.08]],
    [[0,0.92,-0.02],[0.09,0.88,0],[0.10,0.48,0.01],[0.10,0.09,0],[0.10,0.03,0.08]]
  ];

  window.buildBody = function(total){
    const r = rng(86), pos = [], kind = [], seed = [], s = [];
    const push = (x,y,z,k,sd,ss)=>{ pos.push(x,y,z); kind.push(k); seed.push(sd); s.push(ss); };
    const prims = surfaceArea();
    const nBody = Math.floor(total*0.80);
    for(let i=0;i<nBody;i++){
      const q = r(); const p = prims.find(x=>q<=x.cum) || prims[prims.length-1];
      if(p.t==='e'){ const d=sphereDir(r), [a,b,c]=p.e[1], o=p.e[0]; push(o[0]+d.x*a, o[1]+d.y*b, o[2]+d.z*c, 0, r()*100, 0); }
      else { const c=p.c, t=r(), a=r()*Math.PI*2, rad=lerp(c[2],c[3],t);
        const dx=c[1][0]-c[0][0], dy=c[1][1]-c[0][1], dz=c[1][2]-c[0][2], L=Math.hypot(dx,dy,dz);
        // base ortonormal aproximada
        const ax=V(dx/L,dy/L,dz/L); let ux=V(1,0,0); if(Math.abs(ax.x)>0.9) ux=V(0,0,1);
        let n1=V(ax.y*ux.z-ax.z*ux.y, ax.z*ux.x-ax.x*ux.z, ax.x*ux.y-ax.y*ux.x); const l1=Math.hypot(n1.x,n1.y,n1.z); n1=V(n1.x/l1,n1.y/l1,n1.z/l1);
        const n2=V(ax.y*n1.z-ax.z*n1.y, ax.z*n1.x-ax.x*n1.z, ax.x*n1.y-ax.y*n1.x);
        const ca=Math.cos(a)*rad, sa=Math.sin(a)*rad;
        push(lerp(c[0][0],c[1][0],t)+n1.x*ca+n2.x*sa, lerp(c[0][1],c[1][1],t)+n1.y*ca+n2.y*sa, lerp(c[0][2],c[1][2],t)+n1.z*ca+n2.z*sa, 0, r()*100, 0); }
    }
    // Suelo: anillos concéntricos bajo los pies (aS = radio normalizado → ondas que salen)
    const nGround = Math.floor(total*0.06);
    for(let i=0;i<nGround;i++){ const rr=Math.sqrt(r())*0.55, a=r()*Math.PI*2; push(Math.cos(a)*rr, 0.0, Math.sin(a)*rr*0.9, 1, r()*100, rr/0.55); }
    // Pies resaltados: puntos extra en las dos elipsoides de los pies
    const nFeet = Math.floor(total*0.02);
    for(let i=0;i<nFeet;i++){ const e=ELL[6+(i&1)], d=sphereDir(r), [a,b,c]=e[1], o=e[0]; push(o[0]+d.x*a,o[1]+d.y*b*0.9,o[2]+d.z*c,1,r()*100,r()); }
    // Nervios: puntos a lo largo de las polilíneas con jitter
    const nNerve = Math.floor(total*0.07);
    const lens = NERVE.map(pl=>{ let L=0; for(let i=1;i<pl.length;i++) L+=Math.hypot(pl[i][0]-pl[i-1][0],pl[i][1]-pl[i-1][1],pl[i][2]-pl[i-1][2]); return L; });
    const totL = lens.reduce((a,b)=>a+b,0);
    let g = 0;
    NERVE.forEach((pl,pi)=>{
      const cnt = Math.floor(nNerve*lens[pi]/totL); let acc=0; const segL=[]; for(let i=1;i<pl.length;i++){ const l=Math.hypot(pl[i][0]-pl[i-1][0],pl[i][1]-pl[i-1][1],pl[i][2]-pl[i-1][2]); segL.push(l); }
      for(let j=0;j<cnt;j++){ const u=r()*lens[pi]; let k=0, rem=u; while(k<segL.length-1 && rem>segL[k]){ rem-=segL[k]; k++; }
        const t=rem/segL[k], a=pl[k], b=pl[k+1], jt=0.006;
        // s = distancia acumulada global (para que el pulso viaje desde la cabeza)
        const base = pi===0 ? 0 : 0.25;
        push(lerp(a[0],b[0],t)+(r()-.5)*jt, lerp(a[1],b[1],t)+(r()-.5)*jt, lerp(a[2],b[2],t)+(r()-.5)*jt, 2, r()*100, base + (u/lens[pi])*0.75); }
    });
    // Corazón: nube pequeña en el pecho
    const nHeart = Math.floor(total*0.025);
    for(let i=0;i<nHeart;i++){ const d=sphereDir(r), rad=0.045*Math.cbrt(r()); push(0.05+d.x*rad*0.9, 1.33+d.y*rad*1.1, 0.04+d.z*rad*0.8, 3, r()*100, 0); }
    return { position:new Float32Array(pos), kind:new Float32Array(kind), seed:new Float32Array(seed), s:new Float32Array(s), count:kind.length };
  };
})();
/* Cuerpo bioeléctrico (Recall #86). Script clásico, sin módulos.
   Three.js (/js/vendor/three.min.js, r160 MIT) se carga solo cuando la sección se acerca al viewport. */
(function(){
  var root = document.getElementById('cuerpo3d');
  if(!root) return;

  // Textos en los 13 idiomas de la web. El HTML ya trae el de su página; esto cubre el resto.
  var I18N = {
    es:{ title:'Cuerpo bioeléctrico', steps:'Pasos', l:['Pies','Piel','Sistema nervioso','Corazón'],
      t:['La planta de los pies es el punto de contacto con la tierra.','En la piel, el Vipassanna usa un par galvánico de metales biocompatibles para generar microvoltaje al contacto.','El sistema nervioso funciona como una red eléctrica que recorre todo el cuerpo.','El corazón marca un ritmo eléctrico constante.'],
      hint:'Desliza · o pasa sobre los puntos', note:'Visualización ilustrativa. No es una representación anatómica ni médica.' },
    en:{ title:'Bioelectric body', steps:'Steps', l:['Feet','Skin','Nervous system','Heart'],
      t:['The soles of the feet are the point of contact with the earth.','On the skin, Vipassanna uses a galvanic pair of biocompatible metals to generate a microvoltage on contact.','The nervous system works like an electrical network running through the whole body.','The heart keeps a steady electrical rhythm.'],
      hint:'Scroll · or hover over the dots', note:'Illustrative visualisation. Not an anatomical or medical representation.' },
    fr:{ title:'Corps bioélectrique', steps:'Étapes', l:['Pieds','Peau','Système nerveux','Cœur'],
      t:['La plante des pieds est le point de contact avec la terre.','Sur la peau, le Vipassanna utilise un couple galvanique de métaux biocompatibles pour générer une microtension au contact.','Le système nerveux fonctionne comme un réseau électrique qui parcourt tout le corps.','Le cœur suit un rythme électrique régulier.'],
      hint:'Faites défiler · ou survolez les points', note:'Visualisation illustrative. Ce n’est pas une représentation anatomique ni médicale.' },
    de:{ title:'Bioelektrischer Körper', steps:'Schritte', l:['Füße','Haut','Nervensystem','Herz'],
      t:['Die Fußsohlen sind der Kontaktpunkt mit der Erde.','Auf der Haut nutzt Vipassanna ein galvanisches Paar biokompatibler Metalle, um bei Kontakt eine Mikrospannung zu erzeugen.','Das Nervensystem funktioniert wie ein elektrisches Netz, das den ganzen Körper durchzieht.','Das Herz gibt einen gleichmäßigen elektrischen Rhythmus vor.'],
      hint:'Scrollen · oder über die Punkte fahren', note:'Illustrative Darstellung. Keine anatomische oder medizinische Abbildung.' },
    it:{ title:'Corpo bioelettrico', steps:'Passi', l:['Piedi','Pelle','Sistema nervoso','Cuore'],
      t:['La pianta dei piedi è il punto di contatto con la terra.','Sulla pelle, Vipassanna usa una coppia galvanica di metalli biocompatibili per generare un microvoltaggio al contatto.','Il sistema nervoso funziona come una rete elettrica che percorre tutto il corpo.','Il cuore segue un ritmo elettrico costante.'],
      hint:'Scorri · o passa sui punti', note:'Visualizzazione illustrativa. Non è una rappresentazione anatomica né medica.' },
    pt:{ title:'Corpo bioelétrico', steps:'Passos', l:['Pés','Pele','Sistema nervoso','Coração'],
      t:['A planta dos pés é o ponto de contacto com a terra.','Na pele, o Vipassanna usa um par galvânico de metais biocompatíveis para gerar microvoltagem ao contacto.','O sistema nervoso funciona como uma rede elétrica que percorre todo o corpo.','O coração mantém um ritmo elétrico constante.'],
      hint:'Deslize · ou passe sobre os pontos', note:'Visualização ilustrativa. Não é uma representação anatómica nem médica.' },
    nl:{ title:'Bio-elektrisch lichaam', steps:'Stappen', l:['Voeten','Huid','Zenuwstelsel','Hart'],
      t:['De voetzolen zijn het contactpunt met de aarde.','Op de huid gebruikt Vipassanna een galvanisch paar van biocompatibele metalen om bij contact een microspanning op te wekken.','Het zenuwstelsel werkt als een elektrisch netwerk dat door het hele lichaam loopt.','Het hart houdt een constant elektrisch ritme aan.'],
      hint:'Scroll · of beweeg over de punten', note:'Illustratieve visualisatie. Geen anatomische of medische weergave.' },
    ja:{ title:'生体電気のからだ', steps:'ステップ', l:['足','皮膚','神経系','心臓'],
      t:['足の裏は大地と触れ合う接点です。','皮膚の上で、Vipassannaは生体適合性金属のガルバニ対により、接触時に微小電圧を生み出します。','神経系は全身をめぐる電気のネットワークのように働きます。','心臓は一定の電気的リズムを刻みます。'],
      hint:'スクロール・または点にカーソルを合わせる', note:'イメージ図です。解剖学的・医学的な表現ではありません。' },
    zh:{ title:'生物电身体', steps:'步骤', l:['双脚','皮肤','神经系统','心脏'],
      t:['脚底是与大地接触的点。','在皮肤上，Vipassanna 利用由生物相容性金属构成的电偶，在接触时产生微电压。','神经系统就像一张贯穿全身的电网络。','心脏保持着稳定的电节律。'],
      hint:'滑动 · 或将鼠标移到圆点上', note:'示意性可视化，并非解剖或医学表现。' },
    ko:{ title:'생체전기 몸', steps:'단계', l:['발','피부','신경계','심장'],
      t:['발바닥은 땅과 닿는 접점입니다.','피부에서 Vipassanna는 생체적합성 금속의 갈바닉 쌍으로 접촉 시 미세 전압을 만듭니다.','신경계는 온몸을 잇는 전기 네트워크처럼 작동합니다.','심장은 일정한 전기 리듬을 만듭니다.'],
      hint:'스크롤 · 또는 점 위에 올려 보세요', note:'설명용 시각화입니다. 해부학적·의학적 표현이 아닙니다.' },
    ar:{ title:'الجسم الكهربائي الحيوي', steps:'الخطوات', l:['القدمان','الجلد','الجهاز العصبي','القلب'],
      t:['باطن القدمين هو نقطة التلامس مع الأرض.','على الجلد، يستخدم Vipassanna زوجًا غلفانيًا من معادن متوافقة حيويًا لتوليد جهد كهربائي دقيق عند التلامس.','يعمل الجهاز العصبي كشبكة كهربائية تمتد في الجسم كله.','يحافظ القلب على إيقاع كهربائي ثابت.'],
      hint:'مرّر للأسفل · أو مرّر المؤشر فوق النقاط', note:'تصوير توضيحي. ليس تمثيلًا تشريحيًا أو طبيًا.' },
    hi:{ title:'बायोइलेक्ट्रिक शरीर', steps:'चरण', l:['पैर','त्वचा','तंत्रिका तंत्र','हृदय'],
      t:['पैरों के तलवे धरती से संपर्क का बिंदु हैं।','त्वचा पर, Vipassanna संपर्क होने पर माइक्रोवोल्टेज बनाने के लिए जैव-अनुकूल धातुओं की गैल्वेनिक जोड़ी का उपयोग करता है।','तंत्रिका तंत्र पूरे शरीर में फैले एक विद्युत नेटवर्क की तरह काम करता है।','हृदय एक स्थिर विद्युत लय बनाए रखता है।'],
      hint:'स्क्रॉल करें · या बिंदुओं पर कर्सर ले जाएँ', note:'चित्रात्मक दृश्य। यह शारीरिक या चिकित्सीय निरूपण नहीं है।' },
    ru:{ title:'Биоэлектрическое тело', steps:'Шаги', l:['Стопы','Кожа','Нервная система','Сердце'],
      t:['Стопы — точка контакта с землёй.','На коже Vipassanna использует гальваническую пару биосовместимых металлов, чтобы при контакте создавать микронапряжение.','Нервная система работает как электрическая сеть, пронизывающая всё тело.','Сердце задаёт постоянный электрический ритм.'],
      hint:'Прокрутите · или наведите на точки', note:'Иллюстративная визуализация. Не является анатомическим или медицинским изображением.' }
  };
  var lang = (document.documentElement.lang || 'es').slice(0,2).toLowerCase();
  var S = I18N[lang];
  function q(sel){ return root.querySelector(sel); }
  function qa(sel){ return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function set(el, txt){ if(el && txt) el.textContent = txt; }
  if(S){
    set(q('.c3d-title'), S.title); set(q('.c3d-hint'), S.hint); set(q('.c3d-note'), S.note);
    var dotsNav = q('.c3d-dots'); if(dotsNav) dotsNav.setAttribute('aria-label', S.steps);
    root.setAttribute('aria-label', S.title);
    qa('.c3d-txt').forEach(function(c,i){ set(c.querySelector('small'), '0'+(i+1)+' · '+S.l[i]); set(c.querySelector('p'), S.t[i]); });
    qa('.c3d-dot span').forEach(function(s,i){ set(s, S.l[i]); });
    qa('.c3d-list li').forEach(function(li,i){ li.innerHTML = ''; var b = document.createElement('b'); b.textContent = S.l[i]+': '; li.appendChild(b); li.appendChild(document.createTextNode(S.t[i])); });
  }

  // Sin WebGL no se cambia nada: queda la lista estática.
  var probe = document.createElement('canvas'), ok = false;
  try { ok = !!(window.WebGLRenderingContext && (probe.getContext('webgl2') || probe.getContext('webgl'))); } catch(e){ ok = false; }
  if(!ok) return;
  root.classList.add('c3d-on');

  var started = false;
  function loadThree(cb){
    if(window.THREE){ cb(); return; }
    var s = document.createElement('script');
    s.src = '/js/vendor/three.min.js?v=160';
    s.async = true;
    s.onload = cb;
    s.onerror = function(){ root.classList.remove('c3d-on'); };
    document.head.appendChild(s);
  }
  function start(){ if(started) return; started = true; loadThree(function(){ try { init(); } catch(e){ root.classList.remove('c3d-on'); if(window.console) console.warn('cuerpo3d:', e.message); } }); }
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){ if(es.some(function(e){ return e.isIntersecting; })){ io.disconnect(); start(); } }, { rootMargin:'600px 0px' });
    io.observe(root);
  } else { start(); }

  function init(){
    var STEPS = [
      { cam:{ y:0.30, d:2.1, yaw:0.45 },  anchor:[0.10,0.03,0.10] },
      { cam:{ y:0.90, d:4.4, yaw:-0.35 }, anchor:[0.33,1.14,0.0] },
      { cam:{ y:1.00, d:3.7, yaw:0.0 },   anchor:[0.0,1.30,-0.02] },
      { cam:{ y:1.30, d:1.9, yaw:-0.28 }, anchor:[0.05,1.33,0.04] }
    ];
    var THREE = window.THREE;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var stage = q('.c3d-stage'), canvas = q('.c3d-canvas'), marker = q('.c3d-marker');
    var dots = qa('.c3d-dot'), cards = qa('.c3d-txt');
    var isMobile = matchMedia('(max-width: 768px)').matches || matchMedia('(pointer: coarse)').matches;

    var gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if(!gl) throw new Error('sin WebGL');
    var renderer = new THREE.WebGLRenderer({ canvas:canvas, context:gl, antialias:false, alpha:true, powerPreference:'high-performance' });
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    // buildBody(n) devuelve algo menos de n (medido: 8772 para 9000); se reescala para llegar al objetivo.
    var want = isMobile ? 9000 : 18000, data = window.buildBody(want);
    if(data.count < want) data = window.buildBody(Math.ceil(want * want / data.count * 1.002));
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.position,3));
    geo.setAttribute('aKind', new THREE.BufferAttribute(data.kind,1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(data.seed,1));
    geo.setAttribute('aS', new THREE.BufferAttribute(data.s,1));
    var uniforms = { uTime:{value:0}, uPx:{value:1}, uW:{value:new THREE.Vector4(1,0,0,0)}, uBeat:{value:0} };
    var mat = new THREE.ShaderMaterial({ vertexShader:window.CUERPO_SHADERS.vert, fragmentShader:window.CUERPO_SHADERS.frag, uniforms:uniforms,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
    var pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);

    var W = 0, H = 0;
    function resize(){
      var dpr = Math.min(window.devicePixelRatio||1, 2);
      W = stage.clientWidth; H = stage.clientHeight;
      renderer.setPixelRatio(dpr); renderer.setSize(W,H,false);
      camera.aspect = W/H;
      var shiftX = (!isMobile && W>900) ? -W*0.12 : 0, shiftY = isMobile ? H*0.10 : 0;
      camera.setViewOffset(W,H,shiftX,shiftY,W,H);
      camera.updateProjectionMatrix();
      uniforms.uPx.value = dpr * (H/900) * 7.0;
      if(reduce || !running) frame(0, true);
    }

    // Progreso de la sección (0..1) → f continuo 0..3, con lerp
    var target = 0, prog = 0, mx = 0, my = 0, smx = 0, smy = 0;
    function readScroll(){ var max = root.offsetHeight - innerHeight; target = Math.min(1, Math.max(0, max>0 ? -root.getBoundingClientRect().top/max : 0)); }
    function goStep(i){
      var max = root.offsetHeight - innerHeight;
      var y = root.getBoundingClientRect().top + window.pageYOffset + max * (i/3);
      window.scrollTo({ top:y, behavior: reduce ? 'instant' : 'smooth' });
    }
    dots.forEach(function(d,i){
      d.addEventListener('click', function(){ goStep(i); });
      d.addEventListener('pointerenter', function(e){ if(e.pointerType==='mouse') goStep(i); });
    });

    var tmp = new THREE.Vector3();
    var last = performance.now(), t = 0, frames = 0, activeIdx = -1, running = false, visible = false;
    function frame(now, once){
      now = now || performance.now();
      var dt = Math.min(0.05, (now - last)/1000); last = now;
      if(!reduce) t += dt;
      var k = reduce ? 1 : 1 - Math.pow(0.0015, dt);   // lerp independiente del framerate
      prog += (target - prog) * k; if(Math.abs(target-prog)<1e-4) prog = target;
      smx += (mx-smx)*k*0.5; smy += (my-smy)*k*0.5;
      var f = prog*3, i0 = Math.min(2, Math.floor(f)), u = f - i0, e = u*u*(3-2*u);
      var A = STEPS[i0].cam, B = STEPS[i0+1].cam;
      var cy = A.y+(B.y-A.y)*e, cd = A.d+(B.d-A.d)*e, yaw = A.yaw+(B.yaw-A.yaw)*e + smx*0.25 + (reduce?0:Math.sin(t*0.25)*0.06);
      camera.position.set(Math.sin(yaw)*cd, cy + 0.12 - smy*0.08, Math.cos(yaw)*cd);
      camera.lookAt(0, cy, 0);
      var br = reduce ? 1 : 1 + Math.sin(t*1.3)*0.004;      // respiración
      pts.scale.set(br,br,br);
      var w = uniforms.uW.value; for(var i=0;i<4;i++){ var v = Math.max(0, 1-Math.abs(f-i)); w.setComponent(i, v*v*(3-2*v)); }
      var ph = (t*1.1)%1;
      uniforms.uBeat.value = reduce ? 0.6 : Math.pow(Math.max(0, Math.sin(ph*Math.PI*2)), 6)*0.8 + Math.pow(Math.max(0, Math.sin((ph-0.18)*Math.PI*2)),10)*0.35;
      uniforms.uTime.value = reduce ? 4.0 : t;
      renderer.render(scene, camera);
      var idx = Math.round(f);
      if(idx !== activeIdx){
        activeIdx = idx;
        dots.forEach(function(d,j){ d.setAttribute('aria-current', j===idx ? 'step' : 'false'); });
        cards.forEach(function(c,j){ c.classList.toggle('on', j===idx); });
      }
      var a = STEPS[idx].anchor; tmp.set(a[0]*br,a[1]*br,a[2]*br).project(camera);
      var sx = (tmp.x*0.5+0.5)*W, sy = (-tmp.y*0.5+0.5)*H;  // project() ya incluye el view offset
      marker.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
      marker.style.opacity = (1 - Math.min(1, Math.abs(f-idx)*3)).toFixed(2);
      frames++; api.frames = frames;
      if(!once && running) requestAnimationFrame(frame);
    }
    // Solo anima mientras la sección está en pantalla; con reduced-motion, 0 frames en reposo.
    function setRunning(on){
      if(reduce) return;
      if(on && !running){ running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if(!on){ running = false; }
    }
    var api = window.__cuerpo3d = { frames:0, points:data.count, setProgress:function(p){ target = p; prog = p; frame(0,true); } };

    addEventListener('resize', resize);
    addEventListener('scroll', function(){ readScroll(); if(reduce && visible) frame(0, true); }, { passive:true });
    addEventListener('pointermove', function(e){ mx = e.clientX/innerWidth*2-1; my = e.clientY/innerHeight*2-1; }, { passive:true });
    new IntersectionObserver(function(es){ visible = es[es.length-1].isIntersecting; setRunning(visible); }).observe(root);
    readScroll(); prog = target; resize(); frame(0, true);
  }
})();
