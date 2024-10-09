export function concatF32Arrays(sources: Float32Array[], strides: number[]) {
  let sumArray = sources[0]
  let sumStride = strides[0]
  const offsets: number[] = [0]

  for (let i = 1; i < sources.length; i++) {
    const result = concatF32Array([sumArray, sources[i]], [sumStride, strides[i]])
    sumArray = result.array
    sumStride = result.stride
    offsets.push(offsets[i - 1] + 4 * strides[i - 1])
  }

  return { array: sumArray, byteStride: 4 * sumStride, byteOffsets: offsets }
}

function concatF32Array(sources: [Float32Array, Float32Array], strides: [number, number]) {
  const result: number[] = []
  for (let i = 0; i < sources[0].length / strides[0]; i++) {
    const src1Sub = sources[0].subarray(i * strides[0], (i + 1) * strides[0])
    const src2Sub = sources[1].subarray(i * strides[1], (i + 1) * strides[1])
    result.push(...src1Sub, ...src2Sub)
  }
  return { array: new Float32Array(result), stride: strides[0] + strides[1] }
}
