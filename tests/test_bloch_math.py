import unittest
import math

def compute_bloch_rotation_z(x0, y0, z0, angle, t):
    """SO(3) Z-axis rotation trajectory: r'(t) = Rz(t * angle) r0."""
    angle_t = t * angle
    cos_a = math.cos(angle_t)
    sin_a = math.sin(angle_t)
    x = x0 * cos_a - y0 * sin_a
    y = x0 * sin_a + y0 * cos_a
    z = z0
    return x, y, z

def compute_bloch_rotation_x(x0, y0, z0, angle, t):
    """SO(3) X-axis rotation trajectory: r'(t) = Rx(t * angle) r0."""
    angle_t = t * angle
    cos_a = math.cos(angle_t)
    sin_a = math.sin(angle_t)
    x = x0
    y = y0 * cos_a - z0 * sin_a
    z = y0 * sin_a + z0 * cos_a
    return x, y, z

def compute_bloch_rotation_y(x0, y0, z0, angle, t):
    """SO(3) Y-axis rotation trajectory: r'(t) = Ry(t * angle) r0."""
    angle_t = t * angle
    cos_a = math.cos(angle_t)
    sin_a = math.sin(angle_t)
    x = x0 * cos_a + z0 * sin_a
    y = y0
    z = -x0 * sin_a + z0 * cos_a
    return x, y, z

class TestBlochPhysicsMath(unittest.TestCase):

    def test_01_rz_preserves_z_and_unit_norm(self):
        """Verify Rz phase rotation preserves z and maintains |r|=1.0."""
        r0 = (1.0, 0.0, 0.0) # |+> state
        angle = math.pi / 2  # S gate (pi/2 around Z)
        
        for t in [0.0, 0.25, 0.5, 0.75, 1.0]:
            x, y, z = compute_bloch_rotation_z(r0[0], r0[1], r0[2], angle, t)
            mag = math.sqrt(x*x + y*y + z*z)
            self.assertAlmostEqual(z, 0.0, places=5)
            self.assertAlmostEqual(mag, 1.0, places=5)
            
        # At t=1.0 (Post-S gate), vector should be at (0, 1, 0) |+i>
        x1, y1, z1 = compute_bloch_rotation_z(r0[0], r0[1], r0[2], angle, 1.0)
        self.assertAlmostEqual(x1, 0.0, places=5)
        self.assertAlmostEqual(y1, 1.0, places=5)

    def test_02_rx_preserves_x_and_unit_norm(self):
        """Verify Rx rotation preserves x and maintains |r|=1.0."""
        r0 = (0.0, 0.0, 1.0) # |0> state
        angle = math.pi      # X gate (pi around X)
        
        for t in [0.0, 0.25, 0.5, 0.75, 1.0]:
            x, y, z = compute_bloch_rotation_x(r0[0], r0[1], r0[2], angle, t)
            mag = math.sqrt(x*x + y*y + z*z)
            self.assertAlmostEqual(x, 0.0, places=5)
            self.assertAlmostEqual(mag, 1.0, places=5)
            
        # At t=1.0 (Post-X gate), vector should be at (0, 0, -1) |1>
        x1, y1, z1 = compute_bloch_rotation_x(r0[0], r0[1], r0[2], angle, 1.0)
        self.assertAlmostEqual(z1, -1.0, places=5)

    def test_03_ry_preserves_y_and_unit_norm(self):
        """Verify Ry rotation preserves y and maintains |r|=1.0."""
        r0 = (0.0, 0.0, 1.0) # |0> state
        angle = math.pi / 2  # Ry(pi/2)
        
        for t in [0.0, 0.5, 1.0]:
            x, y, z = compute_bloch_rotation_y(r0[0], r0[1], r0[2], angle, t)
            mag = math.sqrt(x*x + y*y + z*z)
            self.assertAlmostEqual(y, 0.0, places=5)
            self.assertAlmostEqual(mag, 1.0, places=5)

    def test_04_pole_phi_undefined_contract(self):
        """Verify Phase 131 contract: phi is undefined at poles (z=+1 or z=-1)."""
        # Ground state |0>: (0, 0, 1) -> theta = 0, phi is undefined
        x0, y0, z0 = 0.0, 0.0, 1.0
        theta = math.acos(z0)
        is_phi_undefined = math.sin(theta) < 0.001
        self.assertTrue(is_phi_undefined)

        # Excited state |1>: (0, 0, -1) -> theta = pi, phi is undefined
        x1, y1, z1 = 0.0, 0.0, -1.0
        theta1 = math.acos(z1)
        is_phi_undefined1 = math.sin(theta1) < 0.001
        self.assertTrue(is_phi_undefined1)

        # Superposition |+>: (1, 0, 0) -> theta = pi/2, phi is defined (0 deg)
        xp, yp, zp = 1.0, 0.0, 0.0
        thetap = math.acos(zp)
        is_phi_undefined_p = math.sin(thetap) < 0.001
        self.assertFalse(is_phi_undefined_p)

if __name__ == '__main__':
    unittest.main()
