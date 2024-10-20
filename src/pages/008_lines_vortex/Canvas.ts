import { createStorageBuffer } from '@scripts/webgpu/common/bufferGenerator'
import { CanvasBase } from '@scripts/webgpu/core/CanvasBase'
import { GPU } from '@scripts/webgpu/core/gpu'
import { PerspectiveCamera } from '@scripts/webgpu/object/PerspectiveCamera'
import { RenderScene } from '@scripts/webgpu/object/RenderScene'
import * as WGU from 'webgpu-utils'
import { mat3, vec3 } from 'wgpu-matrix'
import shader from './lines.wgsl'

export class Canvas extends CanvasBase {
  private readonly scene: RenderScene
  private readonly camera: PerspectiveCamera
  private readonly pipeline: GPURenderPipeline
  private readonly bindGroup: GPUBindGroup

  private readonly pointCount = 50000

  constructor(gpu: GPU) {
    super(gpu)
    this.scene = new RenderScene(gpu)
    this.camera = this.createCamera()

    const pointsStorageBuffer = this.createPointsStorageBuffer()
    const bindGroupLayout = this.createBindGroupLayout([pointsStorageBuffer.size])
    this.bindGroup = this.createBindGroup(bindGroupLayout, [pointsStorageBuffer])

    this.pipeline = this.createRenderPipeline([this.camera.bindGroupLayout, bindGroupLayout])

    this.render()
    window.addEventListener('resize', this.resize.bind(this))
  }

  private createCamera() {
    const camera = new PerspectiveCamera(this.device, { fovDeg: 45, aspect: this.resolution.aspect, near: 0.1, far: 100 })
    camera.position = [28, -5, 50]
    camera.target = [28, -5, 0]
    camera.updateViewMatrix()
    return camera
  }

  private createPointsStorageBuffer() {
    const defs = WGU.makeShaderDataDefinitions(shader)
    const values = WGU.makeStructuredView(defs.storages.points, new ArrayBuffer(4 * 4 * this.pointCount)) // 4byte * (vec3 + 1padding) * points

    const points: Float32Array[] = []
    let prev = Float32Array.from([0, 0, 0])
    points.push(prev)

    const theta = 0.288 * 0.01
    for (let i = 1; i < this.pointCount; i++) {
      const p = vec3.create(0.2, 0, 0)
      const m = mat3.rotationZ((theta * (i * (i - 1))) / 2)
      vec3.transformMat3(p, m, p)
      vec3.add(p, prev, p)
      prev = p

      points.push(p)
    }
    values.set(points)

    const buffer = createStorageBuffer(this.device, values.arrayBuffer.byteLength)
    this.device.queue.writeBuffer(buffer, 0, values.arrayBuffer)
    return buffer
  }

  private createBindGroupLayout(minBindingSizes: number[]) {
    return this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          buffer: { type: 'read-only-storage', minBindingSize: minBindingSizes[0] },
          visibility: GPUShaderStage.VERTEX,
        },
      ],
    })
  }

  private createBindGroup(layout: GPUBindGroupLayout, buffers: GPUBuffer[]) {
    return this.device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: { buffer: buffers[0] } }],
    })
  }

  private getBlendState(): GPUBlendState {
    return {
      // color: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      // alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      color: { operation: 'max', srcFactor: 'one', dstFactor: 'one' },
      alpha: { operation: 'max', srcFactor: 'one', dstFactor: 'one' },
    }
  }

  private createRenderPipeline(bindGroupLayouts: GPUBindGroupLayout[]) {
    const module = this.device.createShaderModule({ code: shader })

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: { module },
      fragment: { module, targets: [{ format: this.gpu.presentationFormat, blend: this.getBlendState() }] },
      primitive: { topology: 'line-strip' },
      depthStencil: this.scene.pipelineDepthStencilState,
      multisample: this.scene.pipleneMultisampleState,
    })
  }

  render() {
    this.scene.update()

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass(this.scene.renderPassDescriptor)
    pass.setBindGroup(0, this.camera.bindGroup)
    pass.setBindGroup(1, this.bindGroup)
    pass.setPipeline(this.pipeline)
    pass.draw(this.pointCount)
    pass.end()
    this.device.queue.submit([encoder.finish()])

    requestAnimationFrame(this.render.bind(this))
  }

  resize() {
    this.scene.resize()
    this.camera.updateAspect(this.resolution.aspect)
  }
}
