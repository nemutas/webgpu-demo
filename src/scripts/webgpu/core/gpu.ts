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

    calcCanvasResolution(g_device, canvas)
    const presentationFormat: GPUTextureFormat = hasBGRA8unormStorage ? navigator.gpu.getPreferredCanvasFormat() : 'rgba8unorm'

    resolve({ context, adapter: g_adapter, device: g_device, presentationFormat })
  })
}

export function calcCanvasResolution(device: GPUDevice, canvas: HTMLCanvasElement, updateCanvas = true): [number, number] {
  let width = canvas.clientWidth * window.devicePixelRatio
  let height = canvas.clientHeight * window.devicePixelRatio

  const aspect = width / height
  const maxDim = device.limits.maxTextureDimension2D

  if (maxDim < width && maxDim < height) {
    if (1 < aspect) {
      ;[width, height] = [maxDim, maxDim / aspect]
    } else {
      ;[width, height] = [maxDim, maxDim * aspect]
    }
  } else if (maxDim < width) {
    // 1 < aspect
    ;[width, height] = [maxDim, maxDim / aspect]
  } else if (maxDim < height) {
    // aspect < 1
    ;[width, height] = [maxDim * aspect, maxDim]
  }

  if (updateCanvas) {
    canvas.width = width
    canvas.height = height
  }

  return [width, height]
}
