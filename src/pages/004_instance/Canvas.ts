import * as THREE from 'three'
import { CanvasBase } from '@scripts/webgpu/core/CanvasBase'
import { GPU } from '@scripts/webgpu/core/gpu'
import * as WGU from 'webgpu-utils'
import { PerspectiveCamera } from '@scripts/webgpu/object/PerspectiveCamera'
import instaceShader from './instance.wgsl'
import { createStorageBuffer, createUniformBuffer } from '@scripts/webgpu/common/bufferGenerator'
import { mat4, Mat4 } from 'wgpu-matrix'
import { RenderScene } from '@scripts/webgpu/object/RenderScene'

export class Canvas extends CanvasBase {
  private readonly numInstances = 10000

  private readonly scene: RenderScene
  private readonly camera: PerspectiveCamera
  private readonly shader: { instance: string }

  private readonly modelStorageData: { values: WGU.StructuredView; buffer: GPUBuffer }
  private readonly modelUniformData: { values: WGU.StructuredView; buffer: GPUBuffer }

  constructor(gpu: GPU) {
    super(gpu)

    this.scene = new RenderScene(this.gpu)
    this.camera = this.createCamera()
    this.shader = this.getShader()

    const boxVertexData = this.createVertexData(new THREE.BoxGeometry())

    const defs = WGU.makeShaderDataDefinitions(this.shader.instance)
    const modelUniformValues = WGU.makeStructuredView(defs.uniforms.model)
    const modelUniformBuffer = this.createModelUniformBuffer(modelUniformValues)
    this.modelUniformData = { values: modelUniformValues, buffer: modelUniformBuffer }

    const modelStorageValues = WGU.makeStructuredView(defs.storages.instanced)
    const modelStorageBuffer = this.createModelStorageBuffer(modelStorageValues)
    this.modelStorageData = { values: modelStorageValues, buffer: modelStorageBuffer }

    const modelBindGroupLayout = this.createBindGroupLayout([modelUniformBuffer.size, modelStorageBuffer.size])
    const modelBindGroup = this.createBindGroup(modelBindGroupLayout, [modelUniformBuffer, modelStorageBuffer])

    const pipeline = this.createPipeline([this.camera.bindGroupLayout, modelBindGroupLayout], [...boxVertexData.bufferLayouts])

    this.render(pipeline, boxVertexData, modelBindGroup)
    window.addEventListener('resize', this.resize.bind(this))
  }

  private getShader() {
    return {
      instance: instaceShader.replaceAll('NUM_INSTANCES', this.numInstances.toString()),
    }
  }

  private createCamera() {
    const camera = new PerspectiveCamera(this.device, { fovDeg: 45, aspect: this.resolution.aspect, near: 1, far: 100 })
    camera.position[2] = -3
    camera.updateViewMatrix()
    return camera
  }

  private createVertexData(geometry: THREE.BufferGeometry) {
    return WGU.createBuffersAndAttributesFromArrays(this.device, {
      position: geometry.attributes.position.array,
      normal: geometry.attributes.normal.array,
      indices: geometry.index!.array,
    })
  }

  private createModelUniformBuffer(values: WGU.StructuredView) {
    const modelMatrix = mat4.identity()
    mat4.rotate(modelMatrix, [0, 1, 0], Math.PI * 0.25, modelMatrix)

    const normalMatrix = mat4.transpose(mat4.inverse(modelMatrix))

    values.set({ modelMatrix, normalMatrix })

    const buffer = createUniformBuffer(this.device, values.arrayBuffer.byteLength)
    this.device.queue.writeBuffer(buffer, 0, values.arrayBuffer)
    return buffer
  }

  private createModelStorageBuffer(values: WGU.StructuredView) {
    const instancedMatrix = new Array<Mat4>(this.numInstances)
    const r = () => Math.random() * 2 - 1

    for (let i = 0; i < this.numInstances; i++) {
      const mat = mat4.identity()
      mat4.translate(mat, [r() * 4, r() * 4, r() * 4], mat)
      mat4.rotate(mat, [r(), r(), r()], r() * Math.PI, mat)
      mat4.scale(mat, [0.1, 0.1, 0.1], mat)

      instancedMatrix[i] = mat
    }
    values.set({ matrix: instancedMatrix })

    const buffer = createStorageBuffer(this.device, values.arrayBuffer.byteLength)
    this.device.queue.writeBuffer(buffer, 0, values.arrayBuffer)
    return buffer
  }

  private createBindGroupLayout(minBindingSizes: number[]) {
    return this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform', minBindingSize: minBindingSizes[0] },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage', minBindingSize: minBindingSizes[1] },
        },
      ],
    })
  }

  private createBindGroup(layout: GPUBindGroupLayout, buffers: GPUBuffer[]) {
    return this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: buffers[0] } },
        { binding: 1, resource: { buffer: buffers[1] } },
      ],
    })
  }

  private createPipeline(bindGroupLayouts: GPUBindGroupLayout[], vertexBufferLayouts: GPUVertexBufferLayout[]) {
    const module = this.device.createShaderModule({ code: this.shader.instance })

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

  private updateModelUniformBuffer(dt: number) {
    const modelMatrix = this.modelUniformData.values.views.modelMatrix as Float32Array
    const normalMatrix = this.modelUniformData.values.views.normalMatrix as Float32Array

    mat4.rotate(modelMatrix, [0, 1, 0], dt * 0.0005, modelMatrix)
    normalMatrix.set(mat4.transpose(mat4.inverse(modelMatrix)))

    this.device.queue.writeBuffer(this.modelUniformData.buffer, 0, this.modelUniformData.values.arrayBuffer)
  }

  private updateModelStorageBuffer(dt: number) {
    const matrix = this.modelStorageData.values.views.matrix as Float32Array

    for (let i = 0; i < this.numInstances; i++) {
      const mat = matrix.subarray(i * 16, (i + 1) * 16)
      mat4.rotate(mat, [1, 1, 1], dt * 0.005, mat)
    }
    this.device.queue.writeBuffer(this.modelStorageData.buffer, 0, this.modelStorageData.values.arrayBuffer)
  }

  private render(pipeline: GPURenderPipeline, vertexData: WGU.BuffersAndAttributes, modelBindGroup: GPUBindGroup) {
    const { dt } = this.clock.update()
    this.updateModelUniformBuffer(dt)
    this.updateModelStorageBuffer(dt)

    this.scene.update()

    const encoder = this.device.createCommandEncoder()

    const pass = encoder.beginRenderPass(this.scene.renderPassDescriptor)
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(0, vertexData.buffers[0])
    pass.setIndexBuffer(vertexData.indexBuffer!, vertexData.indexFormat!)
    pass.setBindGroup(0, this.camera.bindGroup)
    pass.setBindGroup(1, modelBindGroup)
    pass.drawIndexed(vertexData.numElements, this.numInstances)
    pass.end()

    this.device.queue.submit([encoder.finish()])

    requestAnimationFrame(this.render.bind(this, pipeline, vertexData, modelBindGroup))
  }

  private resize() {
    this.scene.resize()

    this.camera.aspect = this.resolution.aspect
    this.camera.updateProjectionMatrix()
  }
}
