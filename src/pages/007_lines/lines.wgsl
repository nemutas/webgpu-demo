struct VSIn {
  @builtin(vertex_index) vertexIndex: u32,
}
struct VSOut {
   @builtin(position) position: vec4f,
   @location(0) depth: f32,
}
struct Scene {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
}
@group(0) @binding(0) var<uniform> scene: Scene;
@group(1) @binding(0) var<storage, read> points: array<vec3f>;

@vertex fn vs(in: VSIn) -> VSOut {
  var out: VSOut;
  out.position = scene.projectionMatrix * scene.viewMatrix * vec4f(points[in.vertexIndex], 1.0);
  out.depth = out.position.z / out.position.w;
  return out;
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  let depth = 1.0 - smoothstep(0.9, 1.0, in.depth * 2.0 - 1.0);
  return vec4f(vec3f(depth) * 0.8, depth);
}