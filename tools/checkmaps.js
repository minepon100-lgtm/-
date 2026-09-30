global.window = {};
require('../js/maps.js');
const M = window.MAPS;
let ok = true;
for (const f in M) {
  const m = M[f], g = m.grid;
  g.forEach((r, i) => { if (r.length !== 20) { console.log(`F${f} row ${i} len ${r.length}`); ok = false; } });
  if (g.length !== 20) { console.log(`F${f} rows ${g.length}`); ok = false; }
  const s = m.start; if (g[s.y][s.x] !== 'U') { console.log(`F${f} start not U`); ok = false; }
  const bfs = (allowL) => { const seen = new Set([s.x+','+s.y]); const q = [[s.x, s.y]];
    while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx=x+dx, ny=y+dy, c=g[ny]?.[nx]; if (!c || c==='#' || (c==='L'&&!allowL)) continue; const k=nx+','+ny; if(!seen.has(k)){seen.add(k); q.push([nx,ny]);} } }
    return seen; };
  const s1 = bfs(false); let hasK = false;
  for (let y=0;y<20;y++) for (let x=0;x<20;x++) if (g[y][x]==='K' && s1.has(x+','+y)) hasK = true;
  const s2 = bfs(hasK);
  let floors = 0;
  for (let y=0;y<20;y++) for (let x=0;x<20;x++) { const c=g[y][x]; if (c==='#') continue; floors++;
    if (!s2.has(x+','+y)) { if (c!=='.') { console.log(`F${f} unreachable ${c} at ${x},${y}`); ok=false; } else console.log(`F${f} unreachable floor ${x},${y}`); }
    // dead check: door cells should sit between walls
  }
  // boundary
  for (let i=0;i<20;i++) if (g[0][i]!=='#'||g[19][i]!=='#'||g[i][0]!=='#'||g[i][19]!=='#') { console.log(`F${f} border open at ${i}`); ok=false; }
  console.log(`F${f}: cells ${floors}, reachable ${s2.size}, key ${hasK}`);
}
console.log(ok ? 'OK' : 'NG');
// ガード検証: X/L を壁扱いにして S に到達できないこと
for (const f in M) { const m=M[f], g=m.grid, s=m.start; const seen=new Set([s.x+','+s.y]); const q=[[s.x,s.y]]; let reachS=false;
  while(q.length){const [x,y]=q.shift(); if(g[y][x]==='S') reachS=true; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,c=g[ny][nx]; if('#XLB'.includes(c))continue; const k=nx+','+ny; if(!seen.has(k)){seen.add(k);q.push([nx,ny]);}}}
  const hasS = m.grid.some(r=>r.includes('S'));
  console.log(`F${f}: S bypassable without guard = ${hasS && reachS}`);
}
