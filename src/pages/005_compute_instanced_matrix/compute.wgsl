override blockSize: u32 = 10;

@group(0) @binding(0) var<storage, read_write> instancedMatrix: array<mat4x4f, NUM_INSTANCES>;

struct Uniforms {
  size: vec2u,
  time: f32,
}
@group(0) @binding(1) var<uniform> u: Uniforms;

@compute @workgroup_size(blockSize, blockSize, 1) fn main(@builtin(global_invocation_id) id: vec3u) {
  let index = getIndex(id.x, id.y);

  let matrix = instancedMatrix[index] * rotation3d(vec3f(1, 1, 1), u.time * 1e-2 * 0.5);
  instancedMatrix[index] = matrix;
}

fn getIndex(x: u32, y: u32) -> u32 {
  return (y % u.size.y) * u.size.x + (x % u.size.x);
}

fn rotation3d(axis: vec3f, angle: f32) -> mat4x4f {
  let ax = normalize(axis);
  let s = sin(angle);
  let c = cos(angle);
  let oc = 1.0 - c;

  return mat4x4f(
    oc * ax.x * ax.x + c,         oc * ax.x * ax.y - ax.z * s,  oc * ax.z * ax.x + ax.y * s,  0.0,
    oc * ax.x * ax.y + ax.z * s,  oc * ax.y * ax.y + c,         oc * ax.y * ax.z - ax.x * s,  0.0,
    oc * ax.z * ax.x - ax.y * s,  oc * ax.y * ax.z + ax.x * s,  oc * ax.z * ax.z + c,         0.0,
    0.0,                          0.0,                          0.0,                          1.0
  );
}
