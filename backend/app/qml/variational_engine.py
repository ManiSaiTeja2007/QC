"""PennyLane Variational Quantum Algorithm & Quantum Machine Learning (QML) Engine.

Provides:
1. Variational Quantum State Optimization: Trains parameterized quantum gates to match any target statevector / Bloch coordinate via automatic differentiation (parameter-shift rule / backprop).
2. Variational Quantum Classifier (VQC): Parameterized Quantum Neural Network for binary and multi-class quantum machine learning tasks.
"""

import math
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import pennylane as qml
from pennylane import numpy as pnp

from backend.app.schemas.qml import (
    StateOptimizationRequest,
    StateOptimizationResponse,
    OptimizationStepRecord,
    VQCTrainRequest,
    VQCTrainResponse,
)


def get_pennylane_info() -> Dict[str, Any]:
    """Returns runtime info about PennyLane and available quantum devices."""
    devices = ["default.qubit", "default.mixed"]
    try:
        import pennylane_lightning
        devices.append("lightning.qubit")
    except ImportError:
        pass

    try:
        import pennylane_qiskit
        devices.append("qiskit.aer")
        devices.append("qiskit.basicaer")
    except ImportError:
        pass

    return {
        "pennylane_version": qml.__version__,
        "devices": devices,
        "optimizers": ["adam", "gd", "adagrad", "nesterov_momentum"],
        "ansatzes": [
            {"id": "rot_single", "name": "Euler Rotation Rot(φ,θ,ω)", "wires": 1, "params": 3},
            {"id": "entangled_2q", "name": "Entangled 2-Qubit Bell Variational", "wires": 2, "params": 6},
            {"id": "strongly_entangling", "name": "Strongly Entangling Layers", "wires": 2, "params": 6},
        ],
        "qml_tasks": [
            {"id": "state_fitting", "name": "Variational State Fitting (VQE-style)"},
            {"id": "vqc_classifier", "name": "Variational Quantum Classifier (QNN)"},
        ],
    }


def _resolve_target_state(target_label: str, custom_angles: Optional[List[float]]) -> Tuple[np.ndarray, Dict[str, float], int]:
    """Resolves target statevector, target Bloch coordinates, and wire count."""
    inv_sqrt2 = 1.0 / math.sqrt(2)

    if target_label == "0":
        psi = np.array([1.0, 0.0], dtype=complex)
        bloch = {"x": 0.0, "y": 0.0, "z": 1.0}
        return psi, bloch, 1
    elif target_label == "1":
        psi = np.array([0.0, 1.0], dtype=complex)
        bloch = {"x": 0.0, "y": 0.0, "z": -1.0}
        return psi, bloch, 1
    elif target_label == "+":
        psi = np.array([inv_sqrt2, inv_sqrt2], dtype=complex)
        bloch = {"x": 1.0, "y": 0.0, "z": 0.0}
        return psi, bloch, 1
    elif target_label == "-":
        psi = np.array([inv_sqrt2, -inv_sqrt2], dtype=complex)
        bloch = {"x": -1.0, "y": 0.0, "z": 0.0}
        return psi, bloch, 1
    elif target_label == "+i":
        psi = np.array([inv_sqrt2, 1j * inv_sqrt2], dtype=complex)
        bloch = {"x": 0.0, "y": 1.0, "z": 0.0}
        return psi, bloch, 1
    elif target_label == "-i":
        psi = np.array([inv_sqrt2, -1j * inv_sqrt2], dtype=complex)
        bloch = {"x": 0.0, "y": -1.0, "z": 0.0}
        return psi, bloch, 1
    elif target_label == "bell_phi_plus":
        # (|00> + |11>) / sqrt(2)
        psi = np.array([inv_sqrt2, 0.0, 0.0, inv_sqrt2], dtype=complex)
        bloch = {"x": 0.0, "y": 0.0, "z": 0.0}  # Maximally mixed marginals
        return psi, bloch, 2
    elif target_label == "custom" and custom_angles and len(custom_angles) >= 2:
        th, ph = float(custom_angles[0]), float(custom_angles[1])
        c = math.cos(th / 2.0)
        s = math.sin(th / 2.0)
        psi = np.array([c, np.exp(1j * ph) * s], dtype=complex)
        bloch = {
            "x": math.sin(th) * math.cos(ph),
            "y": math.sin(th) * math.sin(ph),
            "z": math.cos(th),
        }
        return psi, bloch, 1
    else:
        # Default to |+>
        psi = np.array([inv_sqrt2, inv_sqrt2], dtype=complex)
        bloch = {"x": 1.0, "y": 0.0, "z": 0.0}
        return psi, bloch, 1


