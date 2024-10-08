struct Uniforms {
  resolution: vec2u,
}
@group(0) @binding(0) var<uniform> u: Uniforms;

@group(1) @binding(0) var _sampler: sampler;
@group(1) @binding(1) var _texture: texture_2d<f32>;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  let pos = array(
    vec2f(-1, -1),
    vec2f( 3, -1),
    vec2f(-1,  3),
  );

  let xy = pos[vertexIndex];
  var out: VSOut;
  out.position = vec4f(xy, 0, 1);
  out.uv = (xy + 1.0) / 4.0 * 2.0;
  return out;
}

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  // return vec4f(in.uv, 0.0, 1.0);

  let aspect = f32(u.resolution.x) / f32(u.resolution.y);
  let textureDim = textureDimensions(_texture);
  let textureAspect = f32(textureDim.x) / f32(textureDim.y);
  let coveredScale = covered_scale(textureAspect, aspect);
  let scaledUv = (in.uv - 0.5) * coveredScale + 0.5;

  return textureSample(_texture, _sampler, scaledUv);
}

fn covered_scale(image_aspect: f32, screen_aspect: f32) -> vec2<f32> {
  return select(
    vec2<f32>(screen_aspect / image_aspect, 1.0),
    vec2<f32>(1.0, image_aspect / screen_aspect),
    image_aspect < screen_aspect
  );
}
