// Copyright 2013 The Flutter Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

precision mediump float;

#include <impeller/color.glsl>
#include <impeller/gradient.glsl>
#include <impeller/texture.glsl>
#include <impeller/types.glsl>

struct ColorPoint {
  vec4 color;
  float stop;
};

layout(std140) readonly buffer ColorData {
  ColorPoint colors[];
}
color_data;

uniform FragInfo {
  highp vec2 center;
  float radius;
  float tile_mode;
  vec4 decal_border_color;
  float alpha;
  int colors_length;
}
frag_info;

uniform bool dither;

highp in vec2 v_position;

out vec4 frag_color;

// Granularity of dither noise set to very small number 0.5 / 255.0 to ensure any shift in color due to dither noise is minimal
const highp float DITHERING_GRANULARITY = 0.001960784313725;

float random (vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  float len = length(v_position - frag_info.center);
  float t = len / frag_info.radius;

  vec4 result_color = vec4(0);
  if ((t < 0.0 || t > 1.0) && frag_info.tile_mode == kTileModeDecal) {
    result_color = frag_info.decal_border_color;
  } else {
    t = IPFloatTile(t, frag_info.tile_mode);

    for (int i = 1; i < frag_info.colors_length; i++) {
      ColorPoint prev_point = color_data.colors[i - 1];
      ColorPoint current_point = color_data.colors[i];
      if (t >= prev_point.stop && t <= current_point.stop) {
        float delta = (current_point.stop - prev_point.stop);
        if (delta < 0.001) {
          result_color = current_point.color;
        } else {
          float ratio = (t - prev_point.stop) / delta;
          result_color = mix(prev_point.color, current_point.color, ratio);
        }
        break;
      }
    }
  }

  if (dither) {
    float noise = mix(-DITHERING_GRANULARITY, DITHERING_GRANULARITY, random(v_position));
    result_color += vec4(vec3(noise), 0.0);
  }

  frag_color = IPPremultiply(result_color) * frag_info.alpha;
}
