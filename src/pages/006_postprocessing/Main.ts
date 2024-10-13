import * as THREE from 'three'
import { loadDoracoModel } from '@scripts/webgpu/common/loader'
import { GPU } from '@scripts/webgpu/core/gpu'
import { GLTF } from 'three/examples/jsm/Addons.js'
import * as WGU from 'webgpu-utils'
import shader from './main.wgsl'
import { mat4 } from 'wgpu-matrix'
import { createUniformBuffer } from '@scripts/webgpu/common/bufferGenerator'
import { PerspectiveCamera } from '@scripts/webgpu/object/PerspectiveCamera'
import { RenderScene } from '@scripts/webgpu/object/RenderScene'

export class Main {
  static async create(gpu: GPU) {
    const path = import.meta.env.BASE_URL + 'models/bunny.drc'
    const model = await loadDoracoModel(path)
    return new this(gpu, model)
  }

  // =================================================
  renderTarget: GPUTexture

  private readonly device: GPUDevice
  private readonly scene: RenderScene
  private readonly camera: PerspectiveCamera
  private readonly vertexData: WGU.BuffersAndAttributes
  private readonly uniformData: { buffer: GPUBuffer; values: WGU.StructuredView }
  private readonly bindGroup: GPUBindGroup
  private readonly pipeline: GPURenderPipeline

  private constructor(
    private readonly gpu: GPU,
    model: GLTF,
  ) {
    this.device = this.gpu.device

    this.renderTarget = this.createRenderTarget()
    this.scene = new RenderScene(gpu)
    this.camera = this.createCamera()
    this.vertexData = this.createVertexData(model)
    this.uniformData = this.createUniformData()

    const layout = this.createBindGroupLayout(this.uniformData.buffer.size)
    this.bindGroup = this.createBindGroup(layout, this.uniformData.buffer)
    this.pipeline = this.createRenderPipeline([this.camera.bindGroupLayout, layout], [...this.vertexData.bufferLayouts])
  }

  private get resolution() {
    const { width, height } = this.gpu.context.canvas
    return { width, height, aspect: width / height }
  }

  private createRenderTarget() {
    return this.device.createTexture({
      size: { ...this.resolution },
      format: this.gpu.presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })
  }

  private createCamera() {
    const camera = new PerspectiveCamera(this.device, { fovDeg: 45, aspect: this.resolution.aspect, near: 0.1, far: 100 })
    camera.position = [0, 0.4, 2]
    camera.target = [0, 0.4, 0]
    camera.updateViewMatrix()
    return camera
  }

  private createVertexData(model: GLTF) {
    const geometry = (model.scene.getObjectByName('bunny') as THREE.Mesh).geometry
    return WGU.createBuffersAndAttributesFromArrays(this.device, {
      position: geometry.attributes.position.array,
      normal: geometry.attributes.normal.array,
      indices: geometry.index!.array,
    })
  }

  private createUniformData() {
    const defs = WGU.makeShaderDataDefinitions(shader)
    const values = WGU.makeStructuredView(defs.uniforms.model)

    const modelMatrix = mat4.identity()
    const normalMatrix = mat4.transpose(mat4.inverse(modelMatrix))

    values.set({ modelMatrix, normalMatrix })

    const buffer = createUniformBuffer(this.device, values.arrayBuffer.byteLength)
    this.device.queue.writeBuffer(buffer, 0, values.arrayBuffer)
    return { buffer, values }
  }

  private createBindGroupLayout(minBindingSize?: number) {
    return this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform', minBindingSize },
        },
      ],
    })
  }

  private createBindGroup(layout: GPUBindGroupLayout, buffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: { buffer } }],
    })
  }

  private createRenderPipeline(bindGroupLayouts: GPUBindGroupLayout[], vertexBufferLayouts: GPUVertexBufferLayout[]) {
    const module = this.device.createShaderModule({ code: shader })

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: {
        module,
        buffers: vertexBufferLayouts,
      },
      fragment: {
        module,
        targets: [{ format: this.gpu.presentationFormat }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: this.scene.pipelineDepthStencilState,
      multisample: this.scene.pipleneMultisampleState,
    })
  }

  private updateCamera(dt: number) {
    mat4.mul(this.camera.viewMatrix, mat4.rotation([0, 1, 0], dt * 0.0005), this.camera.viewMatrix)
    this.camera.writeViewMatrixBuffer()
  }

  render(encoder: GPUCommandEncoder, dt: number) {
    this.scene.update(this.renderTarget)
    this.updateCamera(dt)

    const pass = encoder.beginRenderPass(this.scene.renderPassDescriptor)
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.camera.bindGroup)
    pass.setBindGroup(1, this.bindGroup)
    pass.setVertexBuffer(0, this.vertexData.buffers[0])
    pass.setIndexBuffer(this.vertexData.indexBuffer!, this.vertexData.indexFormat!)
    pass.drawIndexed(this.vertexData.numElements)
    pass.end()
  }

  resize() {
    this.scene.resize()
    this.camera.updateAspect(this.resolution.aspect)

    this.renderTarget?.destroy()
    this.renderTarget = this.createRenderTarget()
  }
}
