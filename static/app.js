/**
 * Quantum ALU 3D Studio — Phase 32 Multi-Qubit Results & Dev Auto-Reload Infrastructure
 * Single Source of Truth Pipeline: CircuitIR -> StepStore -> Derived Visualizations
 */

// ─── Layout & Coordinate System Contract ─────────────────────────────────────
const BLOCH_LAYOUT = {
    sphereRadius: 0.85,
    labelRadius: 1.08,
    titleOffset: 1.28,
    spacingX: 2.30,
    spacingY: 2.40,
    safeMarginFactor: 1.18
};

/**
 * Canonical Coordinate Contract:
 *   Bloch +Z (Top |0⟩)   -> Three.js +Y
 *   Bloch +X (Front |+⟩) -> Three.js +X
 *   Bloch +Y (Side |+i⟩) -> Three.js +Z
 */
function blochToThreeJS(x, y, z) {
    return new THREE.Vector3(x, z, y);
}

function threeToBloch(X, Y, Z) {
    return new THREE.Vector3(X, Z, Y);
}

// ─── Unified State Store ──────────────────────────────────────────────────────
let simulationData = null;
let currentStepIdx = 0;
let selectedQubitIdx = 0;
let currentMeasurementBasis = 'Z'; // 'Z', 'X', 'Y'
let currentViewMode = 'all'; // 'all', 'grid', 'focus'
let isPlaying = false;
let playIntervalId = null;
let playbackSpeedMs = 200;

// Input Qubit States
let inputBits = [1, 1, 1, 0, 1, 1, 0];

// Three.js Global Objects
let scene, camera, renderer, controls;
let qubitBlochGroups = [];
let targetVectors = [];

// Qubit Color Palette
const QUBIT_COLORS = [
    0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b,
    0x8b5cf6, 0xec4899, 0x14b8a6, 0x6366f1, 0x84cc16
];

// Physical Gate Transformations Knowledge Base
const GATE_PHYSICAL_EFFECTS = {
    'INIT': '<b>INIT</b>: Initial computational basis state |ψ₀⟩.',
    'H': '<b>Hadamard (H)</b>: Creates equal superposition |+⟩ = (|0⟩+|1⟩)/√2. Rotates Bloch vector by π about axis (X+Z)/√2.',
    'X': '<b>Pauli-X (NOT)</b>: Bit-flip gate |0⟩ ↔ |1⟩. Rotates Bloch vector by π about X-axis.',
    'Y': '<b>Pauli-Y</b>: Bit and phase-flip gate |0⟩ → i|1⟩, |1⟩ → -i|0⟩. Rotates Bloch vector by π about Y-axis.',
    'Z': '<b>Pauli-Z</b>: Phase-flip gate |1⟩ → -|1⟩. Rotates Bloch vector by π about Z-axis.',
    'S': '<b>Phase (S)</b>: Applies π/2 phase shift to |1⟩. Rotates Bloch vector by π/2 about Z-axis.',
    'SDG': '<b>S-Dagger (S†)</b>: Applies -π/2 phase shift to |1⟩. Rotates Bloch vector by -π/2 about Z-axis.',
    'T': '<b>T Gate (π/8)</b>: Fault-tolerant Clifford+T gate. Applies π/4 phase shift to |1⟩. Rotates Bloch vector by π/4 about Z-axis.',
    'TDG': '<b>T-Dagger (T†)</b>: Applies -π/4 phase shift to |1⟩. Rotates Bloch vector by -π/4 about Z-axis.',
    'CX': '<b>Controlled-NOT (CNOT)</b>: 2-Qubit entangling gate. Target flips if control is |1⟩. Creates multi-qubit entanglement (reduced state purity |r| < 1.0).',
    'CSWAP': '<b>Fredkin (CSWAP)</b>: 3-Qubit controlled-SWAP gate. Swaps target qubits if control is |1⟩. Parity-preserving reversible block.',
};

// ─── Initialization ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    setupEventListeners();
    setupResizeObserver();
    fetchPresetsAndRunSimulation();
});

// ─── Three.js 3D WebGL Setup & ResizeObserver Lifecycle ──────────────────────
function initThreeJS() {
    const container = document.getElementById('bloch-3d-canvas-container');
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 380;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030509);

    camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.90);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    animateThreeJS();
}

function setupResizeObserver() {
    const container = document.getElementById('bloch-3d-canvas-container');
    if (!container || !window.ResizeObserver) return;

    const ro = new ResizeObserver(() => {
        onWindowResize();
    });
    ro.observe(container);
}

function fitCameraToGrid() {
    if (!camera || !simulationData) return;
    if (currentViewMode === 'focus') {
        camera.position.set(0, 0, 5.5);
        if (controls) {
            controls.target.set(0, 0, 0);
            controls.update();
        }
        return;
    }

    const nQubits = simulationData.num_qubits;
    const cols = nQubits <= 3 ? nQubits : 3;
    const rows = Math.ceil(nQubits / cols);

    const gridWidth = (cols - 1) * BLOCH_LAYOUT.spacingX + 2.5;
    const gridHeight = (rows - 1) * BLOCH_LAYOUT.spacingY + 2.5;

    const container = document.getElementById('bloch-3d-canvas-container');
    const width = container ? container.clientWidth : 500;
    const height = container ? container.clientHeight : 380;
    const aspect = (width && height) ? (width / height) : 1.2;

    const fovRad = (camera.fov * Math.PI) / 180;

    const distY = (gridHeight / 2) / Math.tan(fovRad / 2);
    const distX = (gridWidth / 2) / (Math.tan(fovRad / 2) * aspect);
    const dist = Math.max(distX, distY) * BLOCH_LAYOUT.safeMarginFactor;

    // Guaranteed minimum camera distance based on number of rows to prevent clipping
    const minRowDist = (rows === 1) ? 6.5 : ((rows === 2) ? 10.0 : 13.5);
    const finalDist = Math.max(minRowDist, dist);

    camera.position.set(0, 0, finalDist);
    if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

function setCameraPreset(preset) {
    if (!camera) return;
    if (preset === 'reset') {
        fitCameraToGrid();
        return;
    }

    const dist = camera.position.length() || 8.0;

    if (preset === 'front') { // +X View
        camera.position.set(dist, 0, 0);
    } else if (preset === 'top') { // +Z View (looking down from Top)
        camera.position.set(0, dist, 0.001);
    } else if (preset === 'side') { // +Y View
        camera.position.set(0, 0, dist);
    }
    if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

function onWindowResize() {
    const container = document.getElementById('bloch-3d-canvas-container');
    if (!container || !renderer || !camera) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    fitCameraToGrid();
}

function animateThreeJS() {
    requestAnimationFrame(animateThreeJS);
    if (controls) controls.update();

    qubitBlochGroups.forEach((group, i) => {
        if (targetVectors[i]) {
            const arrow = group.arrow;
            const targetVec = targetVectors[i];

            const targetLen = targetVec.length();
            if (targetLen > 0.0001) {
                const currentDir = arrow.direction ? arrow.direction.clone().normalize() : new THREE.Vector3(0, 1, 0);
                const targetDir = targetVec.clone().normalize();

                // If directions are nearly opposite (antipodal vectors), add slight offset to allow smooth rotation arc
                if (currentDir.dot(targetDir) < -0.999) {
                    currentDir.add(new THREE.Vector3(0.01, 0.01, 0)).normalize();
                }

                const qCurrent = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), currentDir);
                const qTarget = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetDir);
                
                qCurrent.slerp(qTarget, 0.25);
                const newDir = new THREE.Vector3(0, 1, 0).applyQuaternion(qCurrent).normalize();

                arrow.direction = newDir.clone();
                arrow.setDirection(newDir);
                
                const arrowLength = Math.max(0.2, targetLen * (currentViewMode === 'focus' ? 1.4 : BLOCH_LAYOUT.sphereRadius));
                arrow.setLength(arrowLength, 0.22, 0.10);
            }
        }
    });

    renderer.render(scene, camera);
}

function createTextSprite(text, colorStr = '#94a3b8') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
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

