struct VSIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) color: vec4f,
}
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) uv: vec2f,
  @location(2) color: vec4f,
}
struct Camera {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
}
struct Local {
  modelMatrix: mat4x4f,
  normalMatrix: mat4x4f,
}
@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<uniform> local: Local;

@vertex fn vs(in: VSIn) -> VSOut {
  var out: VSOut;
  out.position = camera.projectionMatrix * camera.viewMatrix * local.modelMatrix * vec4f(in.position, 1.0);
  out.normal = normalize(local.normalMatrix * vec4f(in.normal, 0.0)).xyz;
  out.uv = in.uv;
  out.color = in.color;
  return out;
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  // return vec4f(in.normal * 0.5 + 0.5, 1.0);
  return in.color;
  // return vec4f(in.uv, 1.0, 1.0);
}