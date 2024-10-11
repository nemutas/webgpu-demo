export function createVertexBuffer(device: GPUDevice, source: Float32Array) {
  const buffer = device.createBuffer({
    size: source.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  })
  new Float32Array(buffer.getMappedRange()).set(source)
  buffer.unmap()
  return buffer
}

export function createIndexBuffer(device: GPUDevice, source: Uint16Array | Uint32Array) {
  const buffer = device.createBuffer({
    size: source.byteLength,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  })
  const TypeArray = source instanceof Uint16Array ? Uint16Array : Uint32Array
  new TypeArray(buffer.getMappedRange()).set(source)
  buffer.unmap()
  return buffer
}

export function createUniformBuffer(device: GPUDevice, byteSize: number, usage?: number) {
  const buffer = device.createBuffer({
    size: byteSize,
    usage: usage ?? GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  return buffer
}

export function createStorageBuffer(device: GPUDevice, byteSize: number, usage?: number) {
  const buffer = device.createBuffer({
    size: byteSize,
    usage: usage ?? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  return buffer
}