function build3DBlochSpheres(numQubits, qubitNames) {
    qubitBlochGroups.forEach(g => scene.remove(g.group));
    qubitBlochGroups = [];
    targetVectors = [];

    if (currentViewMode === 'focus') {
        const q = selectedQubitIdx;
        const qGroup = new THREE.Group();
        qGroup.position.set(0, 0, 0);

        const color = QUBIT_COLORS[q % QUBIT_COLORS.length];
        const rad = 1.4;

        // 1. Wireframe Sphere
        const sphereGeo = new THREE.SphereGeometry(rad, 24, 20);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.28 });
        qGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

        // 2. Equatorial Ring
        const eqRingGeo = new THREE.RingGeometry(rad - 0.01, rad, 32);
        const eqRingMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const eqRingMesh = new THREE.Mesh(eqRingGeo, eqRingMat);
        eqRingMesh.rotation.x = Math.PI / 2;
        qGroup.add(eqRingMesh);

        // 3. Axes Lines
        const axesGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-rad * 1.15, 0, 0), new THREE.Vector3(rad * 1.15, 0, 0),
            new THREE.Vector3(0, -rad * 1.15, 0), new THREE.Vector3(0, rad * 1.15, 0),
            new THREE.Vector3(0, 0, -rad * 1.15), new THREE.Vector3(0, 0, rad * 1.15),
        ]);
        const axesMat = new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.08, gapSize: 0.04 });
        const axesLines = new THREE.LineSegments(axesGeo, axesMat);
        axesLines.computeLineDistances();
        qGroup.add(axesLines);

        // 4. Basis Labels
        const lbl0 = createTextSprite('|0⟩', '#34d399'); lbl0.position.set(0, rad * 1.2, 0); qGroup.add(lbl0);
        const lbl1 = createTextSprite('|1⟩', '#f43f5e'); lbl1.position.set(0, -rad * 1.2, 0); qGroup.add(lbl1);
        const lblP = createTextSprite('|+⟩', '#38bdf8'); lblP.position.set(rad * 1.2, 0, 0); qGroup.add(lblP);
        const lblM = createTextSprite('|-⟩', '#64748b'); lblM.position.set(-rad * 1.2, 0, 0); qGroup.add(lblM);

        // Q-Name Title
        const qName = qubitNames[q] ? qubitNames[q] : `Q${q}`;
        const titleSprite = createTextSprite(qName, '#' + color.toString(16));
        titleSprite.position.set(0, rad * 1.4, 0);
        titleSprite.scale.set(1.0, 0.5, 1.0);
        qGroup.add(titleSprite);

        // Arrow
        const dir = new THREE.Vector3(0, 1, 0);
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), rad, color, 0.25, 0.12);
        arrow.direction = dir.clone();
        qGroup.add(arrow);

        scene.add(qGroup);
        qubitBlochGroups.push({ group: qGroup, arrow });
        targetVectors.push(dir.clone());
        fitCameraToGrid();
        return;
    }

    // Grid Layout (1-3: 1x3, 4-6: 2x3, 7-9: 3x3)
    const cols = numQubits <= 3 ? numQubits : 3;
    const rows = Math.ceil(numQubits / cols);

    for (let q = 0; q < numQubits; q++) {
        const r = Math.floor(q / cols);
        const c = q % cols;

        const currRowCols = (r < rows - 1 || numQubits % cols === 0) ? cols : (numQubits % cols);
        const gridX = (c - (currRowCols - 1) / 2.0) * BLOCH_LAYOUT.spacingX;
        const gridY = ((rows - 1) / 2.0 - r) * BLOCH_LAYOUT.spacingY;

        const qGroup = new THREE.Group();
        qGroup.position.set(gridX, gridY, 0);

        const color = QUBIT_COLORS[q % QUBIT_COLORS.length];
        const isSelected = (q === selectedQubitIdx);
        const rad = BLOCH_LAYOUT.sphereRadius;

        // 1. Wireframe Bloch Sphere (Consistently dimmed for all spheres)
        const sphereGeo = new THREE.SphereGeometry(rad, 20, 16);
        const sphereMat = new THREE.MeshBasicMaterial({
            color: 0x1e293b,
            wireframe: true,
            transparent: true,
            opacity: 0.15
        });
        qGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

        // 2. Equatorial Ring
        const eqRingGeo = new THREE.RingGeometry(rad - 0.01, rad, 32);
        const eqRingMat = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
        const eqRingMesh = new THREE.Mesh(eqRingGeo, eqRingMat);
        eqRingMesh.rotation.x = Math.PI / 2;
        qGroup.add(eqRingMesh);

        // 3. Axes Lines
        const axesGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-rad * 1.12, 0, 0), new THREE.Vector3(rad * 1.12, 0, 0),
            new THREE.Vector3(0, -rad * 1.12, 0), new THREE.Vector3(0, rad * 1.12, 0),
            new THREE.Vector3(0, 0, -rad * 1.12), new THREE.Vector3(0, 0, rad * 1.12),
        ]);
        const axesMat = new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.08, gapSize: 0.04 });
        const axesLines = new THREE.LineSegments(axesGeo, axesMat);
        axesLines.computeLineDistances();
        qGroup.add(axesLines);

        // 4. Basis State Labels
        const lbl0 = createTextSprite('|0⟩', '#34d399'); lbl0.position.set(0, BLOCH_LAYOUT.labelRadius, 0); qGroup.add(lbl0);
        const lbl1 = createTextSprite('|1⟩', '#f43f5e'); lbl1.position.set(0, -BLOCH_LAYOUT.labelRadius, 0); qGroup.add(lbl1);
        const lblP = createTextSprite('|+⟩', '#38bdf8'); lblP.position.set(BLOCH_LAYOUT.labelRadius, 0, 0); qGroup.add(lblP);
        const lblM = createTextSprite('|-⟩', '#64748b'); lblM.position.set(-BLOCH_LAYOUT.labelRadius, 0, 0); qGroup.add(lblM);

        // Q-Name Title Label
        const qName = qubitNames[q] ? qubitNames[q].split(' ')[0] : `Q${q}`;
        const titleSprite = createTextSprite(qName, '#' + color.toString(16));
        titleSprite.position.set(0, BLOCH_LAYOUT.titleOffset, 0);
        titleSprite.scale.set(0.75, 0.38, 1.0);
        qGroup.add(titleSprite);

        // State Vector Arrow Helper
        const dir = new THREE.Vector3(0, 1, 0);
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), rad, color, 0.18, 0.08);
        arrow.direction = dir.clone();
        qGroup.add(arrow);

        scene.add(qGroup);
        qubitBlochGroups.push({ group: qGroup, arrow });
        targetVectors.push(dir.clone());
    }

    fitCameraToGrid();
}

