struct VSIn {
  @builtin(instance_index) instanceIdx: u32,
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}
struct Camera {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
}
struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat4x4f,
}
struct Instance {
  matrix: array<mat4x4f, NUM_INSTANCES>,
}
@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<uniform> model: Model;
@group(1) @binding(1) var<storage, read> instanced: Instance;

@vertex fn vs(in: VSIn) -> VSOut {
  let instancedMatrix = instanced.matrix[in.instanceIdx];

  var out: VSOut;
  out.position = camera.projectionMatrix * camera.viewMatrix * model.modelMatrix * instancedMatrix * vec4f(in.position, 1.0);
  out.normal = normalize(model.normalMatrix * camera.viewMatrix * instancedMatrix * vec4f(in.normal, 0.0)).xyz;
  return out;
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  let lightVec = normalize(vec3f(1, 1, 1));
  let shade = dot(in.normal, lightVec) * 0.5 + 0.5;

  return vec4f(vec3(shade), 1.0);
}