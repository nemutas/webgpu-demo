struct Light {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
}
struct Model {
  modelMatrix: mat4x4f,
}
@group(0) @binding(0) var<uniform> light: Light;
@group(1) @binding(0) var<uniform> model: Model;

@vertex fn main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return light.projectionMatrix * light.viewMatrix * model.modelMatrix * vec4(position, 1.0);
} 