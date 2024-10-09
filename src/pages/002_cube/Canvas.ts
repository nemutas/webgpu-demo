import * as THREE from 'three'
import { CanvasBase } from '@scripts/webgpu/core/CanvasBase'
import { GPU } from '@scripts/webgpu/core/gpu'
import shader from './cube.wgsl'
import { PerspectiveCamera } from '@scripts/webgpu/object/PerspectiveCamera'
import { mat4 } from 'wgpu-matrix'
import { createIndexBuffer, createUniformBuffer, createVertexBuffer } from '@scripts/webgpu/common/bufferGenerator'
import { concatF32Arrays } from '@scripts/webgpu/common/utils'
import { RenderScene } from '@scripts/webgpu/object/RenderScene'

export class Canvas extends CanvasBase {
  private readonly camera: PerspectiveCamera
  private readonly scene: RenderScene

  constructor(gpu: GPU) {
    super(gpu)

    this.scene = new RenderScene(gpu)
    this.camera = new PerspectiveCamera(this.device, { fovDeg: 45, aspect: this.resolution.aspect, near: 0.01, far: 50 })

    // const geometry = new THREE.TorusGeometry(1, 0.3, 50, 100)
    const geometry = new THREE.BoxGeometry()
    const { position, normal, uv } = geometry.attributes
    const index = geometry.index!
    const vertexAttribute = concatF32Arrays(
      [position.array as Float32Array, normal.array as Float32Array, uv.array as Float32Array],
      [position.itemSize, normal.itemSize, uv.itemSize],
    )

    const vertexBuffer = createVertexBuffer(this.device, vertexAttribute.array)
    const vertexBufferLayout = this.createVertexBufferLayout(vertexAttribute.byteStride, vertexAttribute.byteOffsets)
    const indexBuffer = createIndexBuffer(this.device, index.array as Uint16Array)

    const vertexColorBuffer = this.createVertexColorBuffer(geometry.attributes.position.count)
    const vertexColorBufferLayout = this.createVertexColorBufferLayout()

    const localUniformBuffer = createUniformBuffer(this.device, 4 * 16 * 2)
    const localUniformBindGroupLayout = this.createUniformBindGroupLayout(localUniformBuffer.size)
    const localUniformBindGroup = this.createBindGroup(localUniformBindGroupLayout, localUniformBuffer)
    this.writeLocalMatrix(localUniformBuffer)

    const pipeline = this.createPipeline([this.camera.bindGroupLayout, localUniformBindGroupLayout], [vertexBufferLayout, vertexColorBufferLayout])

    this.render(pipeline, vertexBuffer, indexBuffer, index.count, localUniformBuffer, localUniformBindGroup, vertexColorBuffer)

    window.addEventListener('resize', this.resize.bind(this))
  }

  private createVertexBufferLayout(byteStride: number, byteOffsets: number[]): GPUVertexBufferLayout {
    return {
      arrayStride: byteStride,
      attributes: [
        { shaderLocation: 0, offset: byteOffsets[0], format: 'float32x3' },
        { shaderLocation: 1, offset: byteOffsets[1], format: 'float32x3' },
        { shaderLocation: 2, offset: byteOffsets[2], format: 'float32x2' },
      ],
    }
  }

  private createVertexColorBuffer(vertexCount: number) {
    const array = new Float32Array(4 * vertexCount)
    for (let i = 0; i < vertexCount; i++) {
      array[4 * i + 0] = Math.random()
      array[4 * i + 1] = Math.random()
      array[4 * i + 2] = Math.random()
      array[4 * i + 3] = 1
    }
    return createVertexBuffer(this.device, array)
  }

  private createVertexColorBufferLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: 4 * 4, // 4ch * 4byte
      attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x4' }],
    }
  }

  private createUniformBindGroupLayout(minBindingSize?: number) {
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

  private writeLocalMatrix(buffer: GPUBuffer, et = 0) {
    // update model matrix
    const modelMatrix = mat4.identity()
    mat4.translate(modelMatrix, [0, Math.sin(et), 0], modelMatrix)
    mat4.rotate(modelMatrix, [1, 0, 0], Math.PI / 4 + et, modelMatrix)
    mat4.rotate(modelMatrix, [0, 1, 0], Math.PI / 4 + et, modelMatrix)
    this.device.queue.writeBuffer(buffer, 0, modelMatrix.buffer, modelMatrix.byteOffset, modelMatrix.byteLength)

    // update normal matrix
    const normalMatrix = mat4.identity()
    mat4.transpose(mat4.inverse(modelMatrix), normalMatrix)
    this.device.queue.writeBuffer(buffer, 4 * 16, normalMatrix.buffer, normalMatrix.byteOffset, normalMatrix.byteLength)
  }

  private createPipeline(bindGroupLayouts: GPUBindGroupLayout[], vertexBufferLayouts: GPUVertexBufferLayout[]) {
    const module = this.device.createShaderModule({ code: shader })

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: { module, buffers: vertexBufferLayouts },
      fragment: { module, targets: [{ format: this.gpu.presentationFormat }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: this.scene.pipelineDepthStencilState,
      multisample: this.scene.pipleneMultisampleState,
    })
  }

  private render(
    pipeline: GPURenderPipeline,
    vertexBuffer: GPUBuffer,
    indexBuffer: GPUBuffer,
    vertexCount: number,
    localUniformBuffer: GPUBuffer,
    localUniformBindGroup: GPUBindGroup,
    vertexColorBuffer: GPUBuffer,
  ) {
    const { et } = this.clock.update()

    this.scene.update()
    this.writeLocalMatrix(localUniformBuffer, et * 1e-3)

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass(this.scene.renderPassDescriptor)
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(0, vertexBuffer)
    pass.setVertexBuffer(1, vertexColorBuffer)
    pass.setIndexBuffer(indexBuffer, 'uint16')
    pass.setBindGroup(0, this.camera.bindGroup)
    pass.setBindGroup(1, localUniformBindGroup)
    pass.drawIndexed(vertexCount)
    pass.end()

    this.device.queue.submit([encoder.finish()])

    requestAnimationFrame(
      this.render.bind(this, pipeline, vertexBuffer, indexBuffer, vertexCount, localUniformBuffer, localUniformBindGroup, vertexColorBuffer),
    )
  }

  private resize() {
    this.scene.resize()

    this.camera.aspect = this.resolution.aspect
    this.camera.updateProjectionMatrix()
  }
}
