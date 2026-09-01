/**
 * Pure Quantum Physics & SO(3) Bloch Rotation Mathematics Engine.
 * 
 * Computes exact physical trajectories r(t), spherical angles theta(t), phi(t),
 * and complex statevector amplitudes alpha(t), beta(t) for any single-qubit gate evolution.
 */

export interface BlochVector3D {
  x: number;
  y: number;
  z: number;
}

export interface LiveStateReadout {
  t: number;
  bloch: BlochVector3D;
  magnitude: number;
  thetaRad: number;
  thetaDeg: number;
  phiRad: number;
  phiDeg: number;
  isPhiUndefined: boolean;
  phiDisplay: string;
  alphaReal: number;
  alphaImag: number;
  betaReal: number;
  betaImag: number;
  psiKet: string;
}

/**
 * Computes physical SO(3) rotation trajectory r(t) at time t in [0, 1].
 */
export function computeBlochTrajectoryAtTime(
  gateName: string,
  r0: BlochVector3D,
  r1: BlochVector3D,
  t: number,
  params?: number[]
): BlochVector3D {
  const g = gateName.toUpperCase();
  const thetaParam = params && params.length > 0 ? params[0] : Math.PI / 2;

  // Ensure t is bounded in [0, 1]
  const clampT = Math.max(0, Math.min(1, t));

  // 1. Z-Axis Rotations: Z, S, SDG, T, TDG, P, RZ
  if (['Z', 'S', 'SDG', 'T', 'TDG', 'P', 'RZ'].includes(g)) {
    let rotAngle = Math.PI; // Default Z
    if (g === 'S') rotAngle = Math.PI / 2;
    else if (g === 'SDG') rotAngle = -Math.PI / 2;
    else if (g === 'T') rotAngle = Math.PI / 4;
    else if (g === 'TDG') rotAngle = -Math.PI / 4;
    else if (g === 'P' || g === 'RZ') rotAngle = thetaParam;

    const angleT = clampT * rotAngle;
    const cosA = Math.cos(angleT);
    const sinA = Math.sin(angleT);

    const x = r0.x * cosA - r0.y * sinA;
    const y = r0.x * sinA + r0.y * cosA;
    const z = r0.z;
    return { x, y, z };
  }

  // 2. X-Axis Rotations: X, RX
  if (['X', 'RX'].includes(g)) {
    const rotAngle = g === 'X' ? Math.PI : thetaParam;
    const angleT = clampT * rotAngle;
    const cosA = Math.cos(angleT);
    const sinA = Math.sin(angleT);

    const x = r0.x;
    const y = r0.y * cosA - r0.z * sinA;
    const z = r0.y * sinA + r0.z * cosA;
    return { x, y, z };
  }

  // 3. Y-Axis Rotations: Y, RY
  if (['Y', 'RY'].includes(g)) {
    const rotAngle = g === 'Y' ? Math.PI : thetaParam;
    const angleT = clampT * rotAngle;
    const cosA = Math.cos(angleT);
    const sinA = Math.sin(angleT);

    const x = r0.x * cosA + r0.z * sinA;
    const y = r0.y;
    const z = -r0.x * sinA + r0.z * cosA;
    return { x, y, z };
  }

  // 4. Hadamard Gate (H): 180° rotation around (X+Z)/√2 axis
  if (g === 'H') {
    const rotAngle = Math.PI;
    const angleT = clampT * rotAngle;
    const u = 1 / Math.SQRT2;
    const v = 0.0;
    const w = 1 / Math.SQRT2;

    const cosA = Math.cos(angleT);
    const sinA = Math.sin(angleT);

    // Rodrigues' rotation formula: r' = r cosA + (k x r) sinA + k (k . r) (1 - cosA)
    const kx = u, ky = v, kz = w;
    const rx = r0.x, ry = r0.y, rz = r0.z;

    const crossX = ky * rz - kz * ry;
    const crossY = kz * rx - kx * rz;
    const crossZ = kx * ry - ky * rx;

    const dot = kx * rx + ky * ry + kz * rz;

    const x = rx * cosA + crossX * sinA + kx * dot * (1 - cosA);
    const y = ry * cosA + crossY * sinA + ky * dot * (1 - cosA);
    const z = rz * cosA + crossZ * sinA + kz * dot * (1 - cosA);

    return { x, y, z };
  }

  // Fallback: Great Circle Geodesic SLERP between r0 and r1
  return slerpBlochVector(r0, r1, clampT);
}

/**
 * Spherical Linear Interpolation (SLERP) between two unit 3D vectors.
 */
