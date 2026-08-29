import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useScroll, motion, useTransform, useSpring } from "framer-motion";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

useGLTF.preload("/spaceship.glb");

// ─── Procedural Stylized Rocket ────────────────────────────────────────────
function Rocket({ scrollY }: { scrollY: any }) {
  const group = useRef<THREE.Group>(null!);
  const { scene } = useGLTF("/spaceship.glb");

  useFrame((state, delta) => {
    if (!group.current) return;
    const progress = scrollY.get(); // 0 to 1
    
    // Base floating animation
    const floatY = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    
    // If progress approaches 1 (breakthrough), blast off
    const blastOff = progress > 0.95 ? (progress - 0.95) * 500 : 0;
    
    // Speed up as it goes up
    const accProgress = Math.pow(progress, 2);
    
    group.current.position.y = -2 + (accProgress * 4) + floatY + blastOff;
    group.current.rotation.x = Math.PI / 2; // Face up (pitch up 90 degrees)
    group.current.rotation.y = 0; // Rotated by 180 degrees as requested
    group.current.rotation.z = 0; // Keep it perfectly vertical
  });

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const rocketScale = isMobile ? 0.15 : 0.3;

  return (
    <group ref={group} scale={rocketScale}>
      <primitive object={scene} />
    </group>
  );
}