// ─── API & Simulation Controller ─────────────────────────────────────────────
function setupEventListeners() {
    document.getElementById('arch-select').addEventListener('change', onArchChange);
    document.getElementById('synth-select').addEventListener('change', fetchSimulation);
    document.getElementById('preset-select').addEventListener('change', onPresetChange);
    document.getElementById('btn-simulate').addEventListener('click', fetchSimulation);

    document.getElementById('btn-reset').addEventListener('click', () => setStep(0));
    document.getElementById('btn-prev').addEventListener('click', prevStep);
    document.getElementById('btn-next').addEventListener('click', nextStep);
    document.getElementById('btn-play').addEventListener('click', togglePlay);
    document.getElementById('step-scrubber').addEventListener('input', (e) => setStep(parseInt(e.target.value)));
    
    document.getElementById('speed-slider').addEventListener('input', (e) => {
        playbackSpeedMs = parseInt(e.target.value);
        document.getElementById('speed-val').innerText = `${playbackSpeedMs}ms`;
        if (isPlaying) {
            pausePlay();
            startPlay();
        }
    });

    // Camera Presets
    document.getElementById('cam-reset').addEventListener('click', () => setCameraPreset('reset'));
    document.getElementById('cam-front').addEventListener('click', () => setCameraPreset('front'));
    document.getElementById('cam-top').addEventListener('click', () => setCameraPreset('top'));
    document.getElementById('cam-side').addEventListener('click', () => setCameraPreset('side'));

    // Basis Buttons
    document.getElementById('basis-z').addEventListener('click', () => setMeasurementBasis('Z'));
    document.getElementById('basis-x').addEventListener('click', () => setMeasurementBasis('X'));
    document.getElementById('basis-y').addEventListener('click', () => setMeasurementBasis('Y'));

    // Phase 32 Mode Buttons
    const modeAllBtn = document.getElementById('mode-all');
    if (modeAllBtn) modeAllBtn.addEventListener('click', () => setViewMode('all'));
    document.getElementById('mode-grid').addEventListener('click', () => setViewMode('grid'));
    document.getElementById('mode-focus').addEventListener('click', () => setViewMode('focus'));
}

function setMeasurementBasis(basis) {
    currentMeasurementBasis = basis;
    ['basis-z', 'basis-x', 'basis-y'].forEach(id => {
        document.getElementById(id).classList.toggle('active', id.endsWith(basis.toLowerCase()));
    });
    document.getElementById('prob-title').innerText = `State Probability Distribution (${basis}-Basis)`;
    updateStepView();
}

function setViewMode(mode) {
    currentViewMode = mode;
    ['mode-all', 'mode-grid', 'mode-focus'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('active', id.endsWith(mode));
    });

    const summaryContainer = document.getElementById('all-qubits-summary-container');
    if (summaryContainer) {
        summaryContainer.style.display = (mode === 'focus') ? 'none' : 'flex';
    }

    if (simulationData) {
        build3DBlochSpheres(simulationData.num_qubits, simulationData.qubit_names);
        updateStepView();
    }
}

function onArchChange() {
    const arch = document.getElementById('arch-select').value;
    if (arch === '1-bit-alu') {
        inputBits = [1, 1, 1, 0, 1, 1, 0];
    } else if (arch === 'falfg-gate') {
        inputBits = [1, 1, 1, 0, 0];
    } else if (arch === 'fredkin-gate') {
        inputBits = [1, 0, 1];
    } else {
        inputBits = [1, 1, 1, 0, 0, 0, 0, 0, 0];
    }
    selectedQubitIdx = 0;
    renderQubitToggleButtons();
    fetchSimulation();
}

function onPresetChange() {
    const preset = document.getElementById('preset-select').value;
    if (preset === 'Full Adder') {
        inputBits = [1, 1, 1, 0, 1, 1, 0];
    } else if (preset === 'Half Adder') {
        inputBits = [1, 1, 0, 0, 1, 1, 0];
    } else if (preset === 'Full Subtractor') {
        inputBits = [1, 1, 1, 1, 1, 1, 0];
    } else if (preset.includes('XOR')) {
        inputBits = [1, 0, 0, 0, 0, 1, 0];
    } else if (preset === 'AND') {
        inputBits = [1, 1, 0, 0, 0, 0, 0];
    }
    selectedQubitIdx = 0;
    renderQubitToggleButtons();
    fetchSimulation();
}

function selectQubit(qIdx) {
    if (!simulationData) return;
    selectedQubitIdx = Math.max(0, Math.min(qIdx, simulationData.num_qubits - 1));
    document.getElementById('mode-focus').innerText = `Focus Q${selectedQubitIdx}`;
    if (currentViewMode === 'focus') {
        build3DBlochSpheres(simulationData.num_qubits, simulationData.qubit_names);
    }
    updateStepView();
}

