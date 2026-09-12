"""Pydantic schemas for PennyLane Quantum Machine Learning (QML) & Variational Quantum Algorithms."""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class StateOptimizationRequest(BaseModel):
    """Request payload for variational quantum state fitting via PennyLane autograd."""
    target_state: str = Field(
        default="+",
        description="Target quantum state label: '+', '-', '+i', '-i', '0', '1', 'bell_phi_plus', or 'custom'"
    )
    custom_angles: Optional[List[float]] = Field(
        default=None,
        description="Optional [theta, phi] in radians for custom spherical target state"
    )
    ansatz_type: str = Field(
        default="rot_single",
        description="Ansatz architecture: 'rot_single' (1Q Rot(phi,theta,omega)), 'entangled_2q', or 'strongly_entangling'"
    )
    optimizer_name: str = Field(
        default="adam",
        description="Optimizer: 'adam' or 'gd' (GradientDescentOptimizer)"
    )
    learning_rate: float = Field(
        default=0.12,
        ge=0.001,
        le=1.0,
        description="Learning rate step size"
    )
    num_steps: int = Field(
        default=30,
        ge=5,
        le=100,
        description="Number of optimization epochs/steps"
    )
    initial_params: Optional[List[float]] = Field(
        default=None,
        description="Optional initial parameter values (defaults to randomized or near-zero)"
    )


class OptimizationStepRecord(BaseModel):
    """Record of state, loss, parameters, and Bloch coordinates at a single optimization step."""
    step: int
    loss: float
    fidelity: float
    parameters: List[float]
    gradient_norm: float
    statevector: List[Dict[str, float]]
    bloch_vectors: List[Dict[str, float]]
    probabilities: Dict[str, float]


class StateOptimizationResponse(BaseModel):
    """Result of variational quantum state optimization."""
    target_state: str
    ansatz_type: str
    optimizer: str
    final_loss: float
    final_fidelity: float
    total_steps: int
    converged: bool
    steps: List[OptimizationStepRecord]
    circuit_description: str
    target_bloch: Dict[str, float]


class VQCTrainRequest(BaseModel):
    """Request for training a Variational Quantum Classifier / QNN."""
    dataset: str = Field(default="parity", description="'parity', 'circle', or 'half_sphere'")
    n_layers: int = Field(default=2, ge=1, le=4)
    learning_rate: float = Field(default=0.15, ge=0.01, le=1.0)
    epochs: int = Field(default=25, ge=5, le=60)


class VQCTrainResponse(BaseModel):
    """Results from training a Variational Quantum Classifier."""
    dataset: str
    n_qubits: int
    n_layers: int
    epochs: int
    final_loss: float
    final_accuracy: float
    epoch_history: List[Dict[str, Any]]
    learned_weights_summary: List[float]
    circuit_spec: str
