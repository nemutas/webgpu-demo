struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}
struct Uniform {
  time: f32,
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

@group(0) @binding(0) var sampl: sampler;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: Uniform;

@fragment fn fs(in: VSOut) -> @location(0) vec4f {
  var uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  
  uv.x += sin(uv.y * 1000.0 + u.time * 0.02) * 0.001;
  uv.x += sin(uv.y * 2000.0 + u.time * 0.05) * (0.003 + sin(u.time * 0.1 + uv.y * 3000.0) * 0.003);

  let tex = textureSample(source, sampl, uv);
  var color = tex.rgb;
  color *= vec3f(0, 0.8, 0);
  color = select(color, color * vec3f(0.97), sin(uv.y * 100.0 + u.time * 0.05) < -0.5);

  return vec4f(color, tex.a);
}