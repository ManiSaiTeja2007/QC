import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationStep } from '../types/simulation';
import { BlochVector3D, computeBlochTrajectoryAtTime } from '../services/blochMath';

interface BlochPanelProps {
  numQubits: number;
  qubitNames: string[];
  stepData: SimulationStep | null;
  selectedQubit: number;
  viewMode?: 'all' | 'grid' | 'focus';
  onViewModeChange?: (mode: 'all' | 'grid' | 'focus') => void;
  onSelectQubit: (qIdx: number) => void;
  // Phase 124–128: Active Qubits Layer & Display Modes
  displayedQubits?: number[];
  activeQubits?: number[];
  displayMode?: 'active' | 'selected' | 'all' | 'custom';
  onDisplayModeChange?: (mode: 'active' | 'selected' | 'all' | 'custom') => void;
  onToggleCustomQubit?: (qIdx: number) => void;
  animTime?: number;
  animMode?: 'vector' | 'trajectory' | 'both';
  r0?: BlochVector3D;
  r1?: BlochVector3D;
  gateName?: string;
  gateParams?: number[];
}

interface CustomArrow extends THREE.ArrowHelper { direction?: THREE.Vector3; }

const QUBIT_COLORS = [0x38bdf8, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899];

function blochToThree(x: number, y: number, z: number) {
  // Bloch X → Three X,  Bloch Z → Three Y (up),  Bloch Y → Three Z (front)
  return new THREE.Vector3(x, z, y);
}

function sprite(text: string, color = '#94a3b8'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 56;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 24px Inter,monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 80, 28);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(0.60, 0.26, 1);
  return s;
}

/** Full-featured sphere for Single Gate Lab focus view — coloured axes + labels */
function buildFocusSphere(rad: number): THREE.Group {
  const g = new THREE.Group();
  const seg = 64;

  // Translucent shell
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(rad, 32, 24),
    new THREE.MeshPhongMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.12,
      shininess: 60,
      specular: 0x38bdf8,
      depthWrite: false,
    })
  );
  g.add(shell);

  // Equator ring
  const eq: THREE.Vector3[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    eq.push(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad));
  }
  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(eq),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
    )
  );

  // Meridian ring (dashed)
  const me: THREE.Vector3[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    me.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0));
  }
  const ml = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(me),
    new THREE.LineDashedMaterial({ color: 0x334155, transparent: true, opacity: 0.3, dashSize: 0.07, gapSize: 0.04 })
  );
  ml.computeLineDistances();
  g.add(ml);

  // Coloured axis lines (no arrowheads — only ONE arrow = the state vector)
  const L = rad * 1.30;
  const addLine = (a: THREE.Vector3, b: THREE.Vector3, color: number) =>
    g.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })
      )
    );

  addLine(new THREE.Vector3(-L, 0, 0), new THREE.Vector3(L, 0, 0), 0x38bdf8); // X cyan
  addLine(new THREE.Vector3(0, 0, -L), new THREE.Vector3(0, 0, L), 0xfbbf24); // Y yellow
  addLine(new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, L, 0), 0x10b981); // Z green

  // Labels
  const lp = rad * 1.35;
  const addLabel = (text: string, x: number, y: number, z: number, col: string) => {
    const s = sprite(text, col);
    s.position.set(x, y, z);
    g.add(s);
  };
  addLabel('|0⟩', 0, lp, 0, '#10b981');
  addLabel('|1⟩', 0, -lp, 0, '#f43f5e');
  addLabel('|+⟩', lp, 0, 0, '#38bdf8');
  addLabel('|-⟩', -lp, 0, 0, '#38bdf8');
  addLabel('|+i⟩', 0, 0, lp, '#fbbf24');
  addLabel('|-i⟩', 0, 0, -lp, '#fbbf24');

  return g;
}

/** Minimal clean sphere for Circuit Builder grid view — uniform, elegant translucent look */
function buildGridSphere(rad: number, isSelected: boolean): THREE.Group {
  const g = new THREE.Group();
  const seg = 48;

  // Translucent shell - uniform across all qubits
  g.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(rad, 32, 24),
      new THREE.MeshPhongMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.14,
        shininess: 60,
        specular: 0x38bdf8,
        depthWrite: false,
      })
    )
  );

  // Equator ring
  const eq: THREE.Vector3[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    eq.push(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad));
  }
  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(eq),
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
      })
    )
  );

  // Meridian ring (dashed)
  const me: THREE.Vector3[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    me.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0));
  }
  const ml = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(me),
    new THREE.LineDashedMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.35,
      dashSize: 0.06,
      gapSize: 0.04,
    })
  );
  ml.computeLineDistances();
  g.add(ml);

  return g;
}