export function slerpBlochVector(v0: BlochVector3D, v1: BlochVector3D, t: number): BlochVector3D {
  let dot = v0.x * v1.x + v0.y * v1.y + v0.z * v1.z;
  dot = Math.max(-1.0, Math.min(1.0, isNaN(dot) ? 1.0 : dot));

  if (dot > 0.9995) {
    // Vectors are almost identical, linear interpolation + normalize
    const x = v0.x + t * (v1.x - v0.x);
    const y = v0.y + t * (v1.y - v0.y);
    const z = v0.z + t * (v1.z - v0.z);
    const len = Math.sqrt(x * x + y * y + z * z) || 1.0;
    return { x: x / len, y: y / len, z: z / len };
  }

  if (dot < -0.9995) {
    // Opposite (antipodal) vectors (|0⟩ to |1⟩) — rotate around orthogonal axis (e.g. X or Y)
    const ortho = Math.abs(v0.x) < 0.7 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const ax = v0.y * ortho.z - v0.z * ortho.y;
    const ay = v0.z * ortho.x - v0.x * ortho.z;
    const az = v0.x * ortho.y - v0.y * ortho.x;
    const aLen = Math.sqrt(ax * ax + ay * ay + az * az) || 1.0;
    const kx = ax / aLen, ky = ay / aLen, kz = az / aLen;

    const ang = t * Math.PI;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const crX = ky * v0.z - kz * v0.y;
    const crY = kz * v0.x - kx * v0.z;
    const crZ = kx * v0.y - ky * v0.x;
    const dt = kx * v0.x + ky * v0.y + kz * v0.z;

    const x = v0.x * cosA + crX * sinA + kx * dt * (1 - cosA);
    const y = v0.y * cosA + crY * sinA + ky * dt * (1 - cosA);
    const z = v0.z * cosA + crZ * sinA + kz * dt * (1 - cosA);
    const len = Math.sqrt(x * x + y * y + z * z) || 1.0;
    return { x: x / len, y: y / len, z: z / len };
  }

  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  if (Math.abs(sinOmega) < 1e-6) {
    return v0;
  }

  const scale0 = Math.sin((1 - t) * omega) / sinOmega;
  const scale1 = Math.sin(t * omega) / sinOmega;

  const x = scale0 * v0.x + scale1 * v1.x;
  const y = scale0 * v0.y + scale1 * v1.y;
  const z = scale0 * v0.z + scale1 * v1.z;

  const len = Math.sqrt(x * x + y * y + z * z) || 1.0;
  return { x: x / len, y: y / len, z: z / len };
}

/**
 * Computes complete live state readout from a 3D Bloch vector r(t) at time t.
 * Enforces Phase 131 contract: theta=0 or pi implies phi is undefined at poles!
 */
export function computeLiveStateReadout(bloch: BlochVector3D, t: number): LiveStateReadout {
  const x = isNaN(bloch.x) ? 0.0 : bloch.x;
  const y = isNaN(bloch.y) ? 0.0 : bloch.y;
  const z = isNaN(bloch.z) ? 1.0 : bloch.z;
  const magnitude = Math.sqrt(x * x + y * y + z * z);

  // Polar angle theta in [0, pi]
  const clampZ = Math.max(-1.0, Math.min(1.0, z));
  const thetaRad = Math.acos(clampZ);
  const thetaDeg = thetaRad * (180 / Math.PI);

  // Azimuthal angle phi in [0, 2pi]
  // Phase 131: At poles (theta=0 or theta=pi), X=0, Y=0, phi is physically undefined!
  const isPhiUndefined = Math.abs(Math.sin(thetaRad)) < 0.001;
  let phiRad = 0.0;
  let phiDeg = 0.0;
  let phiDisplay = '— (at pole)';

  if (!isPhiUndefined) {
    phiRad = Math.atan2(y, x);
    if (phiRad < 0) phiRad += 2 * Math.PI;
    phiDeg = phiRad * (180 / Math.PI);
    phiDisplay = `${phiDeg.toFixed(1)}°`;
  }

  // Quantum Amplitudes: alpha = cos(theta/2), beta = exp(i phi) sin(theta/2)
  const alphaReal = Math.cos(thetaRad / 2);
  const alphaImag = 0.0;

  const betaMag = Math.sin(thetaRad / 2);
  const betaReal = isPhiUndefined ? 0.0 : betaMag * Math.cos(phiRad);
  const betaImag = isPhiUndefined ? 0.0 : betaMag * Math.sin(phiRad);

  // Format Dirac Ket string
  let psiKet = '';
  if (Math.abs(alphaReal) > 0.01) {
    psiKet += `${alphaReal.toFixed(3)}|0⟩`;
  }
  if (Math.abs(betaMag) > 0.01) {
    if (isPhiUndefined) {
      psiKet += ` + ${betaMag.toFixed(3)}|1⟩`;
    } else {
      const sign = betaReal >= 0 ? ' + ' : ' - ';
      const absR = Math.abs(betaReal).toFixed(3);
      const absI = Math.abs(betaImag).toFixed(3);
      if (Math.abs(betaImag) < 0.01) {
        psiKet += `${sign}${absR}|1⟩`;
      } else if (Math.abs(betaReal) < 0.01) {
        psiKet += `${betaImag >= 0 ? ' + ' : ' - '}${absI}i|1⟩`;
      } else {
        psiKet += `${sign}(${absR} + ${absI}i)|1⟩`;
      }
    }
  }
  if (!psiKet) psiKet = '|0⟩';

  return {
    t,
    bloch,
    magnitude,
    thetaRad,
    thetaDeg,
    phiRad,
    phiDeg,
    isPhiUndefined,
    phiDisplay,
    alphaReal,
    alphaImag,
    betaReal,
    betaImag,
    psiKet,
  };
}
