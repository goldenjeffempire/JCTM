import { useRef, useMemo, Suspense, useState, useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import { motion } from "framer-motion";

// ── WebGL availability check ──────────────────────────────────────────────
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

// ── CSS-based fallback "Global Altar" (for environments without WebGL) ────
function AltarFallback() {
  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: "520px" }}>
      {/* Outer glow rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="absolute rounded-full border border-sky-400/20 animate-ping"
            style={{
              width: `${i * 120}px`,
              height: `${i * 120}px`,
              animationDuration: `${i * 1.5}s`,
              animationDelay: `${i * 0.4}s`,
              opacity: 1 / i,
            }}
          />
        ))}
        {/* Static rings */}
        {[140, 220, 300, 380].map((size, i) => (
          <div
            key={`ring-${i}`}
            className="absolute rounded-full border border-sky-400/15"
            style={{ width: size, height: size }}
          />
        ))}
        {/* Core sphere */}
        <div
          className="relative z-10 rounded-full flex items-center justify-center"
          style={{
            width: 120,
            height: 120,
            background: "radial-gradient(circle at 35% 35%, #38BDF8, #003366)",
            boxShadow: "0 0 60px rgba(56,189,248,0.5), 0 0 120px rgba(56,189,248,0.25), inset 0 0 30px rgba(56,189,248,0.2)",
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: 80,
              height: 80,
              background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.3), transparent)",
            }}
          />
        </div>
        {/* Orbiting particles */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * 360;
          const radius = 160;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;
          return (
            <div
              key={`p-${i}`}
              className="absolute rounded-full bg-sky-400"
              style={{
                width: i % 3 === 0 ? 6 : 4,
                height: i % 3 === 0 ? 6 : 4,
                transform: `translate(${x}px, ${y}px)`,
                opacity: 0.6 + (i % 3) * 0.15,
                animation: `pulse ${1.5 + (i % 4) * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          );
        })}
      </div>

      {/* Text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: "55%" }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <div className="text-sky-300 text-sm font-semibold tracking-[0.3em] uppercase mb-2 drop-shadow-lg">
            ✦ Live Global Altar ✦
          </div>
          <h2 className="text-white text-3xl md:text-4xl font-serif font-bold drop-shadow-2xl">
            Worshippers United in Prayer
          </h2>
          <p className="text-sky-200/70 text-sm mt-2">
            Believers across 40+ nations connected through one Spirit
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ── 3D WebGL component (lazy-loaded) ─────────────────────────────────────
type ThreeComponents = {
  Canvas: React.ComponentType<{
    camera?: { position: [number, number, number]; fov: number };
    style?: React.CSSProperties;
    gl?: { antialias?: boolean; alpha?: boolean };
    children?: ReactNode;
  }>;
  useFrame: (callback: (state: { clock: { elapsedTime: number }; camera: { position: { x: number; y: number }; lookAt: (x: number, y: number, z: number) => void } }) => void) => void;
  useThree: () => { camera: { position: { x: number; y: number }; lookAt: (x: number, y: number, z: number) => void } };
  Sphere: React.ComponentType<{ ref?: React.RefObject<unknown> }>;
  MeshDistortMaterial: React.ComponentType<{
    color?: string;
    emissive?: string;
    emissiveIntensity?: number;
    distort?: number;
    speed?: number;
    roughness?: number;
    metalness?: number;
    transparent?: boolean;
    opacity?: number;
  }>;
  Stars: React.ComponentType<{
    radius?: number;
    depth?: number;
    count?: number;
    factor?: number;
    fade?: boolean;
    speed?: number;
  }>;
  Float: React.ComponentType<{
    speed?: number;
    rotationIntensity?: number;
    floatIntensity?: number;
    children?: ReactNode;
  }>;
};

// ── Error boundary for WebGL ──────────────────────────────────────────────
interface WebGLBoundaryState { hasError: boolean }
class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, WebGLBoundaryState> {
  state: WebGLBoundaryState = { hasError: false };
  static getDerivedStateFromError(): WebGLBoundaryState { return { hasError: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) { console.warn("WebGL render error:", error.message); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ── Lazy 3D scene wrapper ─────────────────────────────────────────────────
function Altar3DScene() {
  const [ThreeComp, setThreeComp] = useState<ThreeComponents | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("@react-three/fiber"),
      import("@react-three/drei"),
    ]).then(([fiber, drei]) => {
      if (!cancelled) {
        setThreeComp({
          Canvas: fiber.Canvas as unknown as ThreeComponents["Canvas"],
          useFrame: fiber.useFrame,
          useThree: fiber.useThree,
          Sphere: drei.Sphere as unknown as ThreeComponents["Sphere"],
          MeshDistortMaterial: drei.MeshDistortMaterial as unknown as ThreeComponents["MeshDistortMaterial"],
          Stars: drei.Stars as unknown as ThreeComponents["Stars"],
          Float: drei.Float as unknown as ThreeComponents["Float"],
        });
      }
    }).catch(() => { /* fallback already shown */ });
    return () => { cancelled = true; };
  }, []);

  if (!ThreeComp) return <AltarFallback />;

  const { Canvas } = ThreeComp;

  return (
    <div className="relative w-full" style={{ height: "520px" }}>
      <div className="absolute inset-0 rounded-3xl overflow-hidden">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 50 }}
          style={{ background: "transparent" }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <SceneInner three={ThreeComp} />
          </Suspense>
        </Canvas>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 1 }}
        >
          <div className="text-sky-300 text-sm font-semibold tracking-[0.3em] uppercase mb-2 drop-shadow-lg">
            ✦ Live Global Altar ✦
          </div>
          <h2 className="text-white text-3xl md:text-4xl font-serif font-bold drop-shadow-2xl">
            Worshippers United in Prayer
          </h2>
          <p className="text-sky-200/80 text-sm mt-2 max-w-xs mx-auto">
            Believers across 40+ nations connecting through one Spirit
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function SceneInner({ three }: { three: ThreeComponents }) {
  const { useFrame, useThree, MeshDistortMaterial, Stars, Float } = three;

  const meshRef = useRef<{ rotation: { y: number; x: number } } | null>(null);
  const ring1 = useRef<{ rotation: { z: number; x: number } } | null>(null);
  const ring2 = useRef<{ rotation: { z: number; y: number } } | null>(null);
  const ring3 = useRef<{ rotation: { x: number; z: number } } | null>(null);
  const pointsRef = useRef<{ rotation: { y: number }; geometry: { attributes: { position: { setXYZ: (i: number, x: number, y: number, z: number) => void; needsUpdate: boolean } } } } | null>(null);

  const { camera } = useThree();

  const { positions, phases } = useMemo(() => {
    const count = 300;
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 3.5 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, phases: ph };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) { meshRef.current.rotation.y = t * 0.15; meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1; }
    if (ring1.current) { ring1.current.rotation.z = t * 0.4; ring1.current.rotation.x = 0.5; }
    if (ring2.current) { ring2.current.rotation.z = -t * 0.3; ring2.current.rotation.y = 0.8; }
    if (ring3.current) { ring3.current.rotation.x = t * 0.25; ring3.current.rotation.z = 0.3; }
    camera.position.x = Math.sin(t * 0.1) * 0.5;
    camera.position.y = Math.cos(t * 0.08) * 0.3;
    camera.lookAt(0, 0, 0);
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.05;
      const posAttr = pointsRef.current.geometry.attributes.position;
      for (let i = 0; i < 300; i++) {
        const pt = t + phases[i];
        const r = 3.5 + Math.sin(pt * 0.5) * 0.3;
        const theta = (i / 300) * Math.PI * 2 + pt * 0.02;
        const phi = Math.acos(2 * (i / 300) - 1);
        posAttr.setXYZ(i, r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta) + Math.sin(pt) * 0.1, r * Math.cos(phi));
      }
      posAttr.needsUpdate = true;
    }
  });

  // Build geometry outside JSX
  const { THREE } = useMemo(() => {
    const mod = { THREE: { BufferGeometry: class {}, BufferAttribute: class {} } };
    return mod;
  }, []);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={3} color="#38BDF8" distance={10} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#7dd3fc" />
      <Stars radius={80} depth={50} count={2000} factor={3} fade speed={0.5} />
      {/* Core sphere */}
      <mesh ref={meshRef as React.RefObject<never>} position={[0, 0, 0]}>
        <sphereGeometry args={[1.4, 64, 64]} />
        <MeshDistortMaterial
          color="#003366"
          emissive="#38BDF8"
          emissiveIntensity={0.6}
          distort={0.35}
          speed={1.5}
          roughness={0.1}
          metalness={0.8}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Rings */}
      <mesh ref={ring1 as React.RefObject<never>}>
        <torusGeometry args={[2.0, 0.03, 16, 100]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.5} />
      </mesh>
      <mesh ref={ring2 as React.RefObject<never>}>
        <torusGeometry args={[2.5, 0.025, 16, 100]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.35} />
      </mesh>
      <mesh ref={ring3 as React.RefObject<never>}>
        <torusGeometry args={[3.0, 0.02, 16, 100]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={0.25} />
      </mesh>
      {/* Particle system */}
      <points ref={pointsRef as React.RefObject<never>}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#38BDF8" size={0.04} transparent opacity={0.8} sizeAttenuation />
      </points>
      {/* Light beams */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <Float key={i} speed={1.5 + i * 0.3} rotationIntensity={0} floatIntensity={0.3}>
            <mesh position={[Math.cos(angle) * 1.6, 0.6, Math.sin(angle) * 1.6]} rotation={[Math.PI / 2, 0, angle]}>
              <cylinderGeometry args={[0.01, 0.01, 2.5, 8]} />
              <meshBasicMaterial color="#38BDF8" transparent opacity={0.2} />
            </mesh>
          </Float>
        );
      })}
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────
export function GlobalAltar3D() {
  const [webglOk] = useState(() => {
    try { return isWebGLAvailable(); }
    catch { return false; }
  });

  return (
    <motion.div
      className="relative w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
    >
      {webglOk ? (
        <WebGLErrorBoundary fallback={<AltarFallback />}>
          <Altar3DScene />
        </WebGLErrorBoundary>
      ) : (
        <AltarFallback />
      )}
    </motion.div>
  );
}