def _compute_bloch_from_statevector(sv: np.ndarray, num_qubits: int) -> List[Dict[str, float]]:
    """Calculates Bloch 3D vector (x, y, z, purity) for each single qubit wire via partial trace."""
    vectors = []
    dim = 2 ** num_qubits
    psi = sv.reshape(dim, 1)
    rho = psi @ psi.conj().T

    pauli_x = np.array([[0, 1], [1, 0]], dtype=complex)
    pauli_y = np.array([[0, -1j], [1j, 0]], dtype=complex)
    pauli_z = np.array([[1, 0], [0, -1]], dtype=complex)

    for q in range(num_qubits):
        # Compute partial trace for qubit q
        rho_tensor = rho.reshape([2] * (2 * num_qubits))
        other_qubits = [i for i in range(num_qubits) if i != q]

        if not other_qubits:
            rho_q = rho
        else:
            # Trace out all other qubits
            axes1 = other_qubits
            axes2 = [i + num_qubits for i in other_qubits]
            rho_q = np.trace(rho_tensor, axis1=axes1[0], axis2=axes2[0])
            for i in range(1, len(other_qubits)):
                rho_q = np.trace(rho_q, axis1=axes1[i] - 2 * i, axis2=axes2[i] - 2 * i)

        rx = float(np.real(np.trace(rho_q @ pauli_x)))
        ry = float(np.real(np.trace(rho_q @ pauli_y)))
        rz = float(np.real(np.trace(rho_q @ pauli_z)))
        r = math.sqrt(rx * rx + ry * ry + rz * rz)
        purity = float(np.real(np.trace(rho_q @ rho_q)))

        vectors.append({
            "x": round(rx, 4),
            "y": round(ry, 4),
            "z": round(rz, 4),
            "r": round(r, 4),
            "purity": round(purity, 4),
        })

    return vectors


def optimize_quantum_state(req: StateOptimizationRequest) -> StateOptimizationResponse:
    """Executes step-by-step variational quantum state optimization using PennyLane."""
    target_psi, target_bloch, target_wires = _resolve_target_state(req.target_state, req.custom_angles)
    num_wires = max(target_wires, 2 if req.ansatz_type in ["entangled_2q", "strongly_entangling"] else 1)

    dev = qml.device("default.qubit", wires=num_wires)

    # Define the parameterized quantum ansatz
    if num_wires == 1:
        @qml.qnode(dev)
        def circuit(params):
            qml.Rot(params[0], params[1], params[2], wires=0)
            return qml.state()

        init_params = pnp.array(req.initial_params if req.initial_params and len(req.initial_params) == 3
                                else [0.05, 0.05, 0.05], requires_grad=True)
        circuit_desc = "Single-Qubit Euler Rotation: |0⟩ → Rot(φ, θ, ω) → |ψ(θ)⟩"
    else:
        @qml.qnode(dev)
        def circuit(params):
            qml.Rot(params[0], params[1], params[2], wires=0)
            qml.Rot(params[3], params[4], params[5], wires=1)
            qml.CNOT(wires=[0, 1])
            return qml.state()

        init_params = pnp.array(req.initial_params if req.initial_params and len(req.initial_params) == 6
                                else [0.1, 0.1, 0.1, 0.1, 0.1, 0.1], requires_grad=True)
        circuit_desc = "2-Qubit Entangled Variational Ansatz: Rot(Q0) ⊗ Rot(Q1) → CNOT(0,1) → |ψ(θ)⟩"

    # Loss function: Quantum state infidelity L = 1 - |<psi_target | psi(params)>|^2
    # Ensure target_psi matches state dimension
    if len(target_psi) < 2 ** num_wires:
        full_target = np.zeros(2 ** num_wires, dtype=complex)
        full_target[:len(target_psi)] = target_psi
    else:
        full_target = target_psi[:2 ** num_wires]

    def cost_fn(params):
        state = circuit(params)
        fidelity = qml.math.abs(qml.math.dot(qml.math.conj(full_target), state)) ** 2
        return 1.0 - fidelity

    # Optimizer selection
    opt_name = req.optimizer_name.lower()
    lr = float(req.learning_rate)
    if "adam" in opt_name:
        opt = qml.AdamOptimizer(stepsize=lr)
    else:
        opt = qml.GradientDescentOptimizer(stepsize=lr)

    params = init_params
    history: List[OptimizationStepRecord] = []

    for step_idx in range(req.num_steps + 1):
        # Current state and metrics
        curr_state = np.array(circuit(params))
        inner_prod = np.abs(np.vdot(full_target, curr_state))
        fidelity = float(inner_prod ** 2)
        loss = float(max(0.0, 1.0 - fidelity))

        # Gradient calculation for gradient norm tracking
        grad = qml.grad(cost_fn)(params)
        grad_norm = float(np.linalg.norm(grad))

        # Format statevector output
        sv_dict = [{"real": round(float(c.real), 4), "imag": round(float(c.imag), 4)} for c in curr_state]

        # Probabilities
        probs = {
            format(i, f"0{num_wires}b"): round(float(abs(c) ** 2), 4)
            for i, c in enumerate(curr_state)
        }

        # Bloch coordinates for wires
        bloch_vecs = _compute_bloch_from_statevector(curr_state, num_wires)

        record = OptimizationStepRecord(
            step=step_idx,
            loss=round(loss, 6),
            fidelity=round(fidelity, 6),
            parameters=[round(float(p), 4) for p in params],
            gradient_norm=round(grad_norm, 5),
            statevector=sv_dict,
            bloch_vectors=bloch_vecs,
            probabilities=probs,
        )
        history.append(record)

        # Stop early if converged
        if loss < 1e-4 and step_idx >= 5:
            break

        # Optimize one step
        if step_idx < req.num_steps:
            params = opt.step(cost_fn, params)

    final_record = history[-1]
    return StateOptimizationResponse(
        target_state=req.target_state,
        ansatz_type=req.ansatz_type,
        optimizer=opt_name.upper(),
        final_loss=final_record.loss,
        final_fidelity=final_record.fidelity,
        total_steps=len(history) - 1,
        converged=final_record.fidelity >= 0.98,
        steps=history,
        circuit_description=circuit_desc,
        target_bloch=target_bloch,
    )


