import { CanvasBase } from '@scripts/webgpu/core/CanvasBase'
import { GPU } from '@scripts/webgpu/core/gpu'
import { PerspectiveCamera } from '@scripts/webgpu/object/PerspectiveCamera'
import shader from './lines.wgsl'
import pointsShader from './points.wgsl'
import { RenderScene } from '@scripts/webgpu/object/RenderScene'
import * as WGU from 'webgpu-utils'
import * as THREE from 'three'
import { createStorageBuffer } from '@scripts/webgpu/common/bufferGenerator'
import { vec3 } from 'wgpu-matrix'

export class Canvas extends CanvasBase {
  private readonly scene: RenderScene
  private readonly camera: PerspectiveCamera
  private readonly pipeline: GPURenderPipeline
  private readonly bindGroup: GPUBindGroup

  private readonly pointCount = 500
  private readonly pointsVertexData: WGU.BuffersAndAttributes
  private readonly pointsPipeline: GPURenderPipeline

  constructor(gpu: GPU) {
    super(gpu)
    this.scene = new RenderScene(gpu)
    this.camera = this.createCamera()

    const pointsStorageBuffer = this.createPointsStorageBuffer()
    const bindGroupLayout = this.createBindGroupLayout([pointsStorageBuffer.size])
    this.bindGroup = this.createBindGroup(bindGroupLayout, [pointsStorageBuffer])

    this.pipeline = this.createRenderPipeline([this.camera.bindGroupLayout, bindGroupLayout])

    this.pointsVertexData = this.createPlaneVertexData()
    this.pointsPipeline = this.createPointsRenderPipeline([this.camera.bindGroupLayout, bindGroupLayout], [...this.pointsVertexData.bufferLayouts])

    this.render()
    window.addEventListener('resize', this.resize.bind(this))
  }

  private createPointsStorageBuffer() {
    const defs = WGU.makeShaderDataDefinitions(shader)
    const values = WGU.makeStructuredView(defs.storages.points, new ArrayBuffer(4 * 4 * this.pointCount)) // 4byte * (vec3 + 1padding) * points

    // https://suricrasia.online/blog/shader-functions/#rndunit
    const p = () => Math.tan(Math.random() * 2.0 - 1.0)

    const points: Float32Array[] = []
    for (let i = 0; i < this.pointCount; i++) {
      points.push(vec3.normalize(vec3.create(p(), p(), p())))
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

  private createPlaneVertexData() {
    const plane = new THREE.PlaneGeometry(0.03, 0.03)

    return WGU.createBuffersAndAttributesFromArrays(this.device, {
      position: plane.attributes.position.array,
      texcoord: plane.attributes.uv.array,
      indices: plane.index!.array,
    })
  }

  private createCamera() {
    const camera = new PerspectiveCamera(this.device, { fovDeg: 45, aspect: this.resolution.aspect, near: 0.1, far: 10 })
    camera.position[2] = 3
    camera.updateViewMatrix()
    return camera
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

  private createPointsRenderPipeline(bindGroupLayouts: GPUBindGroupLayout[], vertexBufferLayouts: GPUVertexBufferLayout[]) {
    const module = this.device.createShaderModule({ code: pointsShader })

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: { module, buffers: vertexBufferLayouts },
      fragment: { module, targets: [{ format: this.gpu.presentationFormat, blend: this.getBlendState() }] },
      primitive: { topology: 'triangle-list' },
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
    {
      pass.setPipeline(this.pipeline)
      pass.draw(this.pointCount)
    }
    {
      pass.setPipeline(this.pointsPipeline)
      pass.setVertexBuffer(0, this.pointsVertexData.buffers[0])
      pass.setIndexBuffer(this.pointsVertexData.indexBuffer!, this.pointsVertexData.indexFormat!)
      pass.drawIndexed(this.pointsVertexData.numElements, this.pointCount)
    }
    pass.end()
    this.device.queue.submit([encoder.finish()])

    requestAnimationFrame(this.render.bind(this))
  }

  resize() {
    this.scene.resize()
    this.camera.updateAspect(this.resolution.aspect)
  }
}
