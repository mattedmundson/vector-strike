// Wireframe models: vertices [x, y, z] and edges [i, j]. +z is the nose.
// All designs here are original.

// "Dart" interceptor: diamond fuselage with swept wings and tip fins.
export const DART = {
  radius: 9,
  verts: [
    [0, 0, 7],      // 0 nose
    [0, 1.6, -1],   // 1 top
    [0, -1.6, -1],  // 2 bottom
    [-2, 0, -1],    // 3 left
    [2, 0, -1],     // 4 right
    [0, 0, -4],     // 5 tail
    [-8, -0.8, -4], // 6 left wingtip
    [8, -0.8, -4],  // 7 right wingtip
    [-8, 2.2, -5.5],// 8 left fin
    [8, 2.2, -5.5], // 9 right fin
  ],
  edges: [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 3], [3, 2], [2, 4], [4, 1],
    [5, 1], [5, 2], [5, 3], [5, 4],
    [3, 6], [6, 5], [4, 7], [7, 5],
    [6, 8], [8, 3], [7, 9], [9, 4],
  ],
};

// Axis-aligned box as world-space verts/edges.
export function box(x0, x1, y0, y1, z0, z1) {
  const verts = [];
  for (const z of [z0, z1]) for (const y of [y0, y1]) for (const x of [x0, x1]) verts.push({ x, y, z });
  const edges = [
    [0, 1], [2, 3], [0, 2], [1, 3],
    [4, 5], [6, 7], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return { verts, edges };
}

// Pyramid (bunker cap) sitting on a square base at height y.
export function pyramid(x, y, z, half, h) {
  const verts = [
    { x: x - half, y, z: z - half }, { x: x + half, y, z: z - half },
    { x: x + half, y, z: z + half }, { x: x - half, y, z: z + half },
    { x, y: y + h, z },
  ];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]];
  return { verts, edges };
}
