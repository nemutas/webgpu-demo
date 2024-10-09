import { CanvasBase } from '@scripts/webgpu/core/CanvasBase'
import { GPU } from '@scripts/webgpu/core/gpu'
import shader from './render.wgsl'
import { loadImageBitmap } from '@scripts/webgpu/common/loader'

export class Canvas extends CanvasBase {
  constructor(gpu: GPU) {
    super(gpu)

    this.createTexture().then((texture) => {
      const sampler = this.createSampler()
      const uniformBuffer = this.createUniformBuffer()
      const pipeline = this.createPipeline([this.createUniformBindGroupLayout(uniformBuffer.size), this.createTextureBindGroupLayout()])
      const uniformBindGroup = this.createUniformBindGroup(pipeline, uniformBuffer)
      const textureBindGroup = this.createTextureBindGroup(pipeline, texture, sampler)
      const renderPassDescriptor = this.createRenderPassDescriptor()
      this.render(renderPassDescriptor, pipeline, uniformBindGroup, textureBindGroup)
      window.addEventListener('resize', this.resize.bind(this, uniformBuffer))
    })
  }

  private async createTexture() {
    const url = import.meta.env.BASE_URL + 'images/unsplash.webp'
    const source = await loadImageBitmap(url)
    const texture = this.device.createTexture({
      label: url,
      format: 'rgba8unorm',
      size: [source.width, source.height],
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    })
    this.device.queue.copyExternalImageToTexture({ source, flipY: true }, { texture }, { width: source.width, height: source.height })

    return texture
  }

  private createSampler() {
    return this.device.createSampler({
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      minFilter: 'linear',
      magFilter: 'linear',
    })
  }

  private createUniformBuffer() {
    const resArray = new Uint32Array([this.resolution.width, this.resolution.height])

    const bufferSize = resArray.byteLength // 8byte = 4byte(u32) * vec2
    const buffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, resArray.buffer, resArray.byteOffset, resArray.byteLength)
    return buffer
  }

  private createUniformBindGroupLayout(minBindingSize?: number) {
    return this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform', minBindingSize },
        },
      ],
    })
  }

  private createTextureBindGroupLayout() {
    return this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
      ],
    })
  }

  private createPipeline(bindGroupLayouts: GPUBindGroupLayout[]) {
    const module = this.device.createShaderModule({ code: shader })
    const layout = this.device.createPipelineLayout({ bindGroupLayouts })

    return this.device.createRenderPipeline({
      layout,
      vertex: { module },
      fragment: { module, targets: [{ format: this.gpu.presentationFormat }] },
      primitive: { topology: 'triangle-list' },
    })
  }

  private createUniformBindGroup(pipeline: GPURenderPipeline, uniformBuffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
  }

  private createTextureBindGroup(pipeline: GPURenderPipeline, texture: GPUTexture, sampler: GPUSampler) {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
      ],
    })
  }

  private createRenderPassDescriptor(): GPURenderPassDescriptor {
    return {
      colorAttachments: [
        {
          view: this.contextView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    }
  }

  private render(descriptor: GPURenderPassDescriptor, pipeline: GPURenderPipeline, uniformBindgroup: GPUBindGroup, textureBindgroup: GPUBindGroup) {
    ;(descriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = this.contextView

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass(descriptor)
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, uniformBindgroup)
    pass.setBindGroup(1, textureBindgroup)
    pass.draw(3)
    pass.end()

    this.device.queue.submit([encoder.finish()])

    requestAnimationFrame(this.render.bind(this, descriptor, pipeline, uniformBindgroup, textureBindgroup))
  }

  private resize(uniformBuffer: GPUBuffer) {
    const resArray = new Uint32Array([this.resolution.width, this.resolution.height])
    this.device.queue.writeBuffer(uniformBuffer, 0, resArray.buffer, resArray.byteOffset, resArray.byteLength)
  }
}
