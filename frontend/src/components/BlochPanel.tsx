import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationStep, BlochVector } from '../types/simulation';

interface BlochPanelProps {
  numQubits: number;
  qubitNames: string[];
  stepData: SimulationStep | null;
  selectedQubit: number;
  viewMode: 'all' | 'grid' | 'focus';
  onViewModeChange: (mode: 'all' | 'grid' | 'focus') => void;
  onSelectQubit: (qIdx: number) => void;
}

interface CustomArrowHelper extends THREE.ArrowHelper {
  direction?: THREE.Vector3;
}

const QUBIT_COLORS = [
  0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b,
  0x8b5cf6, 0xec4899, 0x14b8a6, 0x6366f1, 0x84cc16
];

const BLOCH_LAYOUT = {
  sphereRadius: 0.85,
  labelRadius: 1.08,
  titleOffset: 1.28,
  spacingX: 2.30,
  spacingY: 2.40,
  safeMarginFactor: 1.18,
};

function blochToThreeJS(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, z, y);
}

function createTextSprite(text: string, colorStr = '#94a3b8'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'Bold 28px Inter, sans-serif';
  ctx.fillStyle = colorStr;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.55, 0.28, 1.0);
  return sprite;
}

export const BlochPanel: React.FC<BlochPanelProps> = ({
  numQubits,
  qubitNames,
  stepData,
  selectedQubit,
  viewMode,
  onViewModeChange,
  onSelectQubit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupsRef = useRef<{ group: THREE.Group; arrow: CustomArrowHelper }[]>([]);
  const targetVectorsRef = useRef<THREE.Vector3[]>([]);

  // 1. Initialize Three.js WebGL Scene & Controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 380;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030509);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();

      groupsRef.current.forEach((g, i) => {
        if (targetVectorsRef.current[i]) {
          const arrow = g.arrow;
          const targetVec = targetVectorsRef.current[i];
          const targetLen = targetVec.length();

          if (targetLen > 0.0001) {
            const currentDir = arrow.direction
              ? arrow.direction.clone().normalize()
              : new THREE.Vector3(0, 1, 0);
            const targetDir = targetVec.clone().normalize();

            if (currentDir.dot(targetDir) < -0.999) {
              currentDir.add(new THREE.Vector3(0.01, 0.01, 0)).normalize();
            }

            const qCurrent = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), currentDir);
            const qTarget = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetDir);

            qCurrent.slerp(qTarget, 0.25);
            const newDir = new THREE.Vector3(0, 1, 0).applyQuaternion(qCurrent).normalize();

            arrow.direction = newDir.clone();
            arrow.setDirection(newDir);

            const arrowLength = Math.max(0.2, targetLen * (viewMode === 'focus' ? 1.4 : BLOCH_LAYOUT.sphereRadius));
            arrow.setLength(arrowLength, 0.22, 0.10);
          }
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Raycaster for 3D click selection
    const handleCanvasClick = (event: MouseEvent) => {
      if (!container || !cameraRef.current || !sceneRef.current) return;
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
      for (const hit of intersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj !== sceneRef.current) {
          if (obj.userData && typeof obj.userData.qubitIndex === 'number') {
            onSelectQubit(obj.userData.qubitIndex);
            return;
          }
          obj = obj.parent;
        }
      }
    };
    container.addEventListener('click', handleCanvasClick);

    const ro = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      fitCamera();
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('click', handleCanvasClick);
      ro.disconnect();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [onSelectQubit]);

  const fitCamera = () => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (viewMode === 'focus') {
      camera.position.set(0, 0, 5.5);
      if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
      }
      return;
    }

    const cols = numQubits <= 3 ? numQubits : 3;
    const rows = Math.ceil(numQubits / cols);

    const gridWidth = (cols - 1) * BLOCH_LAYOUT.spacingX + 2.5;
    const gridHeight = (rows - 1) * BLOCH_LAYOUT.spacingY + 2.5;

    const container = containerRef.current;
    const width = container ? container.clientWidth : 500;
    const height = container ? container.clientHeight : 380;
    const aspect = width && height ? width / height : 1.2;

    const fovRad = (camera.fov * Math.PI) / 180;
    const distY = gridHeight / 2 / Math.tan(fovRad / 2);
    const distX = gridWidth / 2 / (Math.tan(fovRad / 2) * aspect);
    const dist = Math.max(distX, distY) * BLOCH_LAYOUT.safeMarginFactor;

    const minRowDist = rows === 1 ? 6.5 : rows === 2 ? 10.0 : 13.5;
    const finalDist = Math.max(minRowDist, dist);

    camera.position.set(0, 0, finalDist);
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  };

  // 2. Rebuild 3D Spheres whenever numQubits, selectedQubit, or viewMode changes
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    groupsRef.current.forEach((g) => scene.remove(g.group));
    groupsRef.current = [];
    targetVectorsRef.current = [];

    if (viewMode === 'focus') {
      const q = selectedQubit;
      const qGroup = new THREE.Group();
      qGroup.position.set(0, 0, 0);
      qGroup.userData = { qubitIndex: q };

      const color = QUBIT_COLORS[q % QUBIT_COLORS.length];
      const rad = 1.4;

      const sphereGeo = new THREE.SphereGeometry(rad, 24, 20);
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.28 });
      qGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

      const eqRingGeo = new THREE.RingGeometry(rad - 0.01, rad, 32);
      const eqRingMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
      const eqRingMesh = new THREE.Mesh(eqRingGeo, eqRingMat);
      eqRingMesh.rotation.x = Math.PI / 2;
      qGroup.add(eqRingMesh);

      const axesGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-rad * 1.15, 0, 0), new THREE.Vector3(rad * 1.15, 0, 0),
        new THREE.Vector3(0, -rad * 1.15, 0), new THREE.Vector3(0, rad * 1.15, 0),
        new THREE.Vector3(0, 0, -rad * 1.15), new THREE.Vector3(0, 0, rad * 1.15),
      ]);
      const axesMat = new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.08, gapSize: 0.04 });
      const axesLines = new THREE.LineSegments(axesGeo, axesMat);
      axesLines.computeLineDistances();
      qGroup.add(axesLines);

      const lbl0 = createTextSprite('|0⟩', '#34d399'); lbl0.position.set(0, rad * 1.2, 0); qGroup.add(lbl0);
      const lbl1 = createTextSprite('|1⟩', '#f43f5e'); lbl1.position.set(0, -rad * 1.2, 0); qGroup.add(lbl1);
      const lblP = createTextSprite('|+⟩', '#38bdf8'); lblP.position.set(rad * 1.2, 0, 0); qGroup.add(lblP);
      const lblM = createTextSprite('|-⟩', '#64748b'); lblM.position.set(-rad * 1.2, 0, 0); qGroup.add(lblM);
      const lblPI = createTextSprite('|+i⟩', '#06b6d4'); lblPI.position.set(0, 0, rad * 1.2); qGroup.add(lblPI);
      const lblMI = createTextSprite('|-i⟩', '#6366f1'); lblMI.position.set(0, 0, -rad * 1.2); qGroup.add(lblMI);

      const qName = qubitNames[q] ? qubitNames[q] : `Q${q}`;
      const titleSprite = createTextSprite(qName, '#' + color.toString(16));
      titleSprite.position.set(0, rad * 1.4, 0);
      titleSprite.scale.set(1.0, 0.5, 1.0);
      qGroup.add(titleSprite);

      const dir = new THREE.Vector3(0, 1, 0);
      const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), rad, color, 0.25, 0.12) as CustomArrowHelper;
      arrow.direction = dir.clone();
      qGroup.add(arrow);

      scene.add(qGroup);
      groupsRef.current.push({ group: qGroup, arrow });
      targetVectorsRef.current.push(dir.clone());
      fitCamera();
      return;
    }

    const cols = numQubits <= 3 ? numQubits : 3;
    const rows = Math.ceil(numQubits / cols);
    const activeGateQubits = stepData?.gate ? stepData.gate.qubits : [];

    for (let q = 0; q < numQubits; q++) {
      const r = Math.floor(q / cols);
      const c = q % cols;

      const currRowCols = r < rows - 1 || numQubits % cols === 0 ? cols : numQubits % cols;
      const gridX = (c - (currRowCols - 1) / 2.0) * BLOCH_LAYOUT.spacingX;
      const gridY = ((rows - 1) / 2.0 - r) * BLOCH_LAYOUT.spacingY;

      const qGroup = new THREE.Group();
      qGroup.position.set(gridX, gridY, 0);
      qGroup.userData = { qubitIndex: q };

      const color = QUBIT_COLORS[q % QUBIT_COLORS.length];
      const rad = BLOCH_LAYOUT.sphereRadius;

      const isSel = q === selectedQubit;
      const isActiveGate = activeGateQubits.includes(q);

      // Consistently dimmed subtle wireframe sphere — NO bright highlighting on sphere lines
      const sphereGeo = new THREE.SphereGeometry(rad, 20, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0x1e293b,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      });
      qGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

      const eqRingGeo = new THREE.RingGeometry(rad - 0.01, rad, 32);
      const eqRingMat = new THREE.MeshBasicMaterial({
        color: 0x334155,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
      });
      const eqRingMesh = new THREE.Mesh(eqRingGeo, eqRingMat);
      eqRingMesh.rotation.x = Math.PI / 2;
      qGroup.add(eqRingMesh);

      const axesGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-rad * 1.12, 0, 0), new THREE.Vector3(rad * 1.12, 0, 0),
        new THREE.Vector3(0, -rad * 1.12, 0), new THREE.Vector3(0, rad * 1.12, 0),
        new THREE.Vector3(0, 0, -rad * 1.12), new THREE.Vector3(0, 0, rad * 1.12),
      ]);
      const axesMat = new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.08, gapSize: 0.04 });
      const axesLines = new THREE.LineSegments(axesGeo, axesMat);
      axesLines.computeLineDistances();
      qGroup.add(axesLines);

      const lbl0 = createTextSprite('|0⟩', '#34d399'); lbl0.position.set(0, BLOCH_LAYOUT.labelRadius, 0); qGroup.add(lbl0);
      const lbl1 = createTextSprite('|1⟩', '#f43f5e'); lbl1.position.set(0, -BLOCH_LAYOUT.labelRadius, 0); qGroup.add(lbl1);
      const lblP = createTextSprite('|+⟩', '#38bdf8'); lblP.position.set(BLOCH_LAYOUT.labelRadius, 0, 0); qGroup.add(lblP);
      const lblM = createTextSprite('|-⟩', '#64748b'); lblM.position.set(-BLOCH_LAYOUT.labelRadius, 0, 0); qGroup.add(lblM);
      const lblPI = createTextSprite('|+i⟩', '#06b6d4'); lblPI.position.set(0, 0, BLOCH_LAYOUT.labelRadius); qGroup.add(lblPI);
      const lblMI = createTextSprite('|-i⟩', '#6366f1'); lblMI.position.set(0, 0, -BLOCH_LAYOUT.labelRadius); qGroup.add(lblMI);

      const qName = qubitNames[q] ? qubitNames[q].split(' ')[0] : `Q${q}`;
      const titleSprite = createTextSprite(qName, '#' + color.toString(16));
      titleSprite.position.set(0, BLOCH_LAYOUT.titleOffset, 0);
      titleSprite.scale.set(0.75, 0.38, 1.0);
      qGroup.add(titleSprite);

      const dir = new THREE.Vector3(0, 1, 0);
      const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), rad, color, 0.18, 0.08) as CustomArrowHelper;
      arrow.direction = dir.clone();
      qGroup.add(arrow);

      scene.add(qGroup);
      groupsRef.current.push({ group: qGroup, arrow });
      targetVectorsRef.current.push(dir.clone());
    }

    fitCamera();
  }, [numQubits, selectedQubit, viewMode]);

  // 3. Update target vectors when stepData changes
  useEffect(() => {
    if (!stepData) return;

    stepData.bloch_vectors.forEach((bv, i) => {
      if (viewMode === 'focus') {
        if (i === selectedQubit && targetVectorsRef.current[0]) {
          targetVectorsRef.current[0].copy(blochToThreeJS(bv.x, bv.y, bv.z));
        }
      } else if (targetVectorsRef.current[i]) {
        targetVectorsRef.current[i].copy(blochToThreeJS(bv.x, bv.y, bv.z));
      }
    });
  }, [stepData, selectedQubit, viewMode]);

  const setCameraPreset = (preset: string) => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    if (preset === 'reset') {
      fitCamera();
      return;
    }

    const dist = camera.position.length() || 8.0;
    if (preset === 'front') camera.position.set(dist, 0, 0);
    if (preset === 'top') camera.position.set(0, dist, 0.001);
    if (preset === 'side') camera.position.set(0, 0, dist);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <article className="card panel-bloch">
      <div className="card-header">
        <h3>🌐 3D WebGL Bloch Studio</h3>

        <div className="view-mode-toggle">
          <button
            className={`btn-xs ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => onViewModeChange('all')}
          >
            All Qubits
          </button>
          <button
            className={`btn-xs ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
          >
            Grid 3D
          </button>
          <button
            className={`btn-xs ${viewMode === 'focus' ? 'active' : ''}`}
            onClick={() => onViewModeChange('focus')}
          >
            Focus Q{selectedQubit}
          </button>
        </div>

        <div className="cam-btn-group">
          <button className="btn-xs" title="Reset View" onClick={() => setCameraPreset('reset')}>
            🎥 Reset
          </button>
          <button className="btn-xs" title="Front View" onClick={() => setCameraPreset('front')}>
            +X
          </button>
          <button className="btn-xs" title="Top View" onClick={() => setCameraPreset('top')}>
            +Z
          </button>
          <button className="btn-xs" title="Side View" onClick={() => setCameraPreset('side')}>
            +Y
          </button>
        </div>
      </div>

      <div ref={containerRef} className="bloch-canvas-box" />
    </article>
  );
};