function renderQubitToggleButtons() {
    const container = document.getElementById('qubit-toggles');
    container.innerHTML = '';
    
    const arch = document.getElementById('arch-select').value;
    let names = ['Q0 A', 'Q1 B', 'Q2 S0', 'Q3 S1', 'Q4 M', 'Q5 S2', 'Q6 S3'];
    if (arch === 'falfg-gate') names = ['Q0 A', 'Q1 B', 'Q2 C', 'Q3 D', 'Q4 E'];
    if (arch === 'fredkin-gate') names = ['Q0 Control A', 'Q1 Target B', 'Q2 Target C'];
    if (arch === 'bennett-adder') names = ['Q0 A', 'Q1 B', 'Q2 Cin', 'Q3 Sel', 'Q4 Mode', 'Q5 Cout', 'Q6 Sum', 'Q7 C\'', 'Q8 S\''];

    names.forEach((name, i) => {
        const btn = document.createElement('button');
        btn.className = `bit-toggle ${inputBits[i] ? 'active' : ''}`;
        btn.innerText = `${name}: ${inputBits[i]}`;
        btn.onclick = () => {
            inputBits[i] = inputBits[i] ? 0 : 1;
            btn.innerText = `${name}: ${inputBits[i]}`;
            btn.classList.toggle('active', inputBits[i] === 1);
            fetchSimulation();
        };
        container.appendChild(btn);
    });
}

function fetchPresetsAndRunSimulation() {
    renderQubitToggleButtons();
    fetchSimulation();
}

function fetchSimulation() {
    const arch = document.getElementById('arch-select').value;
    const synth = document.getElementById('synth-select').value;

    const payload = {
        architecture: arch,
        synthesis: synth,
        input_bits: inputBits
    };

    fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        simulationData = data;
        onSimulationDataLoaded();
    })
    .catch(err => {
        console.error('Simulation error:', err);
    });
}

function onSimulationDataLoaded() {
    if (!simulationData) return;

    // Metrics
    document.getElementById('m-qubits').innerText = simulationData.num_qubits;
    document.getElementById('m-ops').innerText = simulationData.total_logical_ops;
    document.getElementById('m-steps').innerText = simulationData.total_primitive_steps;
    document.getElementById('m-qc').innerText = simulationData.metrics.quantum_cost;
    document.getElementById('m-tcount').innerText = simulationData.metrics.t_count;
    document.getElementById('m-tdepth').innerText = simulationData.metrics.t_depth;

    // Parity Badge
    const pBadge = document.getElementById('parity-badge');
    if (simulationData.parity_preserved) {
        pBadge.className = 'badge pass';
        pBadge.innerText = `✅ Parity Preserved: P_in = ${simulationData.p_in} == P_out = ${simulationData.p_out} | Input ${simulationData.input_bits.join('')} → Output ${simulationData.output_bits.join('')}`;
    } else {
        pBadge.className = 'badge fail';
        pBadge.innerText = `⚠️ Parity Altered: P_in = ${simulationData.p_in} ≠ P_out = ${simulationData.p_out}`;
    }

    // Scrubber range
    const scrubber = document.getElementById('step-scrubber');
    scrubber.max = simulationData.total_primitive_steps;
    
    // Build 3D Bloch Spheres
    build3DBlochSpheres(simulationData.num_qubits, simulationData.qubit_names);

    currentStepIdx = 0;
    updateStepView();
}

// ─── Step View & Transport Controls ─────────────────────────────────────────
function setStep(idx) {
    if (!simulationData) return;
    currentStepIdx = Math.max(0, Math.min(idx, simulationData.total_primitive_steps));
    updateStepView();
}

function nextStep() {
    if (!simulationData) return;
    if (currentStepIdx < simulationData.total_primitive_steps) {
        currentStepIdx++;
        updateStepView();
    } else {
        pausePlay();
    }
}

function prevStep() {
    if (!simulationData) return;
    if (currentStepIdx > 0) {
        currentStepIdx--;
        updateStepView();
    }
}

function togglePlay() {
    if (isPlaying) {
        pausePlay();
    } else {
        startPlay();
    }
}

function startPlay() {
    isPlaying = true;
    const btn = document.getElementById('btn-play');
    btn.innerText = '⏸ Pause';
    btn.classList.add('btn-pause');

    if (currentStepIdx >= simulationData.total_primitive_steps) {
        currentStepIdx = 0;
    }

    playIntervalId = setInterval(() => {
        if (currentStepIdx < simulationData.total_primitive_steps) {
            currentStepIdx++;
            updateStepView();
        } else {
            pausePlay();
        }
    }, playbackSpeedMs);
}

function pausePlay() {
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    btn.innerText = '▶ Play';
    btn.classList.remove('btn-pause');
    if (playIntervalId) {
        clearInterval(playIntervalId);
        playIntervalId = null;
    }
}

