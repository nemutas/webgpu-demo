override shadowDepthTextureSize: f32 = 1024.0;

struct VSIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) shadowPos: vec3f,
  @location(1) scenePos: vec3f,
  @location(2) normal: vec3f,
  @location(3) lightPos: vec3f,
}
struct Camera {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  position: vec3f,
}
struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat4x4f,
}
@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<uniform> model: Model;
@group(2) @binding(0) var<uniform> light: Camera;

@vertex fn vs(in: VSIn) -> VSOut {
  var out: VSOut;

  let worldPos = model.modelMatrix * vec4(in.position, 1.0);
  let posFromLight = light.projectionMatrix * light.viewMatrix * worldPos;

  out.shadowPos = vec3f(posFromLight.xy * vec2f(0.5, -0.5) + 0.5, posFromLight.z);

  out.position = camera.projectionMatrix * camera.viewMatrix * worldPos;
  out.scenePos = out.position.xyz;
  out.normal = normalize(model.normalMatrix * vec4f(in.normal, 0.0)).xyz;
  out.lightPos = light.position;

  return out;
}

@group(3) @binding(0) var shadowMap: texture_depth_2d;
@group(3) @binding(1) var shadowSamper: sampler_comparison;

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  var visibility = 0.0;
  let oneOverShadowDepthTextureSize = 1.0 / shadowDepthTextureSize;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let offset = vec2f(vec2(x, y)) * oneOverShadowDepthTextureSize;
      visibility += textureSampleCompare(shadowMap, shadowSamper, in.shadowPos.xy + offset, in.shadowPos.z - 0.003);
    } 
  }
  visibility /= 9.0;

  var color = vec3f(1);
  let selfShadow = dot(in.normal, normalize(in.lightPos)) * (1.0 - 0.3) + 0.3;
  color *= selfShadow;
  color *= visibility * (1.0 - 0.4) + 0.4;

  // return vec4f(vec3f(visibility), 1.0);
  // return vec4f(vec3f(selfShadow), 1.0);
  return vec4f(color, 1.0);
}