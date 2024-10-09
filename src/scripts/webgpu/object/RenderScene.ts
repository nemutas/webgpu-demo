import { GPU } from '../core/gpu'

export class RenderScene {
  private readonly sampleCount = 4
  private msaaTexture: GPUTexture
  private depthTexture: GPUTexture

  readonly renderPassDescriptor: GPURenderPassDescriptor

  constructor(private readonly gpu: GPU) {
    this.msaaTexture = this.createMSAATexture()
    this.depthTexture = this.createDepthTexture()

    this.renderPassDescriptor = this.createRenderPassDescriptor()
  }

  private createMSAATexture() {
    return this.gpu.device.createTexture({
      size: this.resolution,
      sampleCount: this.sampleCount,
      format: this.gpu.presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }

  private createDepthTexture() {
    return this.gpu.device.createTexture({
      size: this.resolution,
      format: 'depth24plus-stencil8',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.sampleCount,
    })
  }

  private createRenderPassDescriptor(): GPURenderPassDescriptor {
    return {
      colorAttachments: [
        {
          view: this.msaaTexture.createView(),
          resolveTarget: this.contextView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        stencilClearValue: 0,
        stencilLoadOp: 'clear',
        stencilStoreOp: 'store',
      },
    }
  }

  private get colorAttachment() {
    return (this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0]
  }

  get resolution() {
    return [this.gpu.context.canvas.width, this.gpu.context.canvas.height]
  }

  get contextView() {
    return this.gpu.context.getCurrentTexture().createView()
  }

  get pipelineDepthStencilState(): GPUDepthStencilState {
    return {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus-stencil8',
    }
  }

  get pipleneMultisampleState(): GPUMultisampleState {
    return {
      count: this.sampleCount,
    }
  }

  set clearColor(color: GPUColor) {
    this.colorAttachment.clearValue = color
  }

  update() {
    this.colorAttachment.view = this.msaaTexture.createView()
    this.colorAttachment.resolveTarget = this.contextView
    this.renderPassDescriptor.depthStencilAttachment!.view = this.depthTexture.createView()
  }

  resize() {
    this.msaaTexture.destroy()
    this.msaaTexture = this.createMSAATexture()

    this.depthTexture.destroy()
    this.depthTexture = this.createDepthTexture()
  }
}
