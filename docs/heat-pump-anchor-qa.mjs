const pages = await (await fetch('http://localhost:9224/json')).json();
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  window.qaApp = await (await import('/src/main.js')).showroom;
  const T = await import('three');
  const {ROOFTOP_MARKERS}=await import('/src/hotspots/rooftop-markers.js');
  const building=qaApp.scene.getObjectByName('rooftopMarkers').parent;
  building.updateWorldMatrix(true,true);
  const inverse=building.matrixWorld.clone().invert(),p=new T.Vector3();
  const groups=[[],[]];
  building.traverse(n=>{
    const pos=n.geometry?.attributes.position, uv=n.geometry?.attributes.uv;
    if(!pos||!uv||!n.geometry.attributes.flowSurface)return;
    const matrix=inverse.clone().multiply(n.matrixWorld);
    for(const i of new Set(n.geometry.index.array)){
      if(Math.round((uv.getX(i)-0.015625)*32)!==3)continue;
      p.fromBufferAttribute(pos,i).applyMatrix4(matrix);
      const u=(p.x-p.z)/Math.SQRT2,v=(p.x+p.z)/Math.SQRT2,h=p.y;
      if(u>=29.3&&u<=32.2&&v>=-20.6&&v<=-19.6&&h>=2.95&&h<=4.8)groups[u<30.85?0:1].push([u,v,h]);
    }
  });
  return groups.map((points,index)=>{
    const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i])));
    const max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
    const marker=ROOFTOP_MARKERS.find(a=>a.id===(index?'heat-pump-2':'central-structure'));
    const [x,h,z]=marker.position, u=(x-z)/Math.SQRT2, v=(x+z)/Math.SQRT2;
    const centered=Math.abs(u-(min[0]+max[0])/2)<0.001&&Math.abs(h-(min[2]+max[2])/2)<0.001&&Math.abs(v-max[1])<0.001&&marker.offset===0.02;
    return {id:marker.id,count:points.length,min,max,centered};
  });
})()`}}));
socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id===1){console.log(JSON.stringify(m.result,null,2));if(!m.result?.result?.value?.every(v=>v.centered))process.exitCode=1;socket.close();}});
