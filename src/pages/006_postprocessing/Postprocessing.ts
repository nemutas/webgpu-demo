import { GPU } from '@scripts/webgpu/core/gpu'
import shader from './postprocessing.wgsl'
import * as WGU from 'webgpu-utils'
import { createUniformBuffer } from '@scripts/webgpu/common/bufferGenerator'

export class Postprocessing {
  private readonly device: GPUDevice

  private readonly sampler: GPUSampler
  private readonly layout: GPUBindGroupLayout
  private bindGroup: GPUBindGroup
  private readonly pipeline: GPURenderPipeline
  private readonly renderPassDescriptor: GPURenderPassDescriptor
  private readonly uniformData: { buffer: GPUBuffer; values: WGU.StructuredView }

  constructor(
    private readonly gpu: GPU,
    source: GPUTexture,
  ) {
    this.device = gpu.device

    this.uniformData = this.createUniformData()
    this.layout = this.createBindGroupLayout(this.uniformData.buffer.size)
    this.sampler = this.device.createSampler()
    this.bindGroup = this.createBindGroup(this.sampler, source, this.uniformData.buffer)
    this.pipeline = this.createRenderPipeline([this.layout])
    this.renderPassDescriptor = this.createRenderPassDescriptor()
  }

  private createUniformData() {
    const defs = WGU.makeShaderDataDefinitions(shader)
    const values = WGU.makeStructuredView(defs.uniforms.u)
    const buffer = createUniformBuffer(this.device, values.arrayBuffer.byteLength)
    return { buffer, values }
  }

  private createBindGroupLayout(uniformMinBindingSize: number) {
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
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform', minBindingSize: uniformMinBindingSize },
        },
      ],
    })
  }

  private createBindGroup(sampler: GPUSampler, source: GPUTexture, uniformBuffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: source.createView() },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    })
  }

  private createRenderPipeline(bindGroupLayouts: GPUBindGroupLayout[]) {
    const module = this.device.createShaderModule({ code: shader })

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: { module },
      fragment: { module, targets: [{ format: this.gpu.presentationFormat }] },
      primitive: { topology: 'triangle-list' },
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

  private get contextView() {
    return this.gpu.context.getCurrentTexture().createView()
  }

  private updateUniform(et: number) {
    this.uniformData.values.set({ time: et })

    const time = this.uniformData.values.views.time as Float32Array
    this.device.queue.writeBuffer(this.uniformData.buffer, time.byteOffset, time.buffer)
  }

  render(encoder: GPUCommandEncoder, et: number) {
    this.updateUniform(et)
    ;(this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = this.contextView

    const pass = encoder.beginRenderPass(this.renderPassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.draw(3)
    pass.end()
  }

  resize(source: GPUTexture) {
    this.bindGroup = this.createBindGroup(this.sampler, source, this.uniformData.buffer)
  }
}
