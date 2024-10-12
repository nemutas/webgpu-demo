import * as THREE from 'three'
import { CanvasBase } from '@scripts/webgpu/core/CanvasBase'
import { GPU } from '@scripts/webgpu/core/gpu'
import * as WGU from 'webgpu-utils'
import { PerspectiveCamera } from '@scripts/webgpu/object/PerspectiveCamera'
import instaceShader from './instance.wgsl'
import { createUniformBuffer } from '@scripts/webgpu/common/bufferGenerator'
import { mat4 } from 'wgpu-matrix'
import { RenderScene } from '@scripts/webgpu/object/RenderScene'
import { Compute } from './Compute'
import { pane } from '@scripts/Gui'

export class Canvas extends CanvasBase {
  private readonly scene: RenderScene
  private readonly camera: PerspectiveCamera
  private readonly shader: string

  private readonly modelUniformData: { values: WGU.StructuredView; buffer: GPUBuffer }

  private readonly compute: Compute

  constructor(gpu: GPU) {
    super(gpu)

    this.compute = new Compute(this.device, 100000) // request instances size

    this.scene = new RenderScene(this.gpu)
    this.camera = this.createCamera()
    this.shader = instaceShader.replaceAll('NUM_INSTANCES', this.compute.numInstances.toFixed(0))

    const boxVertexData = this.createVertexData(new THREE.BoxGeometry())

    const defs = WGU.makeShaderDataDefinitions(this.shader)
    const modelUniformValues = WGU.makeStructuredView(defs.uniforms.model)
    const modelUniformBuffer = this.createModelUniformBuffer(modelUniformValues)
    this.modelUniformData = { values: modelUniformValues, buffer: modelUniformBuffer }

    const modelBindGroupLayout = this.createBindGroupLayout([modelUniformBuffer.size, this.compute.buffer.size])
    const modelBindGroup = this.createBindGroup(modelBindGroupLayout, [modelUniformBuffer, this.compute.buffer])

    const pipeline = this.createPipeline([this.camera.bindGroupLayout, modelBindGroupLayout], [...boxVertexData.bufferLayouts])

    this.render(pipeline, boxVertexData, modelBindGroup)
    window.addEventListener('resize', this.resize.bind(this))
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
    const module = this.device.createShaderModule({ code: this.shader })

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

  private render(pipeline: GPURenderPipeline, vertexData: WGU.BuffersAndAttributes, modelBindGroup: GPUBindGroup) {
    pane.updateFps()

    this.scene.update()

    const { dt } = this.clock.update()
    this.updateModelUniformBuffer(dt)

    const encoder = this.device.createCommandEncoder()

    this.compute.render(encoder, dt)

    const pass = encoder.beginRenderPass(this.scene.renderPassDescriptor)
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(0, vertexData.buffers[0])
    pass.setIndexBuffer(vertexData.indexBuffer!, vertexData.indexFormat!)
    pass.setBindGroup(0, this.camera.bindGroup)
    pass.setBindGroup(1, modelBindGroup)
    pass.drawIndexed(vertexData.numElements, this.compute.numInstances)
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
