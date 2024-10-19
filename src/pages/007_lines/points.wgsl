struct VSIn {
  @builtin(instance_index) instanceIdx: u32,
  @location(0) position: vec3f,
  @location(1) uv: vec2f,
}
struct VSOut {
   @builtin(position) position: vec4f,
   @location(0) depth: f32,
   @location(1) uv: vec2f,
}
struct Scene {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
}
@group(0) @binding(0) var<uniform> scene: Scene;
@group(1) @binding(0) var<storage, read> points: array<vec3f>;

@vertex fn vs(in: VSIn) -> VSOut {
  var out: VSOut;
  out.position = scene.projectionMatrix * scene.viewMatrix * vec4f(in.position + points[in.instanceIdx], 1.0);
  out.depth = out.position.z / out.position.w;
  out.uv = in.uv;
  return out;
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  let depth = 1.0 - smoothstep(0.9, 1.0, in.depth * 2.0 - 1.0);
  let dist = 1.0 - smoothstep(0.4, 0.5, distance(in.uv, vec2(0.5)));
  return vec4f(vec3f(depth) * dist, dist);
}