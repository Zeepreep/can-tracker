# Backlog

## 3D can view (decided: option 2 first)
- Build a three.js viewer that draws a parametric can (250/355/473 ml size) with drag-to-rotate.
- Texture is procedural: background colour from the flavour/colour fallback, name and flavour text printed on it.
- Use the Open Food Facts front image as the front texture when one exists (no capture needed).
- Not doing now: photo-based wraps, turntable slit-scan (see research notes below), Gaussian splats (need WebGPU, not on iOS 18.7).
- Storage note: textures must not go into collection.json (GitHub 1 MB file limit). Procedural textures need no storage.

## Research notes
- Slit-scan from a turntable video is the documented route for a full 360° label strip if photos are ever wanted.
- Full photogrammetry is overkill for cans; needs a GPU.
