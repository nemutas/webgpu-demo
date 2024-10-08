export type GPU = {
  readonly context: GPUCanvasContext
  readonly adapter: GPUAdapter
  readonly device: GPUDevice
  readonly presentationFormat: GPUTextureFormat
}

export async function getGPUContexts(canvas: HTMLCanvasElement) {
  return new Promise<GPU>(async (resolve) => {
    const context = canvas.getContext('webgpu')
    if (!context) throw new Error('Failed to get webgpu context.')

    const g_adapter = await navigator.gpu.requestAdapter()
    if (!g_adapter) throw new Error('Failed to get gpu adapter.')

    const hasBGRA8unormStorage = g_adapter.features.has('bgra8unorm-storage')
    const g_device = await g_adapter.requestDevice({ requiredFeatures: hasBGRA8unormStorage ? ['bgra8unorm-storage'] : [] })
    if (!g_device) throw new Error('Failed to get gpu device.')

    const presentationFormat: GPUTextureFormat = hasBGRA8unormStorage ? navigator.gpu.getPreferredCanvasFormat() : 'rgba8unorm'

    const width = canvas.clientWidth * window.devicePixelRatio
    const height = canvas.clientHeight * window.devicePixelRatio
    canvas.width = Math.max(1, Math.min(width, g_device.limits.maxTextureDimension2D))
    canvas.height = Math.max(1, Math.min(height, g_device.limits.maxTextureDimension2D))

    resolve({ context, adapter: g_adapter, device: g_device, presentationFormat })
  })
}
