struct VSIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}
struct Scene {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
}
struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat4x4f,
}
@group(0) @binding(0) var<uniform> scene: Scene;
@group(1) @binding(0) var<uniform> model: Model;

@vertex fn vs(in: VSIn) -> VSOut {
  var out: VSOut;
  out.position = scene.projectionMatrix * scene.viewMatrix * model.modelMatrix * vec4(in.position, 1.0);
  out.normal = normalize(model.normalMatrix * scene.viewMatrix * vec4(in.normal, 0.0)).xyz;
  return out;
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  let lightVec = normalize(vec3f(1, 1, 1));
  var shade = dot(in.normal, lightVec) * 0.5 + 0.5;

  return vec4f(vec3(shade), 1.0);
}

