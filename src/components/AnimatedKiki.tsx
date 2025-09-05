import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import kikiIdle from "@/assets/animations/kiki_vector_anim_idle_1.json";
import { usePetStore } from "@/store";
import { getItemById } from "@/lib/itemRegistry";
import { useMemoryPressure } from "@/hooks/useMemoryPressure";
import { getDeviceCapabilities } from "@/utils/mobileOptimizations";

type KF = { t:number; s:number[] };
const isKF = (k:any)=> Array.isArray(k.k) && k.k.length && typeof k.k[0].t === "number";
function interp(k:any, f:number): number[] {
  const kk = k.k;
  if (!Array.isArray(kk)) return kk;
  if (!kk.length) return [0,0,0];
  if (!isKF(k)) return kk;
  let i = 0; while (i < kk.length-1 && kk[i+1].t <= f) i++;
  const a = kk[i] as KF, b = kk[Math.min(i+1, kk.length-1)] as KF;
  if (!b || a.t === b.t) return a.s;
  const u = (f - a.t)/(b.t - a.t);
  const S=a.s, T=b.s;
  return [ S[0]+(T[0]-S[0])*u, S[1]+(T[1]-S[1])*u, (S[2]??0)+((T[2]??0)-(S[2]??0))*u ];
}
function deg2rad(d:number){return d*Math.PI/180}
function M_T(x:number,y:number){return [1,0,x, 0,1,y, 0,0,1]}
function M_R(d:number){const c=Math.cos(deg2rad(d)),s=Math.sin(deg2rad(d));return [c,-s,0, s,c,0, 0,0,1]}
function M_S(x:number,y:number){return [x,0,0, 0,y,0, 0,0,1]}
function mul(a:number[],b:number[]){return [
  a[0]*b[0]+a[1]*b[3]+a[2]*b[6], a[0]*b[1]+a[1]*b[4]+a[2]*b[7], a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
  a[3]*b[0]+a[4]*b[3]+a[5]*b[6], a[3]*b[1]+a[4]*b[4]+a[5]*b[7], a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
  a[6]*b[0]+a[7]*b[3]+a[8]*b[6], a[6]*b[1]+a[7]*b[4]+a[8]*b[7], a[6]*b[2]+a[7]*b[5]+a[8]*b[8],
]}
function decompose(M:number[]){const a=M[0],b=M[3],c=M[1],d=M[4],tx=M[2],ty=M[5];return{
  x:tx,y:ty,rot:Math.atan2(b,a)*180/Math.PI,sx:Math.hypot(a,b),sy:Math.hypot(c,d)}}
function findLayer(json:any, name:string){
  const seen=new Set<string>();
  function walk(layers:any[], scope:any): any{
    for(const l of layers){
      if(l.nm===name) return {layer:l, scope};
      if(l.ty===0 && l.refId && !seen.has(l.refId)){
        seen.add(l.refId);
        const asset=(json.assets||[]).find((a:any)=>a.id===l.refId);
        if(asset?.layers){ const hit=walk(asset.layers, asset); if(hit) return hit; }
      }
    } return null;
  }
  return walk(json.layers, json);
}
function worldMatrix(layer:any, scope:any, frame:number, dampRotation:boolean = false): number[]{
  const p=interp(layer.ks.p,frame), s=interp(layer.ks.s,frame),
        r=isKF(layer.ks.r)? interp(layer.ks.r,frame)[0] : (layer.ks.r.k||0),
        a=Array.isArray(layer.ks.a?.k)? layer.ks.a.k : [0,0,0];
  
  // Damping dla włosów - zmniejsz rotację o 70%
  const actualR = dampRotation ? r * 0.3 : r;
  
  let M=mul(mul(mul(M_T(p[0],p[1]), M_R(actualR)), M_S(s[0]/100, s[1]/100)), M_T(-a[0],-a[1]));
  if(layer.parent){
    const par = (scope.layers as any[]).find((x:any)=>x.ind===layer.parent);
    if(par) M = mul(worldMatrix(par, scope, frame, dampRotation), M);
  }
  return M;
}

// helpers
const clamp = (v:number, lo:number, hi:number)=> Math.max(lo, Math.min(hi, v));
const shortest = (a:number)=> { // map do (-180,180]
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  return x;
};

// Universal animation states for all items
const itemAnimationStates = new Map<number, {
  init: boolean,
  angle: number,
  neutralRot: number,
  fixedX: number,
  fixedY: number,
  // Universal animation properties
  lastTime: number,
  floatingOffset: number,
  rotationAngle: number,
  pulsePhase: number
}>();