// ─── Exhaust Particles ─────────────────────────────────────────────────────
function Exhaust({ scrollY }: { scrollY: any }) {
  const fumeCount = 150;
  const sparkCount = 150;
  
  const fumesRef = useRef<THREE.InstancedMesh>(null!);
  const sparksRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const fumes = useMemo(() => {
    return Array.from({ length: fumeCount }, () => ({
      position: new THREE.Vector3(0, -100, 0), // hide initially
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: Math.random() * 0.8 + 0.4,
      scale: Math.random() * 0.5 + 0.3,
    }));
  }, []);

  const sparks = useMemo(() => {
    return Array.from({ length: sparkCount }, () => ({
      position: new THREE.Vector3(0, -100, 0),
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: Math.random() * 0.4 + 0.2,
      scale: Math.random() * 0.1 + 0.05,
    }));
  }, []);

  let nextFume = 0;
  let nextSpark = 0;

  useFrame((state, delta) => {
    if (!fumesRef.current || !sparksRef.current) return;
    
    const progress = scrollY.get();
    const isMoving = progress < 0.99; // Spawn as long as we haven't reached the very end
    
    // Spawn more particles as it speeds up, but keep a base idle amount
    const intensity = Math.max(0.8, progress * 4);
    
    // Spawn new particles if moving
    if (isMoving) {
      const blastOff = progress > 0.95 ? (progress - 0.95) * 500 : 0;
      const accProgress = Math.pow(progress, 2);
      const rY = -2 + (accProgress * 4) + Math.sin(state.clock.elapsedTime * 2) * 0.1 + blastOff;
      
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      const offset = isMobile ? 0.6 : 1.2;
      const spread = isMobile ? 0.75 : 1.5;

      // Spawn Fumes
      for (let i = 0; i < Math.floor(2 * intensity); i++) {
        const p = fumes[nextFume];
        p.position.set((Math.random() - 0.5) * spread, rY - offset, (Math.random() - 0.5) * spread);
        p.velocity.set((Math.random() - 0.5) * 1.0, -1.5 - Math.random() * 2.0, (Math.random() - 0.5) * 1.0);
        p.life = p.maxLife;
        nextFume = (nextFume + 1) % fumeCount;
      }

      // Spawn Sparks
      for (let i = 0; i < Math.floor(3 * intensity); i++) {
        const p = sparks[nextSpark];
        p.position.set((Math.random() - 0.5) * spread, rY - offset, (Math.random() - 0.5) * spread);
        p.velocity.set((Math.random() - 0.5) * 3, -4 - Math.random() * 5, (Math.random() - 0.5) * 3);
        p.life = p.maxLife;
        nextSpark = (nextSpark + 1) % sparkCount;
      }
    }

    // Update fumes
    fumes.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= delta;
        p.position.addScaledVector(p.velocity, delta);
        const lifeProgress = p.life / p.maxLife;
        dummy.position.copy(p.position);
        dummy.scale.setScalar(p.scale * (1.5 - lifeProgress)); // Fumes grow
        dummy.updateMatrix();
        fumesRef.current.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.position.set(0, -100, 0); // hide
        dummy.updateMatrix();
        fumesRef.current.setMatrixAt(i, dummy.matrix);
      }
    });
    fumesRef.current.instanceMatrix.needsUpdate = true;

    // Update sparks
    sparks.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= delta;
        p.position.addScaledVector(p.velocity, delta);
        const lifeProgress = p.life / p.maxLife;
        dummy.position.copy(p.position);
        dummy.scale.setScalar(p.scale * lifeProgress); // Sparks shrink
        dummy.updateMatrix();
        sparksRef.current.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.position.set(0, -100, 0); // hide
        dummy.updateMatrix();
        sparksRef.current.setMatrixAt(i, dummy.matrix);
      }
    });
    sparksRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={fumesRef} args={[undefined, undefined, fumeCount]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={sparksRef} args={[undefined, undefined, sparkCount]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

// ─── Scene Setup ───────────────────────────────────────────────────────────
function Scene({ scrollY, activeMilestone }: { scrollY: any; activeMilestone: number }) {
  const { camera } = useThree();
  const shakeRef = useRef(0);
  const prevMilestone = useRef(activeMilestone);

  useEffect(() => {
    if (activeMilestone !== prevMilestone.current && activeMilestone > -1) {
      shakeRef.current = 0.5; // Trigger shake on new milestone
      prevMilestone.current = activeMilestone;
    }
  }, [activeMilestone]);

  useFrame((state, delta) => {
    // Shift camera on mobile so rocket appears on the right
    const isMobile = window.innerWidth < 768;
    const targetX = isMobile ? -1.0 : 0;

    if (shakeRef.current > 0) {
      const shake = shakeRef.current;
      camera.position.x = targetX + (Math.random() - 0.5) * shake;
      camera.position.y = (Math.random() - 0.5) * shake;
      shakeRef.current -= delta * 2;
    } else {
      camera.position.x += (targetX - camera.position.x) * delta * 5;
      camera.position.y = 0;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
      <pointLight position={[0, -2, 0]} intensity={5} color="#01E864" distance={10} />
      
      <Rocket scrollY={scrollY} />
      <Exhaust scrollY={scrollY} />
    </>
  );
}

// ─── Milestones Data ───────────────────────────────────────────────────────
const milestones = [
  { num: "01", title: "IGNITION", desc: "Participant reporting & registration", date: "09:30 AM – 10:00 AM", day: 1 },
  { num: "02", title: "ARRIVAL", desc: "Arrival & reception of HackerRank officials and guests", date: "09:30 AM – 10:00 AM", day: 1 },
  { num: "03", title: "OPENING", desc: "Opening address", date: "10:00 AM – 10:05 AM", day: 1 },
  { num: "04", title: "WELCOME", desc: "Welcome address", date: "10:05 AM – 10:10 AM", day: 1 },
  { num: "05", title: "INTRODUCTION", desc: "Introduction of guests & HackerRank officials", date: "10:10 AM – 10:20 AM", day: 1 },
  { num: "06", title: "FELICITATION", desc: "Felicitation of guests", date: "10:20 AM – 10:30 AM", day: 1 },
  { num: "07", title: "LAUNCH", desc: "Launch of the secretariat for the upcoming tenure of HackerRank Campus Crew", date: "10:30 AM – 10:40 AM", day: 1 },
  { num: "08", title: "CELEBRATION", desc: "One-year anniversary cake-cutting ceremony", date: "10:40 AM – 10:50 AM", day: 1 },
  { num: "09", title: "SPONSOR SPOTLIGHT", desc: "Sponsor promotion video — RISE Research", date: "10:50 AM – 11:00 AM", day: 1 },
  { num: "10", title: "ICEBREAKER", desc: "Main sponsor promotion video + icebreaker", date: "11:00 AM – 11:10 AM", day: 1 },
  { num: "11", title: "MISSION BRIEFING", desc: "Official introduction to the DOMINION Buildathon, Rules & problem statement briefing", date: "11:10 AM – 11:20 AM", day: 1 },
  { num: "12", title: "LIFTOFF", desc: "DOMINION Buildathon — development phase 1 begins", date: "11:20 AM – 02:00 PM", day: 1 },
  { num: "13", title: "TRAJECTORY CHECK", desc: "Review round 1 — initial evaluation & mentoring", date: "02:00 PM – 03:00 PM", day: 1 },
  { num: "14", title: "REFUEL", desc: "Refreshment & food break", date: "03:00 PM – 03:30 PM", day: 1 },
  { num: "15", title: "ASCENT", desc: "Buildathon development continues based on review feedback", date: "03:30 PM – 05:15 PM", day: 1 },
  { num: "16", title: "WRAP-UP", desc: "Day 1 wrap-up, important instructions & briefing", date: "05:15 PM – 05:30 PM", day: 1 },
  { num: "17", title: "ORBIT", desc: "Day 1 culmination", date: "05:30 PM", day: 1 },
  { num: "18", title: "SHORTLIST", desc: "Announcement of shortlisted teams for Round 2", date: "After 05:30 PM", day: 1 },
  { num: "19", title: "RE-ENTRY", desc: "Shortlisted teams reporting & check-in", date: "09:30 AM – 10:00 AM", day: 2 },
  { num: "20", title: "BRIEFING", desc: "Day 2 opening & briefing", date: "10:00 AM – 10:10 AM", day: 2 },
  { num: "21", title: "FINAL ASCENT", desc: "Round 2 final Buildathon phase begins", date: "10:20 AM – 12:00 PM", day: 2 },
  { num: "22", title: "PREPARATION", desc: "Break & final preparation time", date: "12:00 PM – 12:30 PM", day: 2 },
  { num: "23", title: "SUBMISSION", desc: "Final round project completion & submission", date: "12:30 PM – 01:30 PM", day: 2 },
  { num: "24", title: "JUDGING", desc: "Final judging & project presentations", date: "01:30 PM – 02:45 PM", day: 2 },
  { num: "25", title: "DELIBERATION", desc: "Judges' deliberation & final evaluation", date: "02:45 PM – 03:15 PM", day: 2 },
  { num: "26", title: "LANDING", desc: "Announcement of final results", date: "03:15 PM – 03:30 PM", day: 2 },
  { num: "27", title: "DOMINION", desc: "DOMINION 2026 — official culmination", date: "03:30 PM", day: 2 }
];

const COLLAPSED_ITEM_HEIGHT = 56;

// ─── HTML Overlay Component ────────────────────────────────────────────────
export default function RocketTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const [active, setActive] = useState(-1);

  // Update active milestone based on scroll
  useEffect(() => {
    return scrollYProgress.onChange((v) => {
      const startRange = 0.08;
      const endRange = 0.90;
      if (v < startRange) {
        setActive(-1);
      } else if (v > endRange) {
        setActive(milestones.length - 1);
      } else {
        const fraction = (v - startRange) / (endRange - startRange);
        const index = Math.floor(fraction * milestones.length);
        setActive(Math.max(0, Math.min(milestones.length - 1, index)));
      }
    });
  }, [scrollYProgress]);

  // Breakthrough flash animation
  const flashOpacity = useTransform(scrollYProgress, [0.93, 0.96, 1], [0, 1, 0]);
  const endScreenOpacity = useTransform(scrollYProgress, [0.95, 1], [0, 1]);

  // Apply spring physics to scroll progress for beautiful inertial sliding
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 20,
    restDelta: 0.001
  });

  // Calculate dynamic list translation using responsive window height parameters
  const listY = useTransform(smoothProgress, (v) => {
    const startRange = 0.08;
    const endRange = 0.90;
    const innerHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    const centerOffset = innerHeight * 0.45; // Centered position in the viewport
    const initialOffset = 180; // Compact position near the headers before scrolling
    
    if (v < 0) return initialOffset;
    
    if (v < startRange) {
      const progress = v / startRange;
      return initialOffset + progress * (centerOffset - initialOffset);
    }
    
    if (v > endRange) return -((milestones.length - 1) * COLLAPSED_ITEM_HEIGHT) + centerOffset;
    
    const fraction = (v - startRange) / (endRange - startRange);
    const activeIndex = fraction * (milestones.length - 1);
    return -(activeIndex * COLLAPSED_ITEM_HEIGHT) + centerOffset;
  });

  const currentDayInfo = useMemo(() => {
    if (active === -1 || active < 18) {
      return {
        day: "DAY 01 — 2nd SEPTEMBER 2026",
        phase: "INAUGURATION & BUILDATHON — PHASE 1"
      };
    } else {
      return {
        day: "DAY 02 — 3rd SEPTEMBER 2026",
        phase: "FINAL BUILDATHON, JUDGING & RESULTS"
      };
    }
  }, [active]);

  // Helper variables for managing the sliding rail boundaries
  const railActiveOffset = useMemo(() => {
    return Math.max(0, active - 2);
  }, [active]);

  return (
    <section id="timeline" ref={containerRef} className="relative bg-[#030807]" style={{ height: "1000vh" }}>
      {/* Sticky Container */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        
        {/* 3D Canvas */}
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
            <React.Suspense fallback={null}>
              <Scene scrollY={scrollYProgress} activeMilestone={active} />
            </React.Suspense>
          </Canvas>
        </div>

        {/* UI Overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none flex">
          
          {/* Top Center: Section Heading */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <h1 
              className="font-display text-2xl sm:text-3xl font-black text-[#E8FFF2] tracking-[0.3em] uppercase text-center" 
              style={{ textShadow: "0 0 15px rgba(232,255,242,0.4)" }}
            >
              EVENT TIMELINE
            </h1>
            <div className="h-[2px] w-16 bg-[#01E864] mt-2 shadow-[0_0_8px_#01E864]" />
          </div>

          {/* Left Side Panel */}
          <div className="relative w-[90%] md:w-1/2 h-full flex flex-col justify-start overflow-hidden">
            
            {/* Day Sub-Headers (Left-aligned) */}
            <div className="absolute top-24 left-6 sm:left-10 md:left-24 z-20 flex flex-col gap-1">
              <motion.h2 
                key={currentDayInfo.day}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className="font-display text-lg sm:text-xl font-bold text-[#E8FFF2] tracking-wider uppercase"
                style={{ textShadow: "0 0 10px rgba(232,255,242,0.3)" }}
              >
                {currentDayInfo.day}
              </motion.h2>
              <motion.p 
                key={currentDayInfo.phase}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className="font-mono text-[0.65rem] sm:text-xs tracking-[0.15em] text-[#01E864] uppercase opacity-90"
              >
                {currentDayInfo.phase}
              </motion.p>
              {currentDayInfo.day.includes("DAY 02") && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  className="font-mono text-[0.55rem] sm:text-[0.6rem] tracking-[0.1em] text-[#ffc107] uppercase mt-0.5"
                >
                  * Only shortlisted teams from Day 1 report on Day 2.
                </motion.p>
              )}
            </div>

            {/* Sliding Milestones Container Wrapper */}
            <motion.div 
              className="absolute left-0 right-0 flex flex-col justify-start pl-6 sm:pl-10 md:pl-24"
              style={{ y: listY }}
            >
              
              {/* Illuminated Energy Conduit (Metallic Rail) */}
              <div 
                className="absolute left-[32px] sm:left-[48px] md:left-[104px] w-[8px] rounded-full border-x border-[#0c0d10] bg-[#111317] shadow-[inset_1px_1px_4px_rgba(0,0,0,0.9),0_0_5px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500"
                style={{
                  top: `${railActiveOffset * COLLAPSED_ITEM_HEIGHT + 12}px`, // moves to align with the first visible dot
                  height: `${(milestones.length - 1 - railActiveOffset) * COLLAPSED_ITEM_HEIGHT}px`
                }}
              >
                <motion.div 
                  className="w-full bg-[#01E864] origin-top opacity-80 transition-all duration-300"
                  style={{ 
                    height: `${Math.max(0, active - railActiveOffset) * COLLAPSED_ITEM_HEIGHT}px`,
                    boxShadow: "0 0 15px #01E864, inset 0 0 5px #ffffff"
                  }}
                />
              </div>

              {milestones.map((m, i) => {
                const isActive = active === i;
                const isPassed = active > i;

                // Opacity fades out items that slide up past the active zone to prevent header overlap
                let itemOpacity = 0.4;
                if (active >= 0) {
                  if (i < active - 2) {
                    itemOpacity = 0; // Disappear completely
                  } else if (i === active - 2) {
                    itemOpacity = 0.15; // Barely visible transition fade
                  } else if (i === active - 1) {
                    itemOpacity = 0.4; // standard inactive view
                  } else if (isActive) {
                    itemOpacity = 1.0; // fully visible active selection
                  }
                }

                return (
                  <div 
                    key={m.num} 
                    className="relative flex items-start gap-6 transition-all duration-500"
                    style={{ 
                      height: isActive ? "auto" : `${COLLAPSED_ITEM_HEIGHT}px`,
                      paddingBottom: isActive ? "24px" : "0px",
                      opacity: itemOpacity,
                      pointerEvents: itemOpacity === 0 ? "none" : "auto"
                    }}
                  >
                    
                    {/* Tactile Mechanical Indicator */}
                    <div 
                      className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 mt-0.5 ${
                        isActive || isPassed 
                          ? "border-[#01E864] bg-[#0c1811] shadow-[0_0_15px_rgba(1,232,100,0.4),inset_0_0_8px_rgba(1,232,100,0.4)]" 
                          : "border-[#2a2d34] bg-[#1c1e22] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.8),1px_1px_2px_rgba(255,255,255,0.05)]"
                      }`}
                    >
                      <div className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                        isActive 
                          ? "bg-[#01E864] shadow-[0_0_10px_#01E864,inset_1px_1px_2px_#ffffff]" 
                          : isPassed 
                            ? "bg-[#0A3D29]"
                            : "bg-[#111317] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.8)]"
                      }`} />
                    </div>

                    {/* Milestone Card */}
                    <motion.div 
                      className="relative font-display uppercase"
                      initial={{ x: -20 }}
                      animate={{ x: isActive ? 0 : -10 }}
                      transition={{ duration: 0.4 }}
                    >
                      <p 
                        className={`text-[0.65rem] font-bold tracking-[0.35em] leading-6 ${isActive ? "text-[#01E864]" : "text-[#5b6860]"}`}
                        style={{ textShadow: isActive ? "0 0 8px rgba(1,232,100,0.4)" : "1px 1px 1px rgba(0,0,0,0.8)" }}
                      >
                        {m.num} — {m.title}
                      </p>
                      
                      {isActive && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          className="mt-3 relative overflow-hidden rounded-lg p-5 flex flex-col gap-2 max-w-[280px] sm:max-w-md"
                          style={{ 
                            background: "linear-gradient(145deg, #181d1a 0%, #0d120f 100%)",
                            borderTop: "2px solid #2a352e",
                            borderLeft: "2px solid #2a352e",
                            borderBottom: "2px solid #050806",
                            borderRight: "2px solid #050806",
                            boxShadow: "10px 10px 20px rgba(0,0,0,0.9), -1px -1px 5px rgba(255,255,255,0.02), inset 1px 1px 2px rgba(1,232,100,0.1), inset -1px -1px 5px rgba(0,0,0,0.8), 0 0 30px rgba(1,232,100,0.05)"
                          }}
                        >
                          {/* Hardware Screws */}
                          <div className="absolute top-2 left-2 h-1.5 w-1.5 rounded-full border border-[#000]" style={{ background: "radial-gradient(circle, #444 20%, #111 90%)", boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.2)" }} />
                          <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full border border-[#000]" style={{ background: "radial-gradient(circle, #444 20%, #111 90%)", boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.2)" }} />
                          <div className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full border border-[#000]" style={{ background: "radial-gradient(circle, #444 20%, #111 90%)", boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.2)" }} />
                          <div className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full border border-[#000]" style={{ background: "radial-gradient(circle, #444 20%, #111 90%)", boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.2)" }} />

                          {/* Recessed Screen */}
                          <div className="relative mt-2 p-4 rounded bg-[#030604] border border-[#111]" style={{ boxShadow: "inset 3px 3px 10px rgba(0,0,0,0.9), inset -1px -1px 2px rgba(255,255,255,0.03)" }}>
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(1,232,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(1,232,100,0.03)_1px,transparent_1px)] bg-[size:4px_4px] pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                            
                            <div className="mb-3 flex items-center justify-between">
                              <span className="font-mono text-[0.55rem] tracking-[0.2em] text-[#01E864] uppercase opacity-70">● SYSTEM ACTIVE</span>
                            </div>
                            
                            {/* Time details first */}
                            <p className="font-mono text-[0.65rem] sm:text-xs font-bold tracking-[0.25em] text-[#01E864] mb-1.5 uppercase">{m.date}</p>
                            {/* Description details second */}
                            <p className="font-display text-sm tracking-widest text-[#E8FFF2] normal-case leading-relaxed" style={{ textShadow: "0 0 10px rgba(1,232,100,0.5)" }}>{m.desc}</p>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>

      </div>
    </section>
  );
}
