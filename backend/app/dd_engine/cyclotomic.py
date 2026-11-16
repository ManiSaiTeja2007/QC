"""Exact Algebraic Cyclotomic Ring Arithmetic for Clifford+T Circuits.

Implements exact arithmetic in the cyclotomic ring:
    D[ω] = Z[ω, 1/√2]  where  ω = e^(iπ/4)

Properties:
  - Minimal polynomial: ω^4 + 1 = 0  (i.e. ω^4 = -1, ω^2 = i, ω^6 = -i)
  - √2 = ω - ω^3
  - (√2)^2 = 2
  - Every element is canonically represented as:
        α = (a + b·ω + c·ω^2 + d·ω^3) / (√2)^k
    with a, b, c, d, k integers, k >= 0 minimal.

Eliminates all floating-point roundoff errors across arbitrary-depth
Clifford+T circuits, guaranteeing exact canonical edge weights and
hash-consed node uniqueness in Quantum Decision Diagrams (QMDD).
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple
import numpy as np


def _mul_sqrt2_poly(a: int, b: int, c: int, d: int) -> Tuple[int, int, int, int]:
    """Multiplies (a + b*ω + c*ω^2 + d*ω^3) by √2 = (ω - ω^3)."""
    return (b - d, a + c, b + d, c - a)


def _reduce_cyclotomic(a: int, b: int, c: int, d: int, k: int) -> Tuple[int, int, int, int, int]:
    """Reduces the representation to canonical form with minimal non-negative k."""
    if a == 0 and b == 0 and c == 0 and d == 0:
        return (0, 0, 0, 0, 0)

    # While k < 0, multiply numerator by √2 to make k >= 0
    while k < 0:
        a, b, c, d = _mul_sqrt2_poly(a, b, c, d)
        k += 1

    # While k > 0 and divisible by √2, reduce k
    while k > 0 and (a % 2 == c % 2) and (b % 2 == d % 2):
        a, b, c, d = (b - d) // 2, (a + c) // 2, (b + d) // 2, (c - a) // 2
        k -= 1

    if a == 0 and b == 0 and c == 0 and d == 0:
        return (0, 0, 0, 0, 0)

    return (a, b, c, d, k)


@dataclass(frozen=True, slots=True)
class CyclotomicComplex:
    """Exact element of the cyclotomic ring D[ω] = Z[ω, 1/√2].

    α = (a + b*ω + c*ω^2 + d*ω^3) / (√2)^k
    """
    a: int = 0
    b: int = 0
    c: int = 0
    d: int = 0
    k: int = 0

    def __post_init__(self) -> None:
        ca, cb, cc, cd, ck = _reduce_cyclotomic(self.a, self.b, self.c, self.d, self.k)
        if (ca, cb, cc, cd, ck) != (self.a, self.b, self.c, self.d, self.k):
            object.__setattr__(self, "a", ca)
            object.__setattr__(self, "b", cb)
            object.__setattr__(self, "c", cc)
            object.__setattr__(self, "d", cd)
            object.__setattr__(self, "k", ck)

    @classmethod
    def from_int(cls, val: int) -> CyclotomicComplex:
        return cls(a=val, b=0, c=0, d=0, k=0)

    @classmethod
    def from_rational_sqrt2(cls, val: int, k: int) -> CyclotomicComplex:
        return cls(a=val, b=0, c=0, d=0, k=k)

    def is_zero(self) -> bool:
        return self.a == 0 and self.b == 0 and self.c == 0 and self.d == 0

    def is_one(self) -> bool:
        return self.a == 1 and self.b == 0 and self.c == 0 and self.d == 0 and self.k == 0

    def __neg__(self) -> CyclotomicComplex:
        return CyclotomicComplex(-self.a, -self.b, -self.c, -self.d, self.k)

    def __add__(self, other: CyclotomicComplex) -> CyclotomicComplex:
        if self.is_zero():
            return other
        if other.is_zero():
            return self

        a1, b1, c1, d1, k1 = self.a, self.b, self.c, self.d, self.k
        a2, b2, c2, d2, k2 = other.a, other.b, other.c, other.d, other.k

        if k1 < k2:
            diff = k2 - k1
            for _ in range(diff):
                a1, b1, c1, d1 = _mul_sqrt2_poly(a1, b1, c1, d1)
            target_k = k2
        elif k2 < k1:
            diff = k1 - k2
            for _ in range(diff):
                a2, b2, c2, d2 = _mul_sqrt2_poly(a2, b2, c2, d2)
            target_k = k1
        else:
            target_k = k1

        return CyclotomicComplex(
            a=a1 + a2,
            b=b1 + b2,
            c=c1 + c2,
            d=d1 + d2,
            k=target_k,
        )

    def __sub__(self, other: CyclotomicComplex) -> CyclotomicComplex:
        return self + (-other)

    def __mul__(self, other: CyclotomicComplex) -> CyclotomicComplex:
        if self.is_zero() or other.is_zero():
            return CyclotomicComplex.ZERO
        if self.is_one():
            return other
        if other.is_one():
            return self

        a1, b1, c1, d1 = self.a, self.b, self.c, self.d
        a2, b2, c2, d2 = other.a, other.b, other.c, other.d

        # Polynomial convolution modulo ω^4 + 1
        ra = a1 * a2 - b1 * d2 - c1 * c2 - d1 * b2
        rb = a1 * b2 + b1 * a2 - c1 * d2 - d1 * c2
        rc = a1 * c2 + b1 * b2 + c1 * a2 - d1 * d2
        rd = a1 * d2 + b1 * c2 + c1 * b2 + d1 * a2
        rk = self.k + other.k

        return CyclotomicComplex(ra, rb, rc, rd, rk)

    def conj(self) -> CyclotomicComplex:
        """Complex conjugate: ω -> ω^7 = -ω^3, ω^2 -> -ω^2, ω^3 -> -ω."""
        return CyclotomicComplex(self.a, -self.d, -self.c, -self.b, self.k)

    def abs_sq(self) -> float:
        """Returns |α|^2 as a float."""
        prod = self * self.conj()
        # Since prod is strictly real, b == 0, c == 0, d == 0
        val = float(prod.a)
        if prod.k > 0:
            val /= 2.0 ** (prod.k / 2.0)
        return val

    def to_complex(self) -> complex:
        """Converts to standard Python complex number without trigonometric drift."""
        if self.is_zero():
            return 0.0 + 0.0j

        # Exact decomposition:
        # a is real, c*ω^2 = c*i is purely imaginary.
        # b*ω = b*(1 + i)/√2
        # d*ω^3 = d*(-1 + i)/√2
        # Real numerator = a + (b - d)/√2
        # Imag numerator = c + (b + d)/√2
        sqrt2 = np.sqrt(2.0)
        real_num = float(self.a)
        imag_num = float(self.c)

        if self.b != 0 or self.d != 0:
            real_num += float(self.b - self.d) / sqrt2
            imag_num += float(self.b + self.d) / sqrt2

        denom = sqrt2 ** self.k if self.k > 0 else 1.0
        return complex(real_num / denom, imag_num / denom)

    def __str__(self) -> str:
        parts = []
        if self.a != 0:
            parts.append(str(self.a))
        if self.b != 0:
            parts.append(f"{self.b}ω" if self.b != 1 else "ω")
        if self.c != 0:
            parts.append(f"{self.c}i" if self.c != 1 else "i")
        if self.d != 0:
            parts.append(f"{self.d}ω^3" if self.d != 1 else "ω^3")
        if not parts:
            return "0"
        s = " + ".join(parts).replace("+ -", "- ")
        if self.k > 0:
            return f"({s})/(√2)^{self.k}"
        return s


# Standard algebraic constants for quantum Clifford+T gates
CyclotomicComplex.ZERO = CyclotomicComplex(0, 0, 0, 0, 0)
CyclotomicComplex.ONE = CyclotomicComplex(1, 0, 0, 0, 0)
CyclotomicComplex.NEG_ONE = CyclotomicComplex(-1, 0, 0, 0, 0)
CyclotomicComplex.I = CyclotomicComplex(0, 0, 1, 0, 0)
CyclotomicComplex.NEG_I = CyclotomicComplex(0, 0, -1, 0, 0)
CyclotomicComplex.OMEGA = CyclotomicComplex(0, 1, 0, 0, 0)          # T gate phase = e^(iπ/4)
CyclotomicComplex.OMEGA_DAG = CyclotomicComplex(0, 0, 0, -1, 0)     # T† phase = e^(-iπ/4) = -ω^3
CyclotomicComplex.INV_SQRT2 = CyclotomicComplex(1, 0, 0, 0, 1)      # 1/√2
CyclotomicComplex.SQRT2 = CyclotomicComplex(0, 1, 0, -1, 0)         # √2 = ω - ω^3
