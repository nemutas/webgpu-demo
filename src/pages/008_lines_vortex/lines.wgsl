struct VSIn {
  @builtin(vertex_index) vertexIndex: u32,
}
struct VSOut {
   @builtin(position) position: vec4f,
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
  return out;
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  return vec4f(1);
}