import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimulationStep, BlochVector } from '../types/simulation';

interface WireEgressBlochRailProps {
  numQubits: number;
  selectedQubit: number;
  onSelectQubit: (q: number) => void;
  stepData?: SimulationStep;
  qubitNames?: string[];
  outputBits?: number[];
  rowHeight: number;
  startY: number;
  height: number;
  width?: number;
}

const QUBIT_COLORS = [
  0x38bdf8, // Sky Blue (Q0)
  0x10b981, // Emerald Green (Q1)
  0xf59e0b, // Amber (Q2)
  0x8b5cf6, // Violet (Q3)
  0xec4899, // Pink (Q4)
  0x06b6d4, // Cyan (Q5)
  0xa855f7, // Purple (Q6)
  0x3b82f6, // Blue (Q7+)
];

function blochToThree(x: number, y: number, z: number): THREE.Vector3 {
  // Bloch X -> Three X, Bloch Z -> Three Y (Up), Bloch Y -> Three Z (Front)
  return new THREE.Vector3(x, z, y);
}

export const WireEgressBlochRail: React.FC<WireEgressBlochRailProps> = ({
  numQubits,
  selectedQubit,
  onSelectQubit,
  stepData,
  qubitNames = [],
  outputBits = [],
  rowHeight,
  startY,
  height,
  width = 110,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const groupsRef = useRef<{
    qubitIndex: number;
    group: THREE.Group;
    arrow: THREE.ArrowHelper;
    selectionRing: THREE.Mesh;
    targetVec: THREE.Vector3;
    currentVec: THREE.Vector3;
  }[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // 1. Initialize Three.js Orthographic Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const w = width;
    const h = height;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Orthographic Camera aligned to exact canvas pixel coordinates
    const camera = new THREE.OrthographicCamera(
      -w / 2, w / 2,
      h / 2, -h / 2,
      0.1, 1000
    );
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Transparent background
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ambient + Directional Lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0x38bdf8, 0.9);
    dir.position.set(20, 40, 60);
    scene.add(dir);

    // 2. Build Wire-Aligned Spheres
    const sphereRadius = Math.max(9, Math.min(15, rowHeight / 2 - 3));
    const sphereX = -w / 2 + 38; // Position sphere inside rail with room for labels
    groupsRef.current = [];

    for (let q = 0; q < numQubits; q++) {
      const wireY = startY + q * rowHeight + rowHeight / 2;
      const threeY = h / 2 - wireY; // Linear pixel mapping from top to Three.js center

      const qGroup = new THREE.Group();
      qGroup.position.set(sphereX, threeY, 0);
      qGroup.userData = { qubitIndex: q };

      // A. Translucent Glass Sphere Shell
      const shellGeo = new THREE.SphereGeometry(sphereRadius, 24, 18);
      const shellMat = new THREE.MeshPhongMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.65,
        shininess: 40,
        depthWrite: false,
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      qGroup.add(shell);

      // B. Equator Ring (XY Plane)
      const ringGeo = new THREE.RingGeometry(sphereRadius * 0.96, sphereRadius, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      qGroup.add(ring);

      // C. Meridian Ring (XZ Plane)
      const meridianGeo = new THREE.RingGeometry(sphereRadius * 0.96, sphereRadius, 32);
      const meridianMat = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const meridian = new THREE.Mesh(meridianGeo, meridianMat);
      qGroup.add(meridian);

      // D. Selection Halo Ring
      const selGeo = new THREE.RingGeometry(sphereRadius * 1.25, sphereRadius * 1.40, 32);
      const selMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: q === selectedQubit ? 0.9 : 0.0,
        side: THREE.DoubleSide,
      });
      const selRing = new THREE.Mesh(selGeo, selMat);
      qGroup.add(selRing);

      // E. 3D Bloch Vector Arrow
      const arrowColor = QUBIT_COLORS[q % QUBIT_COLORS.length];
      const initialDir = new THREE.Vector3(0, 1, 0); // Default pointing +Z (Up)
      const arrowLen = sphereRadius * 1.45;
      const arrow = new THREE.ArrowHelper(
        initialDir,
        new THREE.Vector3(0, 0, 0),
        arrowLen,
        arrowColor,
        sphereRadius * 0.38,
        sphereRadius * 0.22
      );
      qGroup.add(arrow);

      scene.add(qGroup);

      groupsRef.current.push({
        qubitIndex: q,
        group: qGroup,
        arrow,
        selectionRing: selRing,
        targetVec: new THREE.Vector3(0, 1, 0),
        currentVec: new THREE.Vector3(0, 1, 0),
      });
    }

    // 3. Animation Render Loop (Smooth Slerp / Lerp interpolation)
    const animate = () => {
      groupsRef.current.forEach((item) => {
        // Smoothly interpolate current vector towards target
        item.currentVec.lerp(item.targetVec, 0.18);
        const len = item.currentVec.length();
        if (len > 0.01) {
          const dir = item.currentVec.clone().normalize();
          item.arrow.setDirection(dir);
        }
      });

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
      renderer.dispose();
    };
  }, [numQubits, rowHeight, startY, height, width]);

  // 4. Update Target Vectors on Step Data Change
  useEffect(() => {
    if (!stepData?.bloch_vectors) return;

    groupsRef.current.forEach((item) => {
      const q = item.qubitIndex;
      const bv: BlochVector | undefined = stepData.bloch_vectors[q];
      if (bv) {
        const tVec = blochToThree(bv.x, bv.y, bv.z);
        item.targetVec.copy(tVec);
      }
    });
  }, [stepData]);

  // 5. Update Selection Halo Ring on selectedQubit Change
  useEffect(() => {
    groupsRef.current.forEach((item) => {
      const isSel = item.qubitIndex === selectedQubit;
      const mat = item.selectionRing.material as THREE.MeshBasicMaterial;
      mat.opacity = isSel ? 0.9 : 0.0;
    });
  }, [selectedQubit]);

  // 6. Raycast Click Handler for Qubit Selection
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / width) * 2 - 1;
    const y = -((e.clientY - rect.top) / height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const hitObjects = groupsRef.current.map((g) => g.group);
    const intersects = raycaster.intersectObjects(hitObjects, true);

    if (intersects.length > 0) {
      let topGroup: THREE.Object3D | null = intersects[0].object;
      while (topGroup && topGroup.userData?.qubitIndex === undefined && topGroup.parent) {
        topGroup = topGroup.parent;
      }
      if (topGroup?.userData?.qubitIndex !== undefined) {
        onSelectQubit(topGroup.userData.qubitIndex);
      }
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* SVG Connecting Wire Stubs & Live State Header */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* Rail Top Header: Aligns with step numbers / WIRE PIN IN at y=22 */}
        <text
          x={width / 2}
          y={22}
          textAnchor="middle"
          fontSize="9px"
          fontWeight="700"
          fill="#38bdf8"
          letterSpacing="0.04em"
          fontFamily="var(--font-mono)"
          style={{ textTransform: 'uppercase', userSelect: 'none' }}
        >
          LIVE STATE (3D)
        </text>
        <line
          x1={0}
          y1={startY}
          x2={width}
          y2={startY}
          stroke="rgba(51, 65, 85, 0.4)"
          strokeWidth={1}
        />

        {Array.from({ length: numQubits }).map((_, q) => {
          const wireY = startY + q * rowHeight + rowHeight / 2;
          const isSel = q === selectedQubit;
          const sphereRadius = Math.max(9, Math.min(15, rowHeight / 2 - 3));
          return (
            <line
              key={`egress-wire-${q}`}
              x1={0}
              y1={wireY}
              x2={38 - sphereRadius}
              y2={wireY}
              stroke={isSel ? '#38bdf8' : '#334155'}
              strokeWidth={isSel ? 2 : 1.5}
            />
          );
        })}
      </svg>

      {/* Three.js Canvas Container */}
      <div
        ref={mountRef}
        onClick={handleClick}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'pointer',
        }}
        title="Live 3D Bloch Spheres aligned directly with circuit wires. Click any sphere to focus qubit."
      />

      {/* HTML / SVG Overlay for Pinout Badges & State Labels */}
      {Array.from({ length: numQubits }).map((_, q) => {
        const wireY = startY + q * rowHeight + rowHeight / 2;
        const qName = qubitNames[q] ? qubitNames[q].split(' ')[0] : `Q${q}`;
        const bv: BlochVector | undefined = stepData?.bloch_vectors?.[q];
        const outBit = outputBits[q] !== undefined ? outputBits[q] : (bv ? (bv.z <= 0 ? 1 : 0) : 0);
        const isSel = q === selectedQubit;
        const sphereRadius = Math.max(9, Math.min(15, rowHeight / 2 - 3));

        return (
          <div
            key={`wire-egress-badge-${q}`}
            onClick={() => onSelectQubit(q)}
            style={{
              position: 'absolute',
              top: `${wireY}px`,
              left: `${38 + sphereRadius + 8}px`,
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
            title={`Wire ${qName}: State |${outBit}⟩, ⟨Z⟩=${bv ? bv.z.toFixed(2) : '+1.00'} • Click to inspect`}
          >
            {/* Output bit ket badge */}
            <span
              style={{
                padding: '1px 4px',
                borderRadius: '3px',
                background: outBit === 1 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(56, 189, 248, 0.18)',
                color: outBit === 1 ? '#34d399' : '#38bdf8',
                border: `1px solid ${outBit === 1 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                fontWeight: 700,
                fontSize: '9px',
              }}
            >
              |{outBit}⟩
            </span>

            {/* Qubit name */}
            <span
              style={{
                color: isSel ? '#38bdf8' : '#94a3b8',
                fontWeight: isSel ? 700 : 500,
                fontSize: '9.5px',
              }}
            >
              {qName}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default WireEgressBlochRail;
