/* =====================================================================
   Nuée d'étourneaux — simulation partagée (labo + app)
   makeFlock() renvoie { canvas, update(dtMs, now), kick(now), set(params), params }
   Les valeurs par défaut reproduisent la nuée d'origine de l'app.
   ===================================================================== */
(function(){
const FLOCK_DEF = {
  // Nuée
  count:2000, speed:1, minSpeed:2.2, maxSpeed:4.4, jitter:0.03,
  // Règles de vol
  perception:40, maxNeighbors:44, align:0.06, cohesion:0.002, separation:1.4, sepDist:9,
  // Forme d'ensemble
  spread:1, pullBase:0.02, pullFar:0.07, pullLone:0.14, loneCount:6, antiSpin:0.04,
  // Trajet
  attract:0.05, wanderX:0.13, wanderY:0.07, wanderSpeed:1, recenter:0.2, edgeMargin:100, edgeForce:0.15,
  // Prédateur
  predOn:1, predEvery:5, predRand:9, predSpeed:7, predRadius:120, predForce:0.35,
  // Réaction au kick
  waveDir:0, waveAmp:14, waveDur:650, waveWidth:0.18, waveRipple:0.09, waveDense:1.6,
  kickScatter:0, kickBoost:0, kickFlash:0,
  // Apparence
  birdSize:2, opacity:0.9, stretch:0, trail:0, color:'#f0f2f8', bg:'#000000',
};

function makeFlock(init){
  const W = 1280, H = 720;
  const P = Object.assign({}, FLOCK_DEF, init || {});
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  let R = 0, CW = 0, CH = 0, head = null;
  let n = 0, px, py, vx, vy, nxt;
  let t = 0, cxF = W/2, cyF = H/2, ext = 300, RT = 280, spin = 0, env = 0, lastNow = 0;
  const waves = [];
  const pred = { x:-999, y:-999, vx:0, vy:0, on:false, wait:5 };

  function grid(){
    R = Math.max(8, P.perception|0);
    CW = Math.ceil(W/R) + 2; CH = Math.ceil(H/R) + 2; head = new Int32Array(CW*CH);
  }
  function alloc(count){
    n = Math.max(1, count|0);
    px = new Float32Array(n); py = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
    nxt = new Int32Array(n);
    const a0 = Math.random()*6.28;
    for (let i = 0; i < n; i++){
      const r = Math.sqrt(Math.random())*160, a = Math.random()*6.28;
      px[i] = W/2 + Math.cos(a)*r*1.6; py[i] = H/2 + Math.sin(a)*r*0.7;
      vx[i] = Math.cos(a0)*3 + (Math.random()-0.5); vy[i] = Math.sin(a0)*3 + (Math.random()-0.5);
    }
  }
  grid(); alloc(P.count);

  function step(dt){
    t += dt/60;
    RT = (90 + Math.sqrt(n)*3)*P.spread;
    const ws = P.wanderSpeed;
    const tx = W*0.5 + W*P.wanderX*Math.sin(t*0.21*ws)*Math.cos(t*0.083*ws);
    const ty = H*0.5 + H*P.wanderY*Math.sin(t*0.27*ws + 1.3);
    // Prédateur invisible
    if (!pred.on){
      pred.wait -= dt/60;
      if (pred.wait <= 0 && P.predOn){
        const left = Math.random() < 0.5;
        pred.x = left ? -120 : W + 120; pred.y = H*(0.15 + Math.random()*0.7);
        const dx = cxF - pred.x, dy = cyF - pred.y, d = Math.hypot(dx, dy) || 1;
        pred.vx = dx/d*P.predSpeed; pred.vy = dy/d*P.predSpeed; pred.on = true;
      }
    } else {
      pred.x += pred.vx*dt; pred.y += pred.vy*dt;
      if (!P.predOn || pred.x < -250 || pred.x > W + 250 || pred.y < -250 || pred.y > H + 250){
        pred.on = false; pred.wait = P.predEvery + Math.random()*P.predRand;
      }
    }
    // Grille de voisinage
    head.fill(-1);
    for (let i = 0; i < n; i++){
      const c = (Math.min(CH-1, Math.max(0, (py[i]/R|0) + 1)))*CW + Math.min(CW-1, Math.max(0, (px[i]/R|0) + 1));
      nxt[i] = head[c]; head[c] = i;
    }
    let sx = 0, sy = 0;
    const ocx = (cxF - W/2)/(W/2), ocy = (cyF - H/2)/(H/2);
    const gcx = -Math.sign(ocx)*ocx*ocx*P.recenter, gcy = -Math.sign(ocy)*ocy*ocy*P.recenter;
    const R2 = R*R, sep2 = P.sepDist*P.sepDist, maxN = P.maxNeighbors;
    const mX = P.edgeMargin, mY = P.edgeMargin*1.2;
    const vMin = P.minSpeed, vMax = Math.max(vMin, P.maxSpeed*(1 + P.kickBoost*env));
    const pr = P.predRadius;
    for (let i = 0; i < n; i++){
      const x = px[i], y = py[i];
      const gx = Math.min(CW-2, Math.max(1, (x/R|0) + 1)), gy = Math.min(CH-2, Math.max(1, (y/R|0) + 1));
      let cnt = 0, mx = 0, my = 0, ax = 0, ay = 0, sepx = 0, sepy = 0, seen = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++){
        let j = head[(gy+oy)*CW + gx + ox];
        while (j !== -1 && seen < maxN){
          if (j !== i){
            const dx = px[j] - x, dy = py[j] - y, d2 = dx*dx + dy*dy;
            if (d2 < R2){
              seen++; cnt++; mx += px[j]; my += py[j]; ax += vx[j]; ay += vy[j];
              if (d2 < sep2){ sepx -= dx/(d2 + 1); sepy -= dy/(d2 + 1); }
            }
          }
          j = nxt[j];
        }
      }
      let fx = 0, fy = 0;
      if (cnt){
        fx += (ax/cnt - vx[i])*P.align + (mx/cnt - x)*P.cohesion;
        fy += (ay/cnt - vy[i])*P.align + (my/cnt - y)*P.cohesion;
      }
      fx += sepx*P.separation; fy += sepy*P.separation;
      const dxC = cxF - x, dyC = cyF - y, dC = Math.hypot(dxC, dyC) + 1;
      const over = Math.max(0, dC - RT)/RT;
      const pull = P.pullBase + P.pullFar*Math.min(1, over*over*4) + (cnt < P.loneCount ? P.pullLone : 0);
      fx += dxC/dC*pull; fy += dyC/dC*pull;
      const dxT = tx - x, dyT = ty - y, dT = Math.hypot(dxT, dyT) + 1;
      fx += dxT/dT*P.attract; fy += dyT/dT*P.attract;
      fx += gcx; fy += gcy;
      { const rx = x - cxF, ry = y - cyF, rr = Math.hypot(rx, ry) + 1;
        fx += spin*P.antiSpin*ry/rr; fy -= spin*P.antiSpin*rx/rr; }
      if (pred.on){
        const dx = x - pred.x, dy = y - pred.y, d = Math.hypot(dx, dy) + 1;
        if (d < pr){ const f = (1 - d/pr)*P.predForce; fx += dx/d*f; fy += dy/d*f; }
      }
      if (x < mX) fx += P.edgeForce; else if (x > W - mX) fx -= P.edgeForce;
      if (y < mY) fy += P.edgeForce; else if (y > H - mY) fy -= P.edgeForce;
      fx += (Math.random() - 0.5)*P.jitter; fy += (Math.random() - 0.5)*P.jitter;
      const nvx = vx[i] + fx*dt, nvy = vy[i] + fy*dt;
      const sp = Math.hypot(nvx, nvy) || 1;
      const cl = Math.min(vMax, Math.max(vMin, sp));
      vx[i] = nvx/sp*cl; vy[i] = nvy/sp*cl;
      sx += x; sy += y;
    }
    for (let i = 0; i < n; i++){ px[i] += vx[i]*dt; py[i] += vy[i]*dt; }
    { let L = 0, mvx = 0, mvy = 0, c = 0;
      for (let i = 0; i < n; i += 3){ mvx += vx[i]; mvy += vy[i]; c++; }
      mvx /= c; mvy /= c;
      for (let i = 0; i < n; i += 3){
        const rx = px[i] - cxF, ry = py[i] - cyF, ux = vx[i] - mvx, uy = vy[i] - mvy;
        L += (rx*uy - ry*ux)/((Math.hypot(rx, ry) + 1)*(Math.hypot(ux, uy) + 0.1));
      }
      spin = L/c; }
    cxF = sx/n; cyF = sy/n;
    let e = 0;
    for (let i = 0; i < n; i += 7) e = Math.max(e, Math.abs(px[i] - cxF), Math.abs(py[i] - cyF));
    ext = e;
  }

  const rgba = (h, a) => `rgba(${parseInt(h.substr(1,2),16)},${parseInt(h.substr(3,2),16)},${parseInt(h.substr(5,2),16)},${a})`;
  function draw(now){
    if (P.trail > 0.001){
      g.globalAlpha = Math.max(0.03, 1 - P.trail); g.fillStyle = P.bg; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    } else { g.fillStyle = P.bg; g.fillRect(0, 0, W, H); }
    const amp = P.waveAmp, size = P.birdSize, flash = P.kickFlash*env;
    for (let k = waves.length - 1; k >= 0; k--) if (now - waves[k].t0 > waves[k].dur) waves.splice(k, 1);
    const streak = P.stretch > 0.05;
    const col = rgba(P.color, Math.min(1, P.opacity*(1 + flash)));
    g.beginPath();
    for (let i = 0; i < n; i++){
      let x = px[i], y = py[i], s = 1.9*size*(1 + flash*0.5);
      for (const w of waves){
        const p = (now - w.t0)/w.dur;
        let d, ux, uy;
        if (w.ring){
          const rx = x - w.cx, ry = y - w.cy, rr = Math.hypot(rx, ry) + 1e-3;
          d = rr - p*w.ext*1.2; ux = rx/rr; uy = ry/rr;          // onde ronde : poussée vers l'extérieur
        } else {
          d = (x - w.cx)*w.c + (y - w.cy)*w.s - (-w.ext + p*2*w.ext); ux = -w.s; uy = w.c;
        }
        const en = Math.exp(-(d*d)/(w.width*w.width));
        if (en > 0.01){
          const o = amp*en*Math.sin(d*P.waveRipple);
          x += ux*o; y += uy*o;
          s += en*P.waveDense*size;
        }
      }
      if (streak){
        const k = P.stretch*2;
        g.moveTo(x - vx[i]*k, y - vy[i]*k); g.lineTo(x, y);
      } else {
        const r = s*0.6;
        g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.2832);
      }
    }
    if (streak){ g.strokeStyle = col; g.lineWidth = Math.max(0.5, 1.9*size*0.9*(1 + flash*0.5)); g.lineCap = 'round'; g.stroke(); }
    else { g.fillStyle = col; g.fill(); }
  }

  return {
    canvas: cv,
    params: P,
    update(dtMs, now){
      now = now || performance.now();
      env *= Math.exp(-Math.min(100, dtMs)*3/Math.max(50, P.waveDur));
      let d = Math.min(3, dtMs/16.7)*P.speed;
      while (d > 0){ const k = Math.min(1.5, d); step(k); d -= k; }
      draw(now); lastNow = now;
    },
    kick(now){
      now = now || performance.now();
      env = 1;
      let a, ring = false;
      switch (P.waveDir|0){
        case 1: a = Math.random() < 0.5 ? 0 : Math.PI; break;
        case 2: a = Math.random() < 0.5 ? Math.PI/2 : -Math.PI/2; break;
        case 3: a = Math.random()*Math.PI*2; break;
        case 4: a = 0; ring = true; break;
        default: a = (Math.random() < 0.7 ? 0 : Math.PI/2) + (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5)*0.6;
      }
      if (P.waveAmp > 0 || P.waveDense > 0)
        waves.push({ c:Math.cos(a), s:Math.sin(a), cx:cxF, cy:cyF, ext:ext + 60, ring,
                     width:Math.max(40, ext*P.waveWidth), t0:now, dur:P.waveDur });
      if (P.kickScatter > 0) for (let i = 0; i < n; i++){
        const rx = px[i] - cxF, ry = py[i] - cyF, rr = Math.hypot(rx, ry) + 1;
        vx[i] += rx/rr*P.kickScatter; vy[i] += ry/rr*P.kickScatter;
      }
    },
    set(o){
      const oldCount = P.count, oldPer = P.perception;
      for (const k in o) if (k in FLOCK_DEF) P[k] = o[k];
      if ((P.perception|0) !== (oldPer|0)) grid();
      if ((P.count|0) !== (oldCount|0)) alloc(P.count);
    },
    reset(){ alloc(P.count); waves.length = 0; pred.on = false; pred.wait = P.predEvery; },
  };
}
window.FLOCK_DEF = FLOCK_DEF;
window.makeFlock = makeFlock;
})();