export const BlochPanel: React.FC<BlochPanelProps> = ({
  numQubits,
  qubitNames,
  stepData,
  selectedQubit,
  viewMode = 'grid',
  onViewModeChange,
  onSelectQubit,
  displayedQubits,
  activeQubits = [],
  displayMode = 'active',
  onDisplayModeChange,
  onToggleCustomQubit,
  animTime = 1.0,
  animMode = 'both',
  r0,
  r1,
  gateName = 'H',
  gateParams,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupsRef = useRef<{ group: THREE.Group; arrow: CustomArrow; qubitIndex: number }[]>([]);
  const targetVecsRef = useRef<{ [qubitIdx: number]: THREE.Vector3 }>({});
  const trailLineRef = useRef<THREE.Line | null>(null);

  const [showQubitPopover, setShowQubitPopover] = useState<boolean>(false);

  // Effective displayed qubits: if passed explicitly, use it; otherwise fallback to focus or all
  const targetDisplayQubits = React.useMemo(() => {
    if (displayedQubits && displayedQubits.length > 0) {
      return displayedQubits;
    }
    if (viewMode === 'focus') {
      return [selectedQubit];
    }
    return Array.from({ length: numQubits }, (_, i) => i);
  }, [displayedQubits, viewMode, selectedQubit, numQubits]);

  const isSingleFocus = targetDisplayQubits.length === 1;

  // ── Init renderer + lights ──────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasMountRef.current;
    if (!el) return;
    const W = el.clientWidth || 500,
      H = el.clientHeight || 380;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030509);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(0, 10, 10);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.5);
    rim.position.set(0, -5, 5);
    scene.add(rim);

    let id: number;
    const loop = () => {
      id = requestAnimationFrame(loop);
      controls.update();
      // Smooth-slerp each arrow toward its target
      groupsRef.current.forEach((g) => {
        const tv = targetVecsRef.current[g.qubitIndex];
        if (!tv) return;
        const len = tv.length();
        if (len < 0.0001) return;
        const arr = g.arrow;
        const cur = arr.direction ? arr.direction.clone().normalize() : new THREE.Vector3(0, 1, 0);
        const tar = tv.clone().normalize();
        if (cur.dot(tar) < -0.999) cur.add(new THREE.Vector3(0.01, 0.01, 0)).normalize();
        const qC = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), cur);
        const qT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tar);
        qC.slerp(qT, 0.3);
        const nd = new THREE.Vector3(0, 1, 0).applyQuaternion(qC).normalize();
        arr.direction = nd.clone();
        arr.setDirection(nd);
        const al = isSingleFocus ? 1.4 : 0.9 * 1.35;
        arr.setLength(Math.max(0.2, len * al), 0.24, 0.12);
      });
      renderer.render(scene, camera);
    };
    loop();

    // Raycaster click
    const onClick = (e: MouseEvent) => {
      if (!canvasMountRef.current || !cameraRef.current || !sceneRef.current) return;
      const r = canvasMountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, cameraRef.current);
      for (const hit of ray.intersectObjects(sceneRef.current.children, true)) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj !== sceneRef.current) {
          if (typeof obj.userData.qubitIndex === 'number') {
            onSelectQubit(obj.userData.qubitIndex);
            return;
          }
          obj = obj.parent;
        }
      }
    };
    el.addEventListener('click', onClick);

    const ro = new ResizeObserver(() => {
      if (!canvasMountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = canvasMountRef.current.clientWidth,
        h = canvasMountRef.current.clientHeight;
      if (!w || !h) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      positionCamera();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(id);
      el.removeEventListener('click', onClick);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [onSelectQubit]); // eslint-disable-line

  // ── Adaptive Dynamic Camera Positioning based on displayed qubits ─────────
  const positionCamera = () => {
    const cam = cameraRef.current;
    if (!cam) return;
    const ctrl = controlsRef.current;
    const N = targetDisplayQubits.length;

    if (N === 1) {
      cam.position.set(1.4, 1.6, 5.0);
    } else if (N === 2) {
      cam.position.set(0.4, 0.9, 6.0);
    } else if (N === 3) {
      cam.position.set(0.5, 1.0, 7.2);
    } else if (N === 4) {
      cam.position.set(0.5, 1.0, 8.0);
    } else if (N <= 6) {
      cam.position.set(0.6, 1.2, 9.5);
    } else {
      cam.position.set(0.6, 1.2, 12.0);
    }

    if (ctrl) {
      ctrl.target.set(0, 0, 0);
      ctrl.update();
    }
  };

  // ── Rebuild spheres when displayedQubits topology changes ─────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    groupsRef.current.forEach((g) => scene.remove(g.group));
    groupsRef.current = [];
    targetVecsRef.current = {};

    const N = targetDisplayQubits.length;

    if (N === 1) {
      const q = targetDisplayQubits[0];
      const qg = new THREE.Group();
      qg.userData = { qubitIndex: q };
      qg.add(buildFocusSphere(1.4));
      const color = QUBIT_COLORS[q % QUBIT_COLORS.length];
      const arr = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        1.4,
        color,
        0.26,
        0.13
      ) as CustomArrow;
      qg.add(arr);
      scene.add(qg);
      groupsRef.current.push({ group: qg, arrow: arr, qubitIndex: q });
      targetVecsRef.current[q] = new THREE.Vector3(0, 1.4, 0);
    } else {
      let cols = Math.min(N, 3);
      if (N === 4) cols = 2; // 2x2 grid for 4 qubits
      const rows = Math.ceil(N / cols);
      const rad = N <= 2 ? 1.05 : N === 3 ? 0.95 : 0.88;
      const spacingX = N <= 2 ? 2.8 : 2.5;
      const spacingY = 2.5;

      targetDisplayQubits.forEach((q, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const xp = (col - (cols - 1) / 2) * spacingX;
        const yp = ((rows - 1) / 2 - row) * spacingY;
        const isSel = q === selectedQubit;

        const qg = new THREE.Group();
        qg.position.set(xp, yp, 0);
        qg.userData = { qubitIndex: q };
        qg.add(buildGridSphere(rad, isSel));

        // Qubit name label
        const name = qubitNames[q] ? qubitNames[q].split(' ')[0] : `Q${q}`;
        const lbl = sprite(name, isSel ? '#38bdf8' : '#64748b');
        lbl.position.set(0, rad * 1.42, 0);
        qg.add(lbl);

        const color = QUBIT_COLORS[q % QUBIT_COLORS.length];
        const arr = new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          rad * 1.35,
          color,
          0.2,
          0.1
        ) as CustomArrow;
        qg.add(arr);
        scene.add(qg);

        groupsRef.current.push({ group: qg, arrow: arr, qubitIndex: q });
        targetVecsRef.current[q] = new THREE.Vector3(0, rad * 1.35, 0);
      });
    }

    positionCamera();
  }, [targetDisplayQubits, selectedQubit, qubitNames]); // eslint-disable-line

  // ── Update target vectors from physics ─────────────────────────────────────
  useEffect(() => {
    if (r0 && r1 && isSingleFocus && numQubits === 1) {
      const q = targetDisplayQubits[0] ?? 0;
      const rT = computeBlochTrajectoryAtTime(gateName, r0, r1, animTime, gateParams);
      targetVecsRef.current[q] = blochToThree(rT.x, rT.y, rT.z);

      // Trajectory trail
      if (sceneRef.current && (animMode === 'trajectory' || animMode === 'both')) {
        if (trailLineRef.current) {
          sceneRef.current.remove(trailLineRef.current);
          trailLineRef.current = null;
        }
        const pts: THREE.Vector3[] = [];
        const steps = Math.max(2, Math.floor(animTime * 40));
        for (let i = 0; i <= steps; i++) {
          const sub = computeBlochTrajectoryAtTime(gateName, r0, r1, i / 40, gateParams);
          pts.push(blochToThree(sub.x * 1.36, sub.y * 1.36, sub.z * 1.36));
        }
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
        );
        sceneRef.current.add(line);
        trailLineRef.current = line;
      } else if (sceneRef.current && animMode === 'vector' && trailLineRef.current) {
        sceneRef.current.remove(trailLineRef.current);
        trailLineRef.current = null;
      }
      return;
    }

    if (!stepData) return;
    const bvs = stepData.bloch_vectors;
    targetDisplayQubits.forEach((q) => {
      const b = bvs[q] ?? { x: 0, y: 0, z: 1 };
      targetVecsRef.current[q] = blochToThree(b.x, b.y, b.z);
    });
  }, [stepData, targetDisplayQubits, selectedQubit, isSingleFocus, animTime, animMode, r0, r1, gateName, gateParams, numQubits]);

  return (
    <div className="bloch-container" ref={containerRef} style={{ position: 'relative' }}>
      <div
        className="bloch-canvas-mount"
        ref={canvasMountRef}
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
      />

      {/* Axis legend (focus view only — clutter in grid view) */}
      {isSingleFocus && (
        <div className="bloch-axis-legend-overlay">
          <div className="axis-legend-title">3D BLOCH SPHERE</div>
          <div className="axis-legend-item cyan">— X (Right, |+⟩)</div>
          <div className="axis-legend-item yellow">— Y (Front, |+i⟩)</div>
          <div className="axis-legend-item green">— Z (Up, |0⟩)</div>
        </div>
      )}

      {/* Pure state tag */}
      <div className="bloch-pure-state-overlay">
        <span className="pure-tag">Pure State</span>
        <span className="purity-val">|r|=1.000</span>
      </div>

      {/* Bottom info */}
      {isSingleFocus && (
        <div className="bloch-bottom-info-overlay">
          <span>t = {animTime.toFixed(3)}</span>
          <span>── r(t)</span>
          <span>--- trail</span>
        </div>
      )}

      {/* Phase 126 & 127: Display Modes Toolbar ([Active] [Selected] [All] [⚙ Qubits]) */}
      <div className="bloch-mode-overlay">
        {onDisplayModeChange ? (
          <>
            <button
              className={`btn-mode-toggle ${displayMode === 'active' ? 'active' : ''}`}
              title="Show only qubits participating in gates or initialized states"
              onClick={() => onDisplayModeChange('active')}
            >
              Active ({activeQubits.length})
            </button>
            <button
              className={`btn-mode-toggle ${displayMode === 'selected' ? 'active' : ''}`}
              title="Focus on the single selected qubit"
              onClick={() => onDisplayModeChange('selected')}
            >
              Focus Q{selectedQubit}
            </button>
            <button
              className={`btn-mode-toggle ${displayMode === 'all' ? 'active' : ''}`}
              title="Show all circuit qubits"
              onClick={() => onDisplayModeChange('all')}
            >
              All ({numQubits})
            </button>
            <button
              className={`btn-mode-toggle ${displayMode === 'custom' || showQubitPopover ? 'active' : ''}`}
              title="Customize visible qubits"
              onClick={() => setShowQubitPopover(!showQubitPopover)}
            >
              ⚙ Qubits ({targetDisplayQubits.length}/{numQubits})
            </button>
          </>
        ) : (
          <>
            <button
              className={`btn-mode-toggle ${viewMode !== 'focus' ? 'active' : ''}`}
              onClick={() => onViewModeChange && onViewModeChange('all')}
            >
              Grid
            </button>
            <button
              className={`btn-mode-toggle ${viewMode === 'focus' ? 'active' : ''}`}
              onClick={() => onViewModeChange && onViewModeChange('focus')}
            >
              Focus
            </button>
          </>
        )}
      </div>

      {/* Phase 126: Floating Qubit Filter Popover */}
      {showQubitPopover && (
        <div className="qubit-visibility-popover">
          <div className="popover-header">
            <span>⚙ Visible Qubits ({targetDisplayQubits.length}/{numQubits})</span>
            <button className="popover-close-btn" onClick={() => setShowQubitPopover(false)}>
              ✕
            </button>
          </div>
          <div className="popover-actions">
            <button
              className="btn-popover-sm"
              onClick={() => {
                onDisplayModeChange && onDisplayModeChange('active');
                setShowQubitPopover(false);
              }}
            >
              Active Only
            </button>
            <button
              className="btn-popover-sm"
              onClick={() => {
                onDisplayModeChange && onDisplayModeChange('all');
                setShowQubitPopover(false);
              }}
            >
              Show All
            </button>
          </div>
          <div className="popover-qubit-list">
            {Array.from({ length: numQubits }).map((_, q) => {
              const isChecked = targetDisplayQubits.includes(q);
              const isActive = activeQubits.includes(q);
              return (
                <label key={q} className="popover-qubit-item">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleCustomQubit && onToggleCustomQubit(q)}
                  />
                  <span className="popover-q-name">Q{q}</span>
                  <span className={`popover-q-badge ${isActive ? 'active' : 'idle'}`}>
                    {isActive ? 'Active' : 'Idle'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
