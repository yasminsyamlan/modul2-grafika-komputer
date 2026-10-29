"""Independent reference raster for the module's triangle A(1,1) B(6,2) C(3,7).

Written in Python with exact rational arithmetic and a DIFFERENT formulation of
the on-edge rule than raster.mjs: a pixel centre p is covered iff the point
p + s*(eps, eps^2) is strictly inside, for an infinitesimal eps (s = +1 gives
the true Direct3D top-left rule, s = -1 the module listing's rule).  Expanding
E(p + s*(eps, eps^2)) gives a lexicographic sign test -- no "top/left" case
analysis, no bias constants.

    python3 ref/make_tri_ref.py        # rewrites ref/tri_ref.ppm (module rule)
                                       # and ref/tri_ref_d3d.ppm (true top-left)
"""
from fractions import Fraction as F

W, H = 8, 9
A, B, C = (1, 1), (6, 2), (3, 7)
FILL, BG = (230, 120, 40), (0, 0, 0)


def covered(tri, px, py, rule="module"):
    """rule "d3d"   : sample at p + (eps, eps^2)  -> true top-left owner
       rule "module": sample at p - (eps, eps^2)  -> the module listing's owner
    E(p + s*(eps, eps^2)) = E - s*dy*eps + s*... -> lexicographic (E, -s*dy, s*dx)."""
    s = 1 if rule == "d3d" else -1
    for (ax, ay), (bx, by) in zip(tri, tri[1:] + tri[:1]):
        dx, dy = bx - ax, by - ay
        e = dx * (py - ay) - dy * (px - ax)
        # first-order term: -dy*s*eps ; second-order term: dx*s*eps^2
        if not (e, -dy * s, dx * s) > (0, 0, 0):
            return False
    return True


tri = [A, B, C]
for rule, name in (("module", "ref/tri_ref.ppm"), ("d3d", "ref/tri_ref_d3d.ppm")):
    rows = []
    for y in range(H):
        for x in range(W):
            rows.append(FILL if covered(tri, F(2 * x + 1, 2), F(2 * y + 1, 2), rule) else BG)
    with open(name, "wb") as f:
        f.write(f"P6\n{W} {H}\n255\n".encode())
        for px in rows:
            f.write(bytes(px))
    print(f"wrote {name:22s} rule={rule:6s} covered pixels:", sum(1 for p in rows if p == FILL))
