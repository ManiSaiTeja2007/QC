import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  TopologyCatalogItem,
  RouteTopologyResponse,
  PhysicalQubitNodeInfo,
} from '../types/simulation';
import {
  fetchAvailableTopologies,
  routeCircuitToHardware,
  RouteTopologyPayload,
} from '../services/api';

interface HeavyHexPanelProps {
  circuitName?: string;
  synthesis?: string;
  numQubits?: number;
  customGates?: any[];
}

export const HeavyHexPanel: React.FC<HeavyHexPanelProps> = ({
  circuitName = '1-bit-alu',
  synthesis = 'clifford_t',
  numQubits = 7,
  customGates,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectsGroupRef = useRef<THREE.Group | null>(null);

  const [topologies, setTopologies] = useState<TopologyCatalogItem[]>([]);
  const [selectedTopologyId, setSelectedTopologyId] = useState<string>('falcon_27');
  const [noiseAware, setNoiseAware] = useState<boolean>(true);
  const [bidirectional, setBidirectional] = useState<boolean>(true);
  const [routingResult, setRoutingResult] = useState<RouteTopologyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<PhysicalQubitNodeInfo | null>(null);

  // 1. Fetch available topologies on mount
  useEffect(() => {
    let mounted = true;
    fetchAvailableTopologies()
      .then((data) => {
        if (mounted && data.length > 0) {
          setTopologies(data);
        }
      })
      .catch((err) => console.error('Failed to load topologies', err));
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Perform routing on selection or parameter change
  const handleRoute = async () => {
    setLoading(true);
    try {
      const payload: RouteTopologyPayload = {
        circuit_name: circuitName,
        synthesis: synthesis,
        target_topology: selectedTopologyId,
        noise_aware: noiseAware,
        bidirectional: bidirectional,
        custom_gates: customGates,
        num_qubits: numQubits,
      };
      const res = await routeCircuitToHardware(payload);
      setRoutingResult(res);
      setSelectedNode(null);
    } catch (err) {
      console.error('Routing failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRoute();
  }, [selectedTopologyId, noiseAware, bidirectional, circuitName, synthesis]);

  // 3. Initialize Three.js WebGL Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, -18, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 120;
    controls.minDistance = 5;
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight1.position.set(20, 30, 40);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf59e0b, 0.8);
    dirLight2.position.set(-20, -30, -20);
    scene.add(dirLight2);

    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);
    objectsGroupRef.current = objectsGroup;

    // Subtle planar reference grid
    const grid = new THREE.GridHelper(36, 18, 0x1e293b, 0x0f172a);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -1.2;
    scene.add(grid);

    // Animation loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      controls.update();

      // Subtle pulse on active nodes
      if (objectsGroupRef.current) {
        objectsGroupRef.current.children.forEach((child) => {
          if (child.userData?.isMapped) {
            const scale = 1.0 + 0.1 * Math.sin(elapsed * 4.0 + child.userData.id);
            child.scale.set(scale, scale, scale);
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(mountRef.current);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // 4. Update 3D Geometry when routingResult changes
  useEffect(() => {
    const group = objectsGroupRef.current;
    if (!group || !routingResult) return;

    // Clear previous elements
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        if (Array.isArray((obj as any).material)) {
          (obj as any).material.forEach((m: any) => m.dispose());
        } else {
          (obj as any).material.dispose();
        }
      }
    }

    const { topology, routing } = routingResult;
    const finalLayout = routing.final_layout || {};
    const initialLayout = routing.initial_layout || {};

    // Invert layout to get physical -> logical qubit mapping
    const physToLogical: Record<number, number> = {};
    Object.entries(finalLayout).forEach(([lq, pq]) => {
      physToLogical[Number(pq)] = Number(lq);
    });

    // Build swap heatmap lookup
    const heatmapMap: Record<string, number> = {};
    (routing.heatmap || []).forEach((item) => {
      const key = `${Math.min(item.u, item.v)}-${Math.max(item.u, item.v)}`;
      heatmapMap[key] = item.swaps;
    });

    const nodePositions: Record<number, THREE.Vector3> = {};

    // Render physical transmon qubits as spheres
    topology.nodes.forEach((node) => {
      const isMapped = physToLogical[node.id] !== undefined;
      const logicalId = physToLogical[node.id];
      const pos = new THREE.Vector3(node.x, node.y, node.z);
      nodePositions[node.id] = pos;

      const radius = isMapped ? 0.65 : 0.42;
      const geo = new THREE.SphereGeometry(radius, 24, 20);

      // Material: glowing neon amber/gold if mapped, dark cyan/slate if idle
      const mat = new THREE.MeshStandardMaterial({
        color: isMapped ? 0xf59e0b : 0x1e293b,
        emissive: isMapped ? 0xd97706 : 0x0f172a,
        emissiveIntensity: isMapped ? 0.8 : 0.1,
        roughness: 0.25,
        metalness: 0.85,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData = {
        id: node.id,
        isMapped,
        logicalId,
        nodeData: node,
      };
      group.add(mesh);

      // If mapped, add an outer translucent glowing halo ring
      if (isMapped) {
        const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.55, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(pos);
        group.add(ringMesh);
      }
    });

    // Render physical coupling edges as glowing tubes
    topology.edges.forEach((edge) => {
      const p1 = nodePositions[edge.u];
      const p2 = nodePositions[edge.v];
      if (!p1 || !p2) return;

      const key = `${Math.min(edge.u, edge.v)}-${Math.max(edge.u, edge.v)}`;
      const swapCount = heatmapMap[key] || 0;
      const hasSwaps = swapCount > 0;

      // Color code edge by SWAP congestion or base error rate
      let edgeColor = 0x334155; // idle default
      let lineWidth = 0.08;
      let opacity = 0.35;

      if (hasSwaps) {
        // High traffic SWAP bus
        edgeColor = swapCount > 2 ? 0xef4444 : 0xf59e0b;
        lineWidth = 0.18 + Math.min(0.12, swapCount * 0.04);
        opacity = 0.95;
      } else {
        // Low error bus
        edgeColor = edge.cx_error < 0.01 ? 0x0284c7 : 0x475569;
        opacity = 0.45;
      }

      // Create cylinder along line segment
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      const cylGeo = new THREE.CylinderGeometry(lineWidth, lineWidth, len, 8);
      const cylMat = new THREE.MeshStandardMaterial({
        color: edgeColor,
        emissive: hasSwaps ? edgeColor : 0x000000,
        emissiveIntensity: hasSwaps ? 0.7 : 0.0,
        transparent: true,
        opacity: opacity,
        roughness: 0.4,
      });

      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      // Position halfway between p1 and p2
      cylMesh.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
      // Orient towards p2
      cylMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      group.add(cylMesh);
    });
  }, [routingResult]);

  // Click Raycaster for node inspection
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !sceneRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const camera = (rendererRef.current as any)?._camera || controlsRef.current?.object;
    if (!camera) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    if (objectsGroupRef.current) {
      const intersects = raycaster.intersectObjects(objectsGroupRef.current.children);
      const hit = intersects.find((i) => i.object.userData?.nodeData);
      if (hit) {
        setSelectedNode(hit.object.userData.nodeData);
      } else {
        setSelectedNode(null);
      }
    }
  };

  const telemetry = routingResult?.routing;

  return (
    <div className="relative w-full h-[580px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col font-sans select-none">
      {/* Top Header & Q-EDA Controls Bar */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold text-sm">
            ⬡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
                Hardware Topology & SABRE Router
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                Pillar D Q-EDA
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Noise-tuned initial placement & 3-CNOT parity-safe SWAP routing
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Topology Selector */}
          <select
            value={selectedTopologyId}
            onChange={(e) => setSelectedTopologyId(e.target.value)}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
          >
            {topologies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Noise-Aware Toggle */}
          <button
            onClick={() => setNoiseAware(!noiseAware)}
            disabled={loading}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors flex items-center gap-1.5 ${
              noiseAware
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
            title="Maps high-traffic logical qubits to minimum-infidelity physical subgraphs"
          >
            <span className={`w-2 h-2 rounded-full ${noiseAware ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
            Noise-Aware
          </button>

          {/* Bidirectional Toggle */}
          <button
            onClick={() => setBidirectional(!bidirectional)}
            disabled={loading}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors flex items-center gap-1.5 ${
              bidirectional
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
            title="Runs forward-backward-forward SABRE passes to eliminate SWAP congestion"
          >
            <span className={`w-2 h-2 rounded-full ${bidirectional ? 'bg-cyan-400' : 'bg-slate-600'}`} />
            Bidirectional
          </button>

          {/* Refresh / Re-route */}
          <button
            onClick={handleRoute}
            disabled={loading}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex items-center gap-1.5 shadow-sm shadow-cyan-900/50"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              '⚡ Route'
            )}
          </button>
        </div>
      </div>

      {/* Main 3D WebGL Canvas */}
      <div
        ref={mountRef}
        onClick={handleCanvasClick}
        className="w-full flex-1 cursor-grab active:cursor-grabbing relative"
      >
        {/* Floating Metrics HUD Card */}
        {telemetry && (
          <div className="absolute top-4 left-4 z-20 p-3.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-xl text-xs space-y-2.5 max-w-[270px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-200">{telemetry.topology}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Parity: Preserved
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">SWAPs Added</span>
                <span className="text-amber-400 font-bold text-sm">
                  {telemetry.num_swaps}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">
                  (+{telemetry.added_cx_count} CX)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Circuit Depth</span>
                <span className="text-slate-200 font-bold text-sm">
                  {telemetry.depth}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Hardware Latency</span>
                <span className="text-cyan-400 font-semibold">
                  {telemetry.duration_ns >= 1000
                    ? `${(telemetry.duration_ns / 1000).toFixed(2)} µs`
                    : `${telemetry.duration_ns} ns`}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Est. Fidelity</span>
                <span className="text-emerald-400 font-semibold">
                  {(telemetry.estimated_fidelity * 100).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Active Mapped
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-1 rounded bg-red-500" /> SWAP Bus
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-700" /> Idle
              </span>
            </div>
          </div>
        )}

        {/* Selected Transmon Node Details Flyout */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 z-20 p-3.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 shadow-xl text-xs space-y-2 max-w-[240px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-semibold text-cyan-300">
                Transmon Qubit #{selectedNode.id}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-300 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-[11px] font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">T₁ Relaxation:</span>
                <span className="text-slate-200">{selectedNode.t1_us} µs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">T₂ Dephasing:</span>
                <span className="text-slate-200">{selectedNode.t2_us} µs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Readout Error:</span>
                <span className="text-amber-400">
                  {(selectedNode.readout_err * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coordinates:</span>
                <span className="text-slate-400 text-[10px]">
                  ({selectedNode.x}, {selectedNode.y})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Orbit Controls Hint */}
        <div className="absolute bottom-3 left-4 z-10 text-[10px] text-slate-500 pointer-events-none">
          Left-click + Drag to Rotate • Right-click to Pan • Scroll to Zoom
        </div>
      </div>
    </div>
  );
};
export default HeavyHexPanel;