// ─── UNIFIED SINGLE SOURCE OF TRUTH VIEW RENDERER ─────────────────────────────
function updateStepView() {
    if (!simulationData) return;
    const stepData = simulationData.steps[currentStepIdx];
    if (!stepData) return;

    // Dual-level Step Display
    const opId = stepData.logical_op_id;
    const opName = stepData.logical_op_name;
    const totalOps = simulationData.total_logical_ops;
    const totalPrimitive = simulationData.total_primitive_steps;

    document.getElementById('step-scrubber').value = currentStepIdx;
    document.getElementById('step-label').innerText = `Op ${opId} / ${totalOps} · Gate ${currentStepIdx} / ${totalPrimitive}`;

    // Active Gate Badge & Physics Explanation
    const gateBadge = document.getElementById('active-gate-badge');
    const gateObj = stepData.gate;
    const activeGateQubits = gateObj ? gateObj.qubits : [];

    if (gateObj) {
        gateBadge.innerText = `Op ${opId}: ${gateObj.name} Q[${gateObj.qubits.join(',')}]`;
        const gateKey = gateObj.name.toUpperCase();
        document.getElementById('gate-explanation-text').innerHTML = 
            (GATE_PHYSICAL_EFFECTS[gateKey] || `<b>${gateKey} Gate</b>: Applied to Qubit [${gateObj.qubits.join(',')}].`) +
            `<br/><span style="color:#38bdf8;font-size:0.68rem;">Logical Block ${opId}: ${opName}</span>`;
    } else {
        gateBadge.innerText = 'INIT';
        document.getElementById('gate-explanation-text').innerHTML = GATE_PHYSICAL_EFFECTS['INIT'];
    }

    // Render Dynamic SVG Quantum Circuit Schematic
    renderSVGCircuitSchematic();

    // Dirac |\psi\rangle Ket Formula
    document.getElementById('dirac-formula').innerText = stepData.psi_ket;

    // Measurement Probability Bars (Z, X, Y Basis)
    renderMeasurementProbabilityBars(stepData.bloch_vectors, stepData.probabilities);

    // Update 3D Bloch Target Vectors via Exact Coordinate Conversion
    stepData.bloch_vectors.forEach((bv, i) => {
        if (currentViewMode === 'focus') {
            if (i === selectedQubitIdx && targetVectors[0]) {
                targetVectors[0].copy(blochToThreeJS(bv.x, bv.y, bv.z));
            }
        } else if (targetVectors[i]) {
            targetVectors[i].copy(blochToThreeJS(bv.x, bv.y, bv.z));
        }
    });

    // Phase 31 & 32: Update Top Selected Qubit Summary & Multi-Qubit Results Strip
    updateSelectedQubitCard(stepData.bloch_vectors);
    renderAllQubitsSummaryGrid(stepData.bloch_vectors, simulationData.qubit_names, activeGateQubits);
    renderBlochReadouts(stepData.bloch_vectors, simulationData.qubit_names);
}

function updateSelectedQubitCard(blochVecs) {
    if (!simulationData) return;
    const q = selectedQubitIdx;
    const bv = blochVecs[q];
    if (!bv) return;

    const qName = simulationData.qubit_names[q] ? simulationData.qubit_names[q] : `Q${q}`;
    const titleElem = document.getElementById('sel-q-title');
    titleElem.innerText = qName;
    const hexColor = '#' + QUBIT_COLORS[q % QUBIT_COLORS.length].toString(16);
    titleElem.style.color = hexColor;

    const r = Math.sqrt(bv.x * bv.x + bv.y * bv.y + bv.z * bv.z);
    const purity = bv.purity !== undefined ? bv.purity : r * r;

    let stateType = 'Pure State';
    if (r < 0.1) stateType = 'Maximally Mixed (Entangled)';
    else if (r < 0.95) stateType = 'Partially Mixed (Entangled)';

    document.getElementById('sel-q-type').innerText = stateType;
    document.getElementById('sel-q-bloch').innerText = `X: ${bv.x > 0 ? '+' : ''}${bv.x.toFixed(3)}, Y: ${bv.y > 0 ? '+' : ''}${bv.y.toFixed(3)}, Z: ${bv.z > 0 ? '+' : ''}${bv.z.toFixed(3)}`;

    const theta = Math.acos(Math.max(-1, Math.min(1, bv.z / (r || 1)))) * 180 / Math.PI;
    const phi = Math.atan2(bv.y, bv.x) * 180 / Math.PI;

    document.getElementById('sel-q-angles').innerText = `θ: ${theta.toFixed(1)}°, φ: ${phi.toFixed(1)}°`;
    document.getElementById('sel-q-purity').innerText = `${r.toFixed(3)} (Purity: ${purity.toFixed(3)})`;
}

function renderAllQubitsSummaryGrid(blochVecs, qubitNames, activeGateQubits = []) {
    const container = document.getElementById('all-qubits-summary-container');
    if (!container) return;
    container.innerHTML = '';

    blochVecs.forEach((bv, i) => {
        const card = document.createElement('div');
        const isSel = (i === selectedQubitIdx);
        const isActiveGate = activeGateQubits.includes(i);

        card.className = `q-summary-card ${isSel ? 'selected' : ''} ${isActiveGate ? 'active-gate' : ''}`;
        card.onclick = () => selectQubit(i);

        const name = qubitNames[i] ? qubitNames[i].split(' ')[0] : `Q${i}`;
        const hexColor = '#' + QUBIT_COLORS[i % QUBIT_COLORS.length].toString(16);

        let basisState = '|0⟩';
        if (bv.z <= -0.95) basisState = '|1⟩';
        else if (Math.abs(bv.z) < 0.95) basisState = '|ψ⟩';

        const r = Math.sqrt(bv.x * bv.x + bv.y * bv.y + bv.z * bv.z);

        card.innerHTML = `
            <div class="q-card-header">
                <span style="color:${hexColor}">${name}</span>
                <span class="q-card-state">${basisState}</span>
            </div>
            <div class="q-card-z">
                Z: ${bv.z > 0 ? '+' : ''}${bv.z.toFixed(2)} |r|: ${r.toFixed(2)}
            </div>
        `;
        container.appendChild(card);
    });
}

