import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationStep } from '../types/simulation';

interface QSpherePanelProps {
  stepData: SimulationStep | null;
  numQubits: number;
}

export const QSpherePanel: React.FC<QSpherePanelProps> = ({ stepData, numQubits }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth || 400;
    const height = mountRef.current.clientHeight || 350;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060b);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.8, 2.0, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Ambient & Directional Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Q-Sphere Transparent Reference Wireframe
    const sphereRadius = 1.2;
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 24);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    scene.add(new THREE.Mesh(sphereGeo, sphereMat));

    // Equatorial Ring
    const eqRingGeo = new THREE.RingGeometry(sphereRadius - 0.01, sphereRadius, 64);
    const eqRingMat = new THREE.MeshBasicMaterial({
      color: 0x334155,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const eqRing = new THREE.Mesh(eqRingGeo, eqRingMat);
    eqRing.rotation.x = Math.PI / 2;
    scene.add(eqRing);

    // Group for Basis State Nodes & Spoke Lines
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);
    nodesGroupRef.current = nodesGroup;

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Q-Sphere Nodes whenever stepData or numQubits changes
  useEffect(() => {
    const nodesGroup = nodesGroupRef.current;
    if (!nodesGroup) return;

    // Clear previous nodes
    while (nodesGroup.children.length > 0) {
      const child = nodesGroup.children[0];
      nodesGroup.remove(child);
    }

    const n = Math.min(numQubits, 4); // Limit to 2^4 = 16 basis states for clean visualization
    const totalStates = 1 << n;
    const sphereRadius = 1.2;

    const probs = stepData?.probabilities || {};

    // Group basis states by Hamming weight (number of 1s in bitstring)
    const hammingBuckets: { [weight: number]: number[] } = {};
    for (let i = 0; i < totalStates; i++) {
      const bitstring = i.toString(2).padStart(n, '0');
      const weight = bitstring.split('').filter((b) => b === '1').length;
      if (!hammingBuckets[weight]) hammingBuckets[weight] = [];
      hammingBuckets[weight].push(i);
    }

    for (let w = 0; w <= n; w++) {
      const states = hammingBuckets[w] || [];
      // Latitude Y position from +sphereRadius (all 0s) to -sphereRadius (all 1s)
      const latY = sphereRadius * (1 - (2 * w) / n);
      const ringRadius = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - latY * latY));

      states.forEach((stateIdx, indexInRing) => {
        const bitstring = stateIdx.toString(2).padStart(n, '0');
        const prob = probs[bitstring] || 0;
        const amp = Math.sqrt(prob);

        const phi = (2 * Math.PI * indexInRing) / states.length;
        const posX = ringRadius * Math.cos(phi);
        const posZ = ringRadius * Math.sin(phi);
        const nodePos = new THREE.Vector3(posX, latY, posZ);

        // Node sphere radius proportional to amplitude |α|
        const nodeRadius = 0.04 + amp * 0.14;
        const hue = (stateIdx / totalStates) * 360;
        const colorHex = new THREE.Color(`hsl(${hue}, 85%, 60%)`);

        // Render Node Mesh
        const nodeGeo = new THREE.SphereGeometry(nodeRadius, 16, 12);
        const nodeMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: prob > 0.01 ? 0.6 : 0.1,
          roughness: 0.2,
        });
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.position.copy(nodePos);
        nodesGroup.add(nodeMesh);

        // Render Vector Spoke Line if amplitude > 0
        if (prob > 0.01) {
          const spokeGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            nodePos,
          ]);
          const spokeMat = new THREE.LineBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.7,
            linewidth: 2,
          });
          nodesGroup.add(new THREE.Line(spokeGeo, spokeMat));
        }
      });
    }
  }, [stepData, numQubits]);

  return (
    <div className="qsphere-container">
      <div className="qsphere-canvas" ref={mountRef} />
      <div className="qsphere-overlay">
        <span className="qsphere-tag">3D Q-Sphere Statevector</span>
      </div>
    </div>
  );
};