def train_variational_classifier(req: VQCTrainRequest) -> VQCTrainResponse:
    """Trains a 2-qubit Variational Quantum Classifier (QNN) with PennyLane."""
    num_wires = 2
    dev = qml.device("default.qubit", wires=num_wires)

    # 1. Generate Synthetic Classification Dataset
    np.random.seed(42)
    n_samples = 40
    if req.dataset == "circle":
        # Points inside radius 0.6 vs outside
        X = np.random.uniform(-1.0, 1.0, (n_samples, 2))
        radii = np.linalg.norm(X, axis=1)
        Y = np.where(radii < 0.65, 1.0, -1.0)
    elif req.dataset == "half_sphere":
        # Sign of X0
        X = np.random.uniform(-math.pi, math.pi, (n_samples, 2))
        Y = np.where(X[:, 0] > 0, 1.0, -1.0)
    else:
        # Quantum Parity (XOR quadrants)
        X = np.random.uniform(-1.0, 1.0, (n_samples, 2))
        Y = np.where(X[:, 0] * X[:, 1] >= 0, 1.0, -1.0)

    # 2. Parameterized Quantum Circuit (Angle Embedding + Strongly Entangling Layers)
    n_layers = req.n_layers
    shape = qml.StronglyEntanglingLayers.shape(n_layers=n_layers, n_wires=num_wires)
    weights = pnp.random.uniform(0, 2 * math.pi, shape, requires_grad=True)

    @qml.qnode(dev)
    def qnn_circuit(w, x):
        # Encode classical features into quantum phase angles
        qml.AngleEmbedding(x, wires=[0, 1])
        # Variational ansatz
        qml.StronglyEntanglingLayers(w, wires=[0, 1])
        # Measure expectation value of Pauli-Z on qubit 0 as model prediction
        return qml.expval(qml.PauliZ(0))

    def cost(w, x_batch, y_batch):
        preds = pnp.stack([qnn_circuit(w, x) for x in x_batch])
        return pnp.mean((preds - y_batch) ** 2)

    opt = qml.AdamOptimizer(stepsize=float(req.learning_rate))

    epoch_history = []
    for epoch in range(req.epochs):
        # Mini-batch optimization
        weights = opt.step(lambda w: cost(w, X, Y), weights)

        # Compute epoch loss and classification accuracy
        preds = pnp.array([qnn_circuit(weights, x) for x in X])
        epoch_loss = float(pnp.mean((preds - Y) ** 2))
        accuracy = float(pnp.mean(pnp.sign(preds) == Y))

        epoch_history.append({
            "epoch": epoch + 1,
            "loss": round(epoch_loss, 4),
            "accuracy": round(accuracy, 4),
        })

    final_loss = epoch_history[-1]["loss"]
    final_acc = epoch_history[-1]["accuracy"]

    return VQCTrainResponse(
        dataset=req.dataset,
        n_qubits=num_wires,
        n_layers=n_layers,
        epochs=req.epochs,
        final_loss=final_loss,
        final_accuracy=final_acc,
        epoch_history=epoch_history,
        learned_weights_summary=[round(float(w), 4) for w in weights.flatten()[:12]],
        circuit_spec="AngleEmbedding([x0, x1], wires=[0,1]) → StronglyEntanglingLayers(weights) → ⟨Z₀⟩",
    )