function renderMeasurementProbabilityBars(blochVecs, computationalProbs) {
    const container = document.getElementById('prob-bars');
    container.innerHTML = '';

    if (currentMeasurementBasis === 'Z') {
        const entries = Object.entries(computationalProbs).filter(([s, p]) => p > 0.001);
        entries.forEach(([stateStr, prob]) => {
            const row = document.createElement('div');
            row.className = 'prob-row';
            const pct = (prob * 100).toFixed(1);
            row.innerHTML = `
                <span class="prob-state-lbl">|${stateStr}⟩</span>
                <div class="prob-bar-wrapper">
                    <div class="prob-bar-fill" style="width: ${pct}%"></div>
                </div>
                <span class="prob-val-text">${prob.toFixed(3)}</span>
            `;
            container.appendChild(row);
        });
    } else {
        const q = selectedQubitIdx;
        const bv = blochVecs[q];
        if (!bv) return;

        const val = (currentMeasurementBasis === 'X') ? bv.x : bv.y;
        const pPlus = (1 + val) / 2;
        const pMinus = (1 - val) / 2;

        const plusLabel = (currentMeasurementBasis === 'X') ? '|+⟩' : '|+i⟩';
        const minusLabel = (currentMeasurementBasis === 'X') ? '|-⟩' : '|-i⟩';

        [ [plusLabel, pPlus], [minusLabel, pMinus] ].forEach(([lbl, prob]) => {
            const row = document.createElement('div');
            row.className = 'prob-row';
            const pct = (prob * 100).toFixed(1);
            row.innerHTML = `
                <span class="prob-state-lbl">Q${q} ${lbl}</span>
                <div class="prob-bar-wrapper">
                    <div class="prob-bar-fill" style="width: ${pct}%"></div>
                </div>
                <span class="prob-val-text">${prob.toFixed(3)}</span>
            `;
            container.appendChild(row);
        });
    }
}

