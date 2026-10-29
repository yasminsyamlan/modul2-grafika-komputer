// why is backward ~2x faster at 10x?  count segment tests actually executed per frame
import { loadPlan, makeWorldToScreen, defaultPlanPath } from "../plan.mjs";
const W=800,H=600, plan=loadPlan(defaultPlanPath()), w2s=makeWorldToScreen(plan,H);
for (const zoom of [1,10]) {
  const segs=[]; for (const pl of plan.polylines){const p=pl.points.map(q=>{const [x,y]=w2s(q);return [(x-W/2)*zoom+W/2,(y-H/2)*zoom+H/2]});
    for(let i=0;i+1<p.length;i++)segs.push([p[i],p[i+1]]); if(pl.closed&&p.length>2)segs.push([p.at(-1),p[0]]);}
  let tests=0,lit=0,len=0;
  for(const [a,b] of segs) len+=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const px=x+.5,py=y+.5;
    for(const [a,b] of segs){tests++;const vx=b[0]-a[0],vy=b[1]-a[1],wx=px-a[0],wy=py-a[1];const L2=vx*vx+vy*vy||1e-9;let t=(wx*vx+wy*vy)/L2;t=t<0?0:t>1?1:t;const dx=wx-t*vx,dy=wy-t*vy;if(dx*dx+dy*dy<=.5625){lit++;break}}}
  console.log(`zoom ${zoom}x: segments ${segs.length}  total length ${Math.round(len)} px  segment tests ${(tests/1e6).toFixed(2)}M  lit ${lit}`);
}
