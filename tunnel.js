// tunnel.js — Effet « Tunnel infini » (formes géométriques psychédéliques qui avancent)
// Partagé par lab-tunnel.html et (plus tard) index.html.
// API : const fx = makeTunnel(canvas, reglages)
//   fx.set(reglages)   remplace/complète les réglages
//   fx.kick(force=1)   déclenche la réaction au kick
//   fx.frame(nowMs)    dessine une image (à appeler dans requestAnimationFrame)
//   fx.resize(resMax)  recalcule la taille (resMax = plafond du devicePixelRatio)
//   fx.destroy()
(function (g) {
  const TUNNEL_DEF = {
    // Forme
    cotes: 6,          // 0-2 = cercle, 3 = triangle, 4 = carré…
    couches: 14,       // nombre de formes visibles en même temps
    epaisseur: 0.045,  // épaisseur du trait
    remplissage: 0.3,  // bandes colorées entre les formes
    kaleido: 0,        // 0 = off, sinon nombre de segments du kaléidoscope
    fondTunnel: 0.35,  // intensité du tunnel rayé en fond
    rayures: 8,        // rayures du tunnel de fond
    // Mouvement
    vitesse: 1.2,      // formes traversées par seconde
    torsion: 0.12,     // rotation entre deux formes successives
    rotation: 0.15,    // rotation globale continue
    ondulation: 0.2,   // déformation liquide
    derive: 0.3,       // le point de fuite se balade
    brouillard: 0.5,   // les formes lointaines s'éteignent
    // Couleurs
    teinte: 0.6,
    vitesseTeinte: 0.04,
    ecartTeinte: 0.07, // décalage de teinte d'une forme à l'autre
    saturation: 0.85,
    lueur: 0.6,
    // Kick
    kickVitesse: 2.5,   // accélération (multiplie la vitesse)
    kickDuree: 0.35,    // durée de la retombée (s)
    kickZoom: 0.25,     // coup de zoom
    kickFlash: 0.25,
    kickTeinte: 0.08,   // saut de couleur
    kickEpaisseur: 0.6  // les traits gonflent
  };

  const TUNNEL_BUILTIN = [
    { nom: "Triangle 1", reglages: { cotes: 3, couches: 11, epaisseur: 0.06, remplissage: 0.4, kaleido: 0, fondTunnel: 0.2, rayures: 2,
        vitesse: 1.75, torsion: 0.14, rotation: -0.12, ondulation: 0.7, derive: 0, brouillard: 0.9, teinte: 0.5, vitesseTeinte: 0.055,
        ecartTeinte: 0.04, saturation: 0.75, lueur: 0.15, kickVitesse: 1, kickDuree: 0.35, kickZoom: 0.2, kickFlash: 0.2,
        kickTeinte: 0.08, kickEpaisseur: 0.8 } },
    { nom: "Néon hexagones", reglages: { ...TUNNEL_DEF } },
    { nom: "Kaléido acide", reglages: { ...TUNNEL_DEF, cotes: 3, couches: 18, kaleido: 6, torsion: 0.3, rotation: 0.3,
        remplissage: 0.55, fondTunnel: 0.2, ecartTeinte: 0.13, vitesseTeinte: 0.08, saturation: 1, ondulation: 0.4, kickTeinte: 0.2 } },
    { nom: "Hyperespace", reglages: { ...TUNNEL_DEF, cotes: 0, couches: 22, vitesse: 2.2, epaisseur: 0.025, torsion: 0,
        rotation: 0.05, remplissage: 0, fondTunnel: 0.9, rayures: 14, teinte: 0.55, ecartTeinte: 0.015, saturation: 0.6,
        lueur: 1, derive: 0.15, kickVitesse: 4, kickZoom: 0.15 } },
    { nom: "Carrés hypnose", reglages: { ...TUNNEL_DEF, cotes: 4, couches: 12, vitesse: 0.8, epaisseur: 0.07, torsion: 0.08,
        rotation: 0, remplissage: 0.8, fondTunnel: 0, ecartTeinte: 0.5, saturation: 0.9, lueur: 0.3, ondulation: 0 } }
  ];

  const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS = `
precision highp float;
uniform vec2 uRes; uniform vec2 uCenter;
uniform float uT,uRot,uHue,uFlash,uPunch,uThick,uSides,uLayers,uTwist,uKal,uFill,uTun,uStripes,uSat,uHueStep,uGlow,uWarp,uFog,uTime;
#define TAU 6.2831853
vec3 hsv(float h,float s,float v){vec3 k=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return v*mix(vec3(1.),k,s);}
float poly(vec2 p,float n){if(n<2.5)return length(p);float a=atan(p.y,p.x);float s=TAU/n;return cos(floor(.5+a/s)*s-a)*length(p);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
void main(){
  float m=min(uRes.x,uRes.y);
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/m;
  uv-=uCenter;
  uv*=1.-.35*uPunch;
  uv+=uWarp*.04*vec2(sin(uv.y*7.+uTime*1.1),cos(uv.x*7.-uTime*.9));
  if(uKal>1.5){float r=length(uv);float a=atan(uv.y,uv.x)+uRot*.5;float s=TAU/floor(uKal);a=mod(a,s);a=abs(a-.5*s);uv=vec2(cos(a),sin(a))*r;}
  float r=max(length(uv),1e-3);
  vec3 col=vec3(0.);
  // Tunnel de fond (synchro avec les formes : même profondeur)
  if(uTun>.001){
    float a=atan(uv.y,uv.x);
    float wz=1./r;
    float z=wz+8.*uT/uLayers;
    float b=sin(a*floor(uStripes)+z*.6+uRot)*sin(z*TAU*.5);
    float v=smoothstep(0.,.25,b);
    col+=hsv(uHue+z*uHueStep*.5,uSat,1.)*v*exp(-wz*uFog*.35)*uTun*.6;
  }
  // Formes qui avancent
  float aa=2./m;
  vec3 fillC=vec3(0.); float found=0.;
  for(int i=0;i<32;i++){
    if(float(i)>=uLayers)break;
    float n=floor(uT)-float(i);
    float p=(uT-n)/uLayers;
    float z=8.*(1.-p)+.08;
    vec2 q=rot(uRot+n*uTwist)*uv*z;
    float pd=poly(q,uSides);
    float d=abs(pd-1.);
    float fade=smoothstep(0.,.12,p)*exp(-z*uFog*.25);
    vec3 c=hsv(uHue+n*uHueStep,uSat,1.);
    float core=1.-smoothstep(uThick*.5,uThick*.5+aa*z,d);
    float glow=uGlow*uThick*.15/(d+uThick*.5);
    col+=c*(core+glow)*fade;
    float ins=1.-smoothstep(1.-aa*z,1.,pd);
    float par=mod(n,2.)<.5?1.:.3;
    fillC+=c*par*fade*ins*(1.-found);
    found=max(found,ins);
  }
  col=col+fillC*uFill*.45;
  col+=uFlash*(vec3(.35)+hsv(uHue+.5,uSat,.4));
  col=1.-exp(-col*1.3);
  gl_FragColor=vec4(col,1.);
}`;

  function makeTunnel(canvas, reglages) {
    const R = { ...TUNNEL_DEF, ...(reglages || {}) };
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL indisponible");
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ["uRes", "uCenter", "uT", "uRot", "uHue", "uFlash", "uPunch", "uThick", "uSides", "uLayers", "uTwist", "uKal", "uFill",
      "uTun", "uStripes", "uSat", "uHueStep", "uGlow", "uWarp", "uFog", "uTime"].forEach(k => U[k] = gl.getUniformLocation(pr, k));

    let resMax = 1.5, last = 0, time = 0, t = 0, rotA = 0, hue = R.teinte, hueOff = 0, hueTarget = 0, env = 0;

    function resize(rm) {
      if (rm) resMax = rm;
      // Canvas hors page (source virtuelle de l'app) : on garde la taille fixée par l'appelant
      if (canvas.clientWidth) {
        const d = Math.min(window.devicePixelRatio || 1, resMax);
        const w = Math.max(1, Math.round(canvas.clientWidth * d)), h = Math.max(1, Math.round(canvas.clientHeight * d));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function kick(f = 1) { env = Math.max(env, Math.min(1.5, f)); hueTarget += R.kickTeinte; }
    function set(r) { const old = R.teinte; Object.assign(R, r || {}); if (R.teinte !== old) hue = R.teinte; }

    function frame(now) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now;
      resize();
      time += dt;
      env *= Math.exp(-dt / Math.max(0.03, R.kickDuree));
      const boost = R.kickVitesse * env;
      t += dt * R.vitesse * (1 + boost);
      rotA = (rotA + dt * R.rotation * (1 + boost * 0.5)) % (Math.PI * 2);
      hue = (hue + dt * R.vitesseTeinte) % 1;
      hueOff += (hueTarget - hueOff) * Math.min(1, dt * 12);
      if (hueTarget > 10) { hueTarget -= 10; hueOff -= 10; }
      const L = Math.max(2, Math.min(32, Math.round(R.couches)));
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uCenter, R.derive * 0.12 * Math.sin(time * 0.31), R.derive * 0.12 * Math.sin(time * 0.23 + 1));
      gl.uniform1f(U.uT, t); gl.uniform1f(U.uRot, rotA); gl.uniform1f(U.uHue, (hue + hueOff) % 1);
      gl.uniform1f(U.uFlash, R.kickFlash * env * env); gl.uniform1f(U.uPunch, R.kickZoom * env);
      gl.uniform1f(U.uThick, R.epaisseur * (1 + R.kickEpaisseur * env));
      gl.uniform1f(U.uSides, Math.round(R.cotes)); gl.uniform1f(U.uLayers, L); gl.uniform1f(U.uTwist, R.torsion);
      gl.uniform1f(U.uKal, Math.round(R.kaleido)); gl.uniform1f(U.uFill, R.remplissage); gl.uniform1f(U.uTun, R.fondTunnel);
      gl.uniform1f(U.uStripes, Math.round(R.rayures)); gl.uniform1f(U.uSat, R.saturation); gl.uniform1f(U.uHueStep, R.ecartTeinte);
      gl.uniform1f(U.uGlow, R.lueur); gl.uniform1f(U.uWarp, R.ondulation); gl.uniform1f(U.uFog, R.brouillard);
      gl.uniform1f(U.uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function destroy() { gl.deleteProgram(pr); gl.deleteBuffer(bf); }
    return { set, kick, frame, resize, destroy, get reglages() { return { ...R }; } };
  }

  g.TUNNEL_DEF = TUNNEL_DEF; g.TUNNEL_BUILTIN = TUNNEL_BUILTIN; g.makeTunnel = makeTunnel;
})(window);