// ─── DYNAMIC SVG QUANTUM CIRCUIT SCHEMATIC ──────────────────────────────────
function renderSVGCircuitSchematic() {
    const container = document.getElementById('circuit-diagram');
    if (!simulationData || !simulationData.primitive_gates) return;

    const numQubits = simulationData.num_qubits;
    const gates = simulationData.primitive_gates;
    const logicalOps = simulationData.logical_operations || [];
    const totalSteps = simulationData.total_primitive_steps;

    const rowHeight = 28;
    const colWidth = 36;
    const startX = 85;
    const startY = 32;

    const svgWidth = startX + totalSteps * colWidth + 30;
    const svgHeight = startY + numQubits * rowHeight + 15;

    let svgHtml = `<svg class="circuit-svg" width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;

    // 0. Logical Operation Background Demarcations
    logicalOps.forEach(op => {
        const startColX = startX + (op.primitive_start - 1) * colWidth;
        const width = (op.primitive_end - op.primitive_start + 1) * colWidth;
        const opacity = (op.op_id % 2 === 1) ? '0.04' : '0.08';
        
        svgHtml += `<rect x="${startColX}" y="${startY - 22}" width="${width}" height="${numQubits * rowHeight + 26}" fill="#38bdf8" opacity="${opacity}" rx="4" />`;
        svgHtml += `<text x="${startColX + width / 2}" y="10" font-size="8.5px" font-weight="600" fill="#94a3b8" text-anchor="middle">${op.name.split(' ')[0]}</text>`;
    });

    // 1. Horizontal Qubit Wires & Labels
    for (let q = 0; q < numQubits; q++) {
        const wireY = startY + q * rowHeight + rowHeight / 2;
        const qName = simulationData.qubit_names[q] ? simulationData.qubit_names[q].split(' ')[0] : `Q${q}`;
        const bitVal = simulationData.input_bits[q];
        const isSel = (q === selectedQubitIdx);

        svgHtml += `<text x="8" y="${wireY}" class="svg-qubit-lbl ${isSel ? 'selected' : ''}" dominant-baseline="central" onclick="selectQubit(${q})">${qName}</text>`;
        svgHtml += `<text x="58" y="${wireY}" class="svg-init-state" dominant-baseline="central">|${bitVal}⟩</text>`;
        svgHtml += `<line x1="${startX - 10}" y1="${wireY}" x2="${svgWidth - 15}" y2="${wireY}" class="svg-wire ${isSel ? 'selected' : ''}" onclick="selectQubit(${q})" />`;
    }

    // 2. Active Step Glowing Cursor Bounding Box
    if (currentStepIdx > 0) {
        const activeX = startX + (currentStepIdx - 1) * colWidth;
        const activeY = startY - 4;
        const activeH = numQubits * rowHeight + 8;
        
        svgHtml += `<rect x="${activeX}" y="${activeY}" width="${colWidth}" height="${activeH}" class="svg-active-cursor-bg" />`;
        svgHtml += `<line x1="${activeX + colWidth / 2}" y1="${activeY}" x2="${activeX + colWidth / 2}" y2="${activeY + activeH}" class="svg-active-line" />`;
    }

    // 3. Gate Elements across Columns
    gates.forEach((g) => {
        const stepNum = g.step_index;
        const colX = startX + (stepNum - 1) * colWidth + colWidth / 2;
        const isSelected = (stepNum === currentStepIdx);

        svgHtml += `<text x="${colX}" y="22" class="svg-step-num ${isSelected ? 'active' : ''}" onclick="setStep(${stepNum})">${stepNum}</text>`;

        const name = g.name;
        const qubits = g.qubits;

        if (name === 'CX' && qubits.length === 2) {
            const cQubit = qubits[0];
            const tQubit = qubits[1];

            const cY = startY + cQubit * rowHeight + rowHeight / 2;
            const tY = startY + tQubit * rowHeight + rowHeight / 2;

            svgHtml += `<line x1="${colX}" y1="${cY}" x2="${colX}" y2="${tY}" class="svg-ctrl-line" onclick="setStep(${stepNum})" />`;
            svgHtml += `<circle cx="${colX}" cy="${cY}" r="4" class="svg-ctrl-dot" onclick="setStep(${stepNum})" />`;

            svgHtml += `<circle cx="${colX}" cy="${tY}" r="7" class="svg-target-circle" onclick="setStep(${stepNum})" />`;
            svgHtml += `<line x1="${colX - 4}" y1="${tY}" x2="${colX + 4}" y2="${tY}" class="svg-target-plus" />`;
            svgHtml += `<line x1="${colX}" y1="${tY - 4}" x2="${colX}" y2="${tY + 4}" class="svg-target-plus" />`;

        } else if (name === 'CSWAP' || name === 'FREDKIN') {
            const cQubit = qubits[0];
            const t1 = qubits[1];
            const t2 = qubits[2];

            const cY = startY + cQubit * rowHeight + rowHeight / 2;
            const t1Y = startY + t1 * rowHeight + rowHeight / 2;
            const t2Y = startY + t2 * rowHeight + rowHeight / 2;

            const minY = Math.min(cY, t1Y, t2Y);
            const maxY = Math.max(cY, t1Y, t2Y);

            svgHtml += `<line x1="${colX}" y1="${minY}" x2="${colX}" y2="${maxY}" class="svg-ctrl-line" onclick="setStep(${stepNum})" />`;
            svgHtml += `<circle cx="${colX}" cy="${cY}" r="4" class="svg-ctrl-dot" onclick="setStep(${stepNum})" />`;

            [t1Y, t2Y].forEach(y => {
                svgHtml += `<line x1="${colX - 4}" y1="${y - 4}" x2="${colX + 4}" y2="${y + 4}" class="svg-target-plus" />`;
                svgHtml += `<line x1="${colX - 4}" y1="${y + 4}" x2="${colX + 4}" y2="${y - 4}" class="svg-target-plus" />`;
            });

        } else {
            qubits.forEach(q => {
                const gY = startY + q * rowHeight + rowHeight / 2;
                const boxW = 22;
                const boxH = 22;

                svgHtml += `<rect x="${colX - boxW / 2}" y="${gY - boxH / 2}" width="${boxW}" height="${boxH}" class="svg-gate-box" onclick="setStep(${stepNum})" />`;
                svgHtml += `<text x="${colX}" y="${gY}" class="svg-gate-text">${name}</text>`;
            });
        }
    });

    svgHtml += `</svg>`;
    container.innerHTML = svgHtml;

    // Auto-scroll viewport smoothly
    const viewport = document.querySelector('.circuit-viewport');
    if (viewport && currentStepIdx > 0) {
        const activeX = startX + (currentStepIdx - 1) * colWidth;
        const targetScrollLeft = activeX - viewport.clientWidth / 2 + colWidth / 2;
        viewport.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
        });
    }
}

function renderBlochReadouts(blochVecs, qubitNames) {
    const container = document.getElementById('bloch-readout-grid');
    if (!container) return;
    container.innerHTML = '';

    blochVecs.forEach((bv, i) => {
        const item = document.createElement('div');
        const isSel = (i === selectedQubitIdx);
        item.className = `bloch-val-item ${isSel ? 'selected' : ''}`;
        item.onclick = () => selectQubit(i);
        
        const name = qubitNames[i] ? qubitNames[i].split(' ')[0] : `Q${i}`;
        const colorHex = '#' + QUBIT_COLORS[i % QUBIT_COLORS.length].toString(16);
        item.innerHTML = `<b style="color:${colorHex}">${name}</b>: <span>(${bv.x > 0 ? '+' : ''}${bv.x.toFixed(2)}, ${bv.y > 0 ? '+' : ''}${bv.y.toFixed(2)}, ${bv.z > 0 ? '+' : ''}${bv.z.toFixed(2)})</span>`;
        container.appendChild(item);
    });
}