export default function AnimatedKiki() {
  const { equippedItems } = usePetStore();
  const { optimizations, shouldReduceQuality } = useMemoryPressure();
  const deviceCapabilities = getDeviceCapabilities();
  
  const wrapRef = useRef<HTMLDivElement>(null);
  const lotRef  = useRef<HTMLDivElement>(null);
  const ovRef   = useRef<HTMLDivElement>(null);
  const hatBack = useRef<HTMLImageElement>(null);
  const hatFront= useRef<HTMLImageElement>(null);
  const shirt   = useRef<HTMLImageElement>(null);
  const accessory = useRef<HTMLImageElement>(null);
  const animRef = useRef<any>(null);
  

  // Element mapping
  const getElementByLayer = (layer: string) => {
    switch (layer) {
      case 'hatBack': return hatBack.current;
      case 'hatFront': return hatFront.current;
      case 'shirt': return shirt.current;
      case 'accessory': return accessory.current;
      default: return null;
    }
  };

  // Lottie initialization - once only
  useEffect(() => {
    // Clear item animation states on mount
    itemAnimationStates.clear();
    
    const anim = lottie.loadAnimation({
      container: lotRef.current!,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: kikiIdle as any,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });
    
    animRef.current = anim;

    const onDom = () => {
      const svg = lotRef.current!.querySelector("svg") as SVGSVGElement;
      if (!svg) return;
      const sockets = {
        head: findLayer(kikiIdle as any, "head_socket"),
        body: findLayer(kikiIdle as any, "body_socket"),
      };
      
      const parseVB = () => (svg.getAttribute("viewBox") || `0 0 ${(kikiIdle as any).w} ${(kikiIdle as any).h}`)
                              .split(" ").map(Number) as number[];
      
      // Mapowanie viewBox -> pixels
      const mapToPixels = (svg: SVGSVGElement, wrap: HTMLElement, dimensions: number[], x: number, y: number) => {
        const [vbX, vbY, vbW] = parseVB();
        const rect = svg.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const scale = rect.width / vbW;
        const offX = rect.left - wrapRect.left;
        const offY = rect.top - wrapRect.top;
        const px = offX + (x - vbX) * scale;
        const py = offY + (y - vbY) * scale;
        return { px, py };
      };


      // Helper render function
      function render(el: HTMLElement, px: number, py: number, angle: number, dx: number, dy: number, scale: number) {
        el.style.transform =
          `translate(${px}px, ${py}px)` +
          `translate(-50%, -100%)` +
          `rotate(${angle}deg)` +
          `translate(${dx}px, ${dy}px)` +
          `scale(${scale})`;
      }

      // Get or create item state
      function getItemState(itemId: number) {
        let state = itemAnimationStates.get(itemId);
        if (!state) {
          state = { init: false, angle: 0, neutralRot: 0, fixedX: 0, fixedY: 0, lastTime: 0, floatingOffset: 0, rotationAngle: 0, pulsePhase: 0 };
          itemAnimationStates.set(itemId, state);
        }
        return state;
      }

      // Universal item animation function
      function updateItemWithAnimation(frame: number, socket: any, el: HTMLImageElement | null, itemDef: any, itemId: number) {
        if (!socket || !el || !itemDef.renderProps) return;

        const { dx = 0, dy = 0, scale = 1.0, animationType = 'static' } = itemDef.renderProps;
        
        // 1) world transform socketu
        const M = worldMatrix(socket.layer, socket.scope, frame);
        const { x, y, rot } = decompose(M);

        // 2) mapowanie viewBox -> piksele co klatkę
        const [vbX, vbY, vbW] = (svg.getAttribute("viewBox") || `0 0 ${(kikiIdle as any).w} ${(kikiIdle as any).h}`)
          .split(" ").map(Number);
        const wrapRect = wrapRef.current!.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const sc = svgRect.width / vbW;
        const offX = svgRect.left - wrapRect.left;
        const offY = svgRect.top - wrapRect.top;
        const px = offX + (x - vbX) * sc;
        const py = offY + (y - vbY) * sc;

        // 3) per-item state
        const st = getItemState(itemId);

        // 4) wybór strategii animacji
        switch (animationType) {
          case 'physics': {
            const physics = itemDef.renderProps.physics || {};
            const follow = physics.follow ?? 1.0;
            const damping = physics.damping ?? 0.2;
            const bias = physics.bias ?? 0;
            const invert = physics.invert ?? false;

            if (!st.init) {
              st.angle = 0; // baza 0°
              st.init = true;
            }

            let headDeg = rot;
            if (invert) headDeg = -headDeg;
            st.angle += (headDeg - st.angle) * damping;
            const finalAngle = st.angle * follow - bias;
            
            render(el, px, py, finalAngle, dx, dy, scale);
            break;
          }

          case 'floating': {
            const floating = itemDef.renderProps.floating || {};
            const amplitude = floating.amplitude ?? 5;
            const frequency = floating.frequency ?? 1.0;
            const phase = floating.phase ?? 0;

            const t = frame / 60; // convert frame to time
            const floatY = Math.sin(t * frequency * 2 + phase) * amplitude;
            
            render(el, px, py + floatY, rot, dx, dy, scale);
            break;
          }

          case 'pulse': {
            const pulse = itemDef.renderProps.pulse || {};
            const minScale = pulse.minScale ?? 0.9;
            const maxScale = pulse.maxScale ?? 1.1;
            const freq = pulse.frequency ?? 1.0;

            const t = frame / 60;
            const pulseAmount = Math.sin(t * freq * 2 * Math.PI) * 0.5 + 0.5; // 0-1
            const finalScale = scale * (minScale + (maxScale - minScale) * pulseAmount);
            
            render(el, px, py, rot, dx, dy, finalScale);
            break;
          }

          case 'static':
          default:
            render(el, px, py, rot, dx, dy, scale);
            break;
        }
      }




      const onFrame = (e:any) => {
        const f = e.currentTime;
        
        // Get current equipped items from store (avoid closure capture)
        const currentEquipped = usePetStore.getState().equippedItems;
        
        // Render all equipped items with universal system
        Object.values(currentEquipped).forEach(equippedItem => {
          if (!equippedItem) return;
          
          const itemDef = getItemById(equippedItem.id);
          if (!itemDef) return;
          
          const element = getElementByLayer(itemDef.renderLayer);
          const socket = sockets[itemDef.renderProps?.socket || 'head'];
          
          // Universal animation system for all items
          console.log(`🎭 Universal render: id=${equippedItem.id}, type=${itemDef.renderProps?.animationType || 'static'}`);
          updateItemWithAnimation(f, socket, element, itemDef, equippedItem.id);
        });
      };

      anim.addEventListener("enterFrame", onFrame);
      const ro = new ResizeObserver(()=>{/* nic – liczymy rect co frame */});
      ro.observe(wrapRef.current!);

      return () => {
        anim.removeEventListener("enterFrame", onFrame);
        ro.disconnect();
      };
    };

    anim.addEventListener("DOMLoaded", onDom);
    return () => { 
      // Clear all item animation states
      itemAnimationStates.clear();
      
      // Cleanup imgs first to prevent flicker
      if (hatBack.current) {
        hatBack.current.style.visibility = "hidden";
        hatBack.current.style.transform = "";
      }
      if (hatFront.current) {
        hatFront.current.style.visibility = "hidden";
        hatFront.current.style.transform = "";
      }
      if (shirt.current) {
        shirt.current.style.visibility = "hidden";
        shirt.current.style.transform = "";
      }
      if (accessory.current) {
        accessory.current.style.visibility = "hidden";
        accessory.current.style.transform = "";
      }
      
      if (animRef.current) {
        animRef.current.destroy(); 
        animRef.current = null;
      }
      if (ovRef.current) {
        ovRef.current.innerHTML="";
      }
    };
  }, []);

  // Update equipped items without restarting animation - data-driven approach
  useEffect(() => {
    
    function ensure(img: HTMLImageElement | null, src: string, isHair: boolean = false) {
      if (!img) return;
      
      if (src) {
        img.src = src;
        img.style.position = "absolute";
        img.style.left = "0"; 
        img.style.top = "0";
        img.style.pointerEvents = "none";
        img.style.transformOrigin = isHair ? "50% 100%" : "50% 50%";
        img.style.visibility = "visible";
        // Initialize transform immediately for hair to prevent flicker
        if (isHair) {
          img.style.transform = `translate(0px, 0px) translate(-50%, -100%) rotate(0deg) translate(0px, 0px) scale(0.4)`;
        }
      } else {
        img.src = "";
        img.style.visibility = "hidden";
        // Reset transform when hiding
        if (isHair) {
          img.style.transform = "";
        }
      }
    }
    
    // Reset all elements first
    ensure(hatBack.current, "");
    ensure(hatFront.current, "", true);
    ensure(shirt.current, "");
    ensure(accessory.current, "");
    
    // Apply equipped items based on registry definitions
    Object.values(equippedItems).forEach(equippedItem => {
      if (!equippedItem) return;
      
      const itemDef = getItemById(equippedItem.id);
      if (!itemDef) return;
      
      const element = getElementByLayer(itemDef.renderLayer);
      ensure(element, itemDef.imagePath, itemDef.isHair);
    });
    
    // Debug log
    console.log('AnimatedKiki equipped items:', equippedItems);
  }, [equippedItems]);

  return (
    <div ref={wrapRef} style={{ position:"relative", width: 360, height: 360 }}>
      <div ref={lotRef} style={{ position:"absolute", inset:0 }} />
      {/* overlay na itemy */}
      <div ref={ovRef} style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <img ref={hatBack}  alt="" />
        <img ref={shirt}    alt="" />
        <img ref={accessory} alt="" />
        <img ref={hatFront} alt="" />
      </div>
    </div>
  );
}