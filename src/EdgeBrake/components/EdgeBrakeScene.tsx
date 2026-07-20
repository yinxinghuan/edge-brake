import { ContactShadows, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CHARACTER_BY_ID } from '../characters'
import type { CharacterId, GamePhase, Rating, WeatherKind } from '../types'

const C = {
  ink: '#17272d',
  cream: '#f5f0dd',
  orange: '#f3a83b',
  snow: '#eaf9f7',
  ice: '#5caeb7',
  iceDark: '#2f7482',
  water: '#0b2030',
  teal: '#3fb6ac',
  gold: '#ffd166',
}

const screenToWorld = (px: number) => (px - 195) / 36

Object.values(CHARACTER_BY_ID).forEach(spec => {
  if (spec.modelUrl) useGLTF.preload(spec.modelUrl)
})

function material(color: string, emissive?: string) {
  return <meshStandardMaterial color={color} flatShading roughness={0.88} metalness={0} emissive={emissive} emissiveIntensity={emissive ? 0.55 : 0} />
}

function FollowCamera({ x, cliffX, phase }: { x: number; cliffX: number; phase: GamePhase }) {
  const { camera: threeCamera, size } = useThree()
  const camera = threeCamera as THREE.OrthographicCamera
  const renderScale = Math.min(size.width / 390, size.height / 700)
  const cameraPositionRef = useRef(new THREE.Vector3(-5.4, 6.8, 9.6))
  const lookXRef = useRef(screenToWorld(x + 29))
  const lookYRef = useRef(1.12)
  const fallStartRef = useRef<number | null>(null)
  const readyStartRef = useRef<number | null>(null)
  const readyFromPositionRef = useRef(new THREE.Vector3())
  const readyFromLookXRef = useRef(0)
  const readyFromLookYRef = useRef(0)
  const readyFromZoomRef = useRef(64)
  const overviewPositionRef = useRef(new THREE.Vector3())
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    if (phase !== 'cover') return
    const heroX = screenToWorld(x + 29)
    cameraPositionRef.current.set(heroX - 2.1, 6.8, 9.6)
    lookXRef.current = heroX + 0.12
    lookYRef.current = 1.12
  }, [phase, x])

  useEffect(() => {
    if (phase === 'falling') fallStartRef.current = performance.now()
    else if (phase !== 'gameover') fallStartRef.current = null
  }, [phase])

  useEffect(() => {
    if (phase === 'ready') {
      readyStartRef.current = performance.now()
      readyFromPositionRef.current.copy(cameraPositionRef.current)
      readyFromLookXRef.current = lookXRef.current
      readyFromLookYRef.current = lookYRef.current
      readyFromZoomRef.current = camera.zoom
    } else {
      readyStartRef.current = null
    }
  }, [camera, phase])

  useFrame((state, delta) => {
    if (phase === 'cover') {
      const heroX = screenToWorld(x + 29)
      const drift = reduceMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.62) * 0.16
      cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, heroX - 2.1 + drift, 3.2, delta)
      cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, 6.8, 3.2, delta)
      cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, 9.6 - drift * 0.45, 3.2, delta)
      lookXRef.current = THREE.MathUtils.damp(lookXRef.current, heroX + 0.12, 4, delta)
      lookYRef.current = THREE.MathUtils.damp(lookYRef.current, 1.12, 4, delta)
      camera.zoom = THREE.MathUtils.damp(camera.zoom, 64 * renderScale, 4, delta)
    } else {
      const characterX = screenToWorld(x + 29)
      const resetting = phase === 'result'
      const danger = resetting || phase === 'ready' ? 0 : THREE.MathUtils.clamp((x + 49 - 40) / Math.max(1, cliffX - 40), 0, 1)
      const tension = THREE.MathUtils.smoothstep(danger, 0.15, 0.98)
      const startCharacterX = screenToWorld(40 + 29)
      const trackCenter = (startCharacterX + screenToWorld(cliffX)) / 2
      const falling = phase === 'falling' || phase === 'gameover'
      const fallProgress = fallStartRef.current === null ? 0 : Math.min((performance.now() - fallStartRef.current) / 650, 1)
      const cameraResponse = falling ? 8.4 : 6.2

      if (phase === 'ready' && readyStartRef.current !== null) {
        const pullback = reduceMotion ? 1 : THREE.MathUtils.clamp((performance.now() - readyStartRef.current) / 780, 0, 1)
        const eased = 1 - Math.pow(1 - pullback, 3)
        overviewPositionRef.current.set(trackCenter - 3.2, 12.8, 19)
        cameraPositionRef.current.lerpVectors(readyFromPositionRef.current, overviewPositionRef.current, eased)
        lookXRef.current = THREE.MathUtils.lerp(readyFromLookXRef.current, trackCenter, eased)
        lookYRef.current = THREE.MathUtils.lerp(readyFromLookYRef.current, 0.05, eased)
        camera.zoom = THREE.MathUtils.lerp(readyFromZoomRef.current, 16.5 * renderScale, eased)
      } else if (falling) {
        cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, characterX + 3.6, cameraResponse, delta)
        cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, 4.2 - fallProgress * 0.45, cameraResponse, delta)
        cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, 4, cameraResponse, delta)
        lookXRef.current = THREE.MathUtils.damp(lookXRef.current, characterX, cameraResponse, delta)
        lookYRef.current = THREE.MathUtils.damp(lookYRef.current, 0.7 - fallProgress * 1.5, cameraResponse, delta)
        camera.zoom = THREE.MathUtils.damp(camera.zoom, 78 * renderScale, cameraResponse, delta)
      } else {
        const targetCameraX = THREE.MathUtils.lerp(trackCenter - 3.2, characterX + 2.8, tension)
        const targetLookX = THREE.MathUtils.lerp(trackCenter, characterX, tension)
        cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, targetCameraX, cameraResponse, delta)
        cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, THREE.MathUtils.lerp(12.8, 5, tension), cameraResponse, delta)
        cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, THREE.MathUtils.lerp(19, 5.2, tension), cameraResponse, delta)
        lookXRef.current = THREE.MathUtils.damp(lookXRef.current, targetLookX, cameraResponse, delta)
        lookYRef.current = THREE.MathUtils.damp(lookYRef.current, THREE.MathUtils.lerp(0.05, 0.72, tension), cameraResponse, delta)
        camera.zoom = THREE.MathUtils.damp(camera.zoom, THREE.MathUtils.lerp(16.5, 68, tension) * renderScale, cameraResponse, delta)
      }
    }

    camera.position.copy(cameraPositionRef.current)
    camera.lookAt(lookXRef.current, lookYRef.current, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  })

  return null
}

function AssetCharacter({ id, x, braking, phase, velocity }: { id: CharacterId; x: number; braking: boolean; phase: GamePhase; velocity: number }) {
  const spec = CHARACTER_BY_ID[id]
  const gltf = useGLTF(spec.modelUrl!)
  const prepared = useMemo(() => {
    const copy = gltf.scene.clone(true)
    const pivots: THREE.Object3D[] = []
    const modelRoot = copy.children.find(child => child.type === 'Group') ?? copy
    modelRoot.updateMatrixWorld(true)
    if (spec.kind === 'person') {
      const bounds = new THREE.Box3().setFromObject(modelRoot)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const legL = new THREE.Group()
      const legR = new THREE.Group()
      const armL = new THREE.Group()
      const armR = new THREE.Group()
      legL.position.set(center.x - size.x * 0.16, bounds.min.y + size.y * 0.42, center.z)
      legR.position.set(center.x + size.x * 0.16, bounds.min.y + size.y * 0.42, center.z)
      armL.position.set(center.x - size.x * 0.46, bounds.min.y + size.y * 0.7, center.z)
      armR.position.set(center.x + size.x * 0.46, bounds.min.y + size.y * 0.7, center.z)
      modelRoot.add(legL, legR, armL, armR)
      modelRoot.updateMatrixWorld(true)
      const meshes = modelRoot.children.filter(child => child instanceof THREE.Mesh) as THREE.Mesh[]
      for (const mesh of meshes) {
        const meshCenter = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
        const low = meshCenter.y < bounds.min.y + size.y * 0.43
        const outside = Math.abs(meshCenter.x - center.x) > size.x * 0.35
        if (low && Math.abs(meshCenter.x - center.x) > size.x * 0.06) (meshCenter.x < center.x ? legL : legR).attach(mesh)
        else if (outside && meshCenter.y < bounds.min.y + size.y * 0.76) (meshCenter.x < center.x ? armL : armR).attach(mesh)
      }
      pivots.push(legL, legR, armL, armR)
    } else {
      const bounds = new THREE.Box3().setFromObject(modelRoot)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const feet = [
        new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group(),
      ]
      const footPositions = [
        [center.x - size.x * 0.24, bounds.min.y + size.y * 0.3, center.z - size.z * 0.24],
        [center.x + size.x * 0.24, bounds.min.y + size.y * 0.3, center.z - size.z * 0.24],
        [center.x - size.x * 0.24, bounds.min.y + size.y * 0.3, center.z + size.z * 0.24],
        [center.x + size.x * 0.24, bounds.min.y + size.y * 0.3, center.z + size.z * 0.24],
      ]
      feet.forEach((foot, index) => foot.position.set(...footPositions[index] as [number, number, number]))
      modelRoot.add(...feet)
      modelRoot.updateMatrixWorld(true)
      const lowMeshes = modelRoot.children.filter(child => child instanceof THREE.Mesh).filter(mesh => {
        const meshCenter = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
        return meshCenter.y < bounds.min.y + size.y * 0.43
      }) as THREE.Mesh[]
      lowMeshes.forEach(mesh => {
        const meshCenter = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
        let closest = 0
        let closestDistance = Infinity
        footPositions.forEach((position, index) => {
          const distance = meshCenter.distanceTo(new THREE.Vector3(...position as [number, number, number]))
          if (distance < closestDistance) { closest = index; closestDistance = distance }
        })
        feet[closest].attach(mesh)
      })
      pivots.push(...feet)
    }
    return { copy, pivots }
  }, [gltf.scene, spec.kind])
  const clone = prepared.copy
  const group = useRef<THREE.Group>(null)
  const pose = useRef<THREE.Group>(null)
  const fallStart = useRef<number | null>(null)
  const phaseStart = useRef(performance.now())
  const brakeStart = useRef<number | null>(null)
  const rig = prepared.pivots

  useEffect(() => {
    clone.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
  }, [clone])

  useEffect(() => {
    phaseStart.current = performance.now()
    if (phase === 'falling') fallStart.current = performance.now()
    if (phase === 'ready' || phase === 'playing') fallStart.current = null
  }, [phase])

  useEffect(() => {
    brakeStart.current = braking ? performance.now() : null
  }, [braking])

  useFrame((state, delta) => {
    if (!group.current || !pose.current) return
    const targetX = screenToWorld(x + 29)
    const time = state.clock.elapsedTime
    const phaseAge = (performance.now() - phaseStart.current) / 1000
    const brakeAge = brakeStart.current === null ? 0 : (performance.now() - brakeStart.current) / 1000
    const moving = phase === 'playing' && !braking
    const idle = phase === 'cover' || phase === 'result'
    const falling = phase === 'falling' || phase === 'gameover'
    const strideRaw = moving ? Math.sin(time * (5.8 + velocity * 0.038)) : 0
    const stride = Math.sign(strideRaw) * Math.pow(Math.abs(strideRaw), 0.68)
    const breath = (Math.sin(time * Math.PI * 1.6) + 1) * 0.5
    const readyAction = phase === 'ready' ? THREE.MathUtils.clamp((phaseAge - 0.96) / 0.44, 0, 1) : 0
    const readyCrouch = Math.sin(readyAction * Math.PI)
    const brakePunch = braking ? Math.min(brakeAge / 0.18, 1) : 0
    const bounce = idle ? breath * 0.035 : moving ? Math.abs(strideRaw) * 0.065 : 0
    const baseScale = spec.scale

    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 28, delta)
    if (falling && fallStart.current !== null) {
      const elapsed = Math.min((performance.now() - fallStart.current) / 650, 1)
      group.current.position.y = 0.38 - elapsed * elapsed * 5.4
      group.current.rotation.z = THREE.MathUtils.lerp(0.08, -1.35, elapsed)
      group.current.rotation.x = THREE.MathUtils.lerp(0, 1.05, elapsed)
      group.current.rotation.y = THREE.MathUtils.lerp(Math.PI / 2, Math.PI / 2 + 0.62, elapsed)
      group.current.scale.setScalar(baseScale * (1 - elapsed * 0.16))
    } else {
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, 0.38, 18, delta)
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, braking ? 0.38 * brakePunch : moving ? -0.07 : 0, 15, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, braking ? -0.16 * brakePunch : moving ? -0.08 : 0, 15, delta)
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, Math.PI / 2, 18, delta)
      group.current.scale.setScalar(baseScale)
    }

    pose.current.position.y = THREE.MathUtils.damp(pose.current.position.y, bounce - readyCrouch * 0.1 - (braking ? 0.08 : 0), 18, delta)
    pose.current.rotation.z = THREE.MathUtils.damp(pose.current.rotation.z, falling ? 0.2 : phase === 'ready' ? -0.12 * readyCrouch : braking ? 0.18 : moving ? -0.05 : Math.sin(time * 2.2) * 0.018, 16, delta)
    pose.current.rotation.y = THREE.MathUtils.damp(pose.current.rotation.y, moving ? stride * 0.055 : idle ? Math.sin(time * 1.8) * 0.025 : 0, 14, delta)
    const verticalScale = 1 + breath * (idle ? 0.025 : 0) - readyCrouch * 0.085 - (braking ? 0.07 : 0)
    pose.current.scale.set(1 + readyCrouch * 0.035, verticalScale, 1)

    if (rig.length >= 4) {
      if (spec.kind === 'person') {
        const pushLeft = moving ? Math.max(0, stride) : 0
        const pushRight = moving ? Math.max(0, -stride) : 0
        const legAction = phase === 'ready' ? readyCrouch * 0.34 : 0
        const armCounter = moving ? stride * 0.26 : idle ? Math.sin(time * 1.8) * 0.08 : 0
        rig[0].rotation.x = THREE.MathUtils.damp(rig[0].rotation.x, falling ? 0.92 : braking ? 0.78 : legAction - pushLeft * 0.72, 20, delta)
        rig[1].rotation.x = THREE.MathUtils.damp(rig[1].rotation.x, falling ? -0.82 : braking ? 0.34 : -legAction - pushRight * 0.72, 20, delta)
        rig[2].rotation.x = THREE.MathUtils.damp(rig[2].rotation.x, falling ? -1.05 : braking ? -0.74 : -armCounter, 20, delta)
        rig[3].rotation.x = THREE.MathUtils.damp(rig[3].rotation.x, falling ? 0.92 : braking ? -0.74 : armCounter, 20, delta)
        rig[0].rotation.z = THREE.MathUtils.damp(rig[0].rotation.z, falling ? -0.62 : braking ? -0.58 : -pushLeft * 0.48, 18, delta)
        rig[1].rotation.z = THREE.MathUtils.damp(rig[1].rotation.z, falling ? 0.62 : braking ? 0.58 : pushRight * 0.48, 18, delta)
        rig[2].rotation.z = THREE.MathUtils.damp(rig[2].rotation.z, falling ? -1.28 : braking ? -1.08 : -0.52 - Math.abs(armCounter), 18, delta)
        rig[3].rotation.z = THREE.MathUtils.damp(rig[3].rotation.z, falling ? 1.28 : braking ? 1.08 : 0.52 + Math.abs(armCounter), 18, delta)
      } else {
        const diagonal = moving ? stride * 0.52 : phase === 'ready' ? readyCrouch * 0.24 : 0
        ;[0, 3].forEach(index => { rig[index].rotation.x = THREE.MathUtils.damp(rig[index].rotation.x, falling ? 0.9 : braking ? 0.62 : diagonal, 20, delta) })
        ;[1, 2].forEach(index => { rig[index].rotation.x = THREE.MathUtils.damp(rig[index].rotation.x, falling ? -0.9 : braking ? -0.36 : -diagonal, 20, delta) })
        rig.forEach((limb, index) => {
          const side = index % 2 === 0 ? -1 : 1
          limb.rotation.z = THREE.MathUtils.damp(limb.rotation.z, falling ? side * 0.72 : braking ? side * 0.46 : side * Math.abs(diagonal) * 0.22, 18, delta)
        })
      }
    }
  })

  return (
    <group ref={group} position={[screenToWorld(x + 29), 0.38, 0.12]} rotation={[0, Math.PI / 2, 0]}>
      <group ref={pose}>
        <primitive object={clone} />
      </group>
    </group>
  )
}

function LowPolyPenguin({ x, braking, phase, velocity }: { x: number; braking: boolean; phase: GamePhase; velocity: number }) {
  const group = useRef<THREE.Group>(null)
  const wingBack = useRef<THREE.Mesh>(null)
  const wingFront = useRef<THREE.Mesh>(null)
  const footBack = useRef<THREE.Mesh>(null)
  const footFront = useRef<THREE.Mesh>(null)
  const fallStart = useRef<number | null>(null)
  const phaseStart = useRef(performance.now())
  const brakeStart = useRef<number | null>(null)
  const falling = phase === 'falling' || phase === 'gameover'

  useEffect(() => {
    phaseStart.current = performance.now()
    if (phase === 'falling') fallStart.current = performance.now()
    if (phase === 'ready' || phase === 'playing') fallStart.current = null
  }, [phase])

  useEffect(() => {
    brakeStart.current = braking ? performance.now() : null
  }, [braking])

  useFrame((state, delta) => {
    if (!group.current) return
    const targetX = screenToWorld(x + 29)
    const time = state.clock.elapsedTime
    const phaseAge = (performance.now() - phaseStart.current) / 1000
    const brakeAge = brakeStart.current === null ? 0 : (performance.now() - brakeStart.current) / 1000
    const idle = phase === 'cover' || phase === 'result'
    const moving = phase === 'playing' && !braking
    const rhythmRaw = Math.sin(time * (moving ? 5.8 + velocity * 0.038 : Math.PI * 1.6))
    const rhythm = Math.sign(rhythmRaw) * Math.pow(Math.abs(rhythmRaw), 0.68)
    const breath = (Math.sin(time * Math.PI * 1.6) + 1) * 0.5
    const readyAction = phase === 'ready' ? THREE.MathUtils.clamp((phaseAge - 0.96) / 0.44, 0, 1) : 0
    const readyCrouch = Math.sin(readyAction * Math.PI)
    const brakePunch = braking ? Math.min(brakeAge / 0.18, 1) : 0
    const bounce = idle ? breath * 0.055 : moving ? Math.abs(rhythmRaw) * 0.075 : 0
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 28, delta)
    if (falling && fallStart.current !== null) {
      const elapsed = Math.min((performance.now() - fallStart.current) / 650, 1)
      group.current.position.y = 0.44 - elapsed * elapsed * 5.2
      group.current.rotation.z = THREE.MathUtils.lerp(0.08, -1.42, elapsed)
      group.current.rotation.x = THREE.MathUtils.lerp(0, 0.94, elapsed)
      group.current.rotation.y = THREE.MathUtils.lerp(0, 0.58, elapsed)
    } else {
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, 0.44 + bounce - readyCrouch * 0.11 - (braking ? 0.07 : 0), 18, delta)
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, braking ? 0.3 * brakePunch : moving ? -0.08 : -0.025 + Math.sin(time * 2.1) * 0.018, 18, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0, 18, delta)
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, moving ? rhythm * 0.075 : idle ? Math.sin(time * 1.7) * 0.035 : 0, 14, delta)
      group.current.scale.x = THREE.MathUtils.damp(group.current.scale.x, 1 + readyCrouch * 0.06, 18, delta)
      group.current.scale.y = THREE.MathUtils.damp(group.current.scale.y, braking ? 0.9 : 1 + breath * (idle ? 0.025 : 0) - readyCrouch * 0.11, 18, delta)
      group.current.scale.z = THREE.MathUtils.damp(group.current.scale.z, 1, 18, delta)
    }

    if (wingBack.current && wingFront.current && footBack.current && footFront.current) {
      const wingSwing = moving ? rhythm * 0.42 : idle ? Math.sin(time * 1.9) * 0.12 : readyCrouch * 0.2
      wingBack.current.rotation.z = THREE.MathUtils.damp(wingBack.current.rotation.z, falling ? 1.38 : braking ? 1.18 : 0.56 + wingSwing, 20, delta)
      wingFront.current.rotation.z = THREE.MathUtils.damp(wingFront.current.rotation.z, falling ? -1.38 : braking ? -1.18 : -0.56 - wingSwing, 20, delta)
      footBack.current.position.x = THREE.MathUtils.damp(footBack.current.position.x, falling ? -0.62 : -0.24 + (moving ? Math.max(0, rhythm) * -0.34 : braking ? -0.2 : 0), 22, delta)
      footFront.current.position.x = THREE.MathUtils.damp(footFront.current.position.x, falling ? 0.72 : 0.34 + (moving ? Math.max(0, -rhythm) * -0.34 : braking ? 0.36 : 0), 22, delta)
      footBack.current.rotation.z = THREE.MathUtils.damp(footBack.current.rotation.z, falling ? -0.72 : moving ? -Math.max(0, rhythm) * 0.38 : braking ? -0.42 : 0, 20, delta)
      footFront.current.rotation.z = THREE.MathUtils.damp(footFront.current.rotation.z, falling ? 0.72 : moving ? Math.max(0, -rhythm) * 0.38 : braking ? 0.48 : 0, 20, delta)
    }
  })

  return (
    <group ref={group} position={[screenToWorld(x + 29), 0.44, 0.12]}>
      <mesh castShadow position={[0, 0.74, 0]} scale={[0.78, 1.05, 0.68]}>
        <icosahedronGeometry args={[0.72, 0]} />
        {material(C.ink)}
      </mesh>
      <mesh castShadow position={[0.08, 0.68, 0.48]} scale={[0.55, 0.76, 0.16]}>
        <icosahedronGeometry args={[0.62, 0]} />
        {material(C.cream)}
      </mesh>
      <mesh castShadow position={[0.62, 0.99, 0.25]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.17, 0.42, 4]} />
        {material(C.orange)}
      </mesh>
      <mesh position={[0.35, 1.18, 0.56]}>
        <icosahedronGeometry args={[0.075, 0]} />
        {material('#f7fbf6')}
      </mesh>
      <mesh position={[0.37, 1.18, 0.62]}>
        <icosahedronGeometry args={[0.035, 0]} />
        {material('#102129')}
      </mesh>
      <mesh ref={wingBack} castShadow position={[-0.1, 0.67, -0.55]} rotation={[0.1, 0, 0.28]} scale={[0.52, 0.18, 0.18]}>
        <coneGeometry args={[0.32, 0.9, 5]} />
        {material(C.ink)}
      </mesh>
      <mesh ref={wingFront} castShadow position={[-0.02, 0.63, 0.58]} rotation={[-0.1, 0, -0.28]} scale={[0.52, 0.18, 0.18]}>
        <coneGeometry args={[0.32, 0.9, 5]} />
        {material(C.ink)}
      </mesh>
      <mesh ref={footBack} castShadow position={[-0.24, 0.05, 0.24]} scale={[0.5, 0.13, 0.28]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.orange)}
      </mesh>
      <mesh ref={footFront} castShadow position={[0.34, 0.05, 0.24]} scale={[0.5, 0.13, 0.28]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.orange)}
      </mesh>
    </group>
  )
}

function SnowSpray({ x, active }: { x: number; active: boolean }) {
  const group = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const seeds = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    x: -0.2 - (i % 3) * 0.2,
    y: 0.12 + (i % 4) * 0.13,
    z: -0.4 + (i % 5) * 0.2,
    scale: 0.06 + (i % 3) * 0.025,
  })), [])

  useFrame((_, delta) => {
    if (!group.current || !active) return
    phase.current += delta * 4.5
    group.current.children.forEach((child, i) => {
      const p = (phase.current + i * 0.13) % 1
      child.position.x = -p * (0.65 + (i % 3) * 0.2)
      child.position.y = seeds[i].y + Math.sin(p * Math.PI) * 0.5
      child.scale.setScalar(seeds[i].scale * (1 - p * 0.45))
    })
  })

  if (!active) return null
  return (
    <group ref={group} position={[screenToWorld(x + 10), 0.36, 0.1]}>
      {seeds.map((seed, i) => (
        <mesh key={i} position={[seed.x, seed.y, seed.z]} scale={seed.scale}>
          <icosahedronGeometry args={[1, 0]} />
          {material(C.snow)}
        </mesh>
      ))}
    </group>
  )
}

function Atmosphere({ weather }: { weather: WeatherKind }) {
  const { scene } = useThree()
  const clear = useMemo(() => new THREE.Color('#10263b'), [])
  const overcast = useMemo(() => new THREE.Color(weather === 'blizzard' ? '#667d89' : weather === 'fog' ? '#738894' : '#3b5668'), [weather])

  useEffect(() => {
    if (!(scene.fog instanceof THREE.Fog)) scene.fog = new THREE.Fog(clear, 12, 28)
  }, [clear, scene])

  useFrame((_, delta) => {
    const fog = scene.fog as THREE.Fog
    const active = weather === 'clear' ? 0 : weather === 'snow' ? 0.24 : weather === 'fog' ? 0.62 : 0.52
    const targetColor = clear.clone().lerp(overcast, active)
    if (!(scene.background instanceof THREE.Color)) scene.background = clear.clone()
    scene.background.lerp(targetColor, 1 - Math.exp(-delta * 1.6))
    fog.color.lerp(targetColor, 1 - Math.exp(-delta * 1.6))
    fog.near = THREE.MathUtils.damp(fog.near, weather === 'fog' ? 8.5 : weather === 'blizzard' ? 10 : 12, 2.4, delta)
    fog.far = THREE.MathUtils.damp(fog.far, weather === 'fog' ? 19 : weather === 'blizzard' ? 21 : 28, 2.4, delta)
  })

  return null
}

function WeatherFx({ weather, x }: { weather: WeatherKind; x: number }) {
  const points = useRef<THREE.Points>(null)
  const weatherMaterial = useRef<THREE.PointsMaterial>(null)
  const count = weather === 'blizzard' ? 180 : 120
  const seeds = useMemo(() => Array.from({ length: count }, (_, index) => ({
    x: ((index * 47) % 180) / 10 - 9,
    y: ((index * 71) % 110) / 10,
    z: ((index * 31) % 160) / 10 - 8,
    speed: 0.8 + (index % 7) * 0.11,
  })), [count])
  const positions = useMemo(() => new Float32Array(count * 3), [count])

  useFrame((state, delta) => {
    if (!points.current || weather === 'clear' || weather === 'fog') return
    if (weatherMaterial.current) weatherMaterial.current.opacity = THREE.MathUtils.damp(weatherMaterial.current.opacity, weather === 'blizzard' ? 0.82 : 0.68, 3.6, delta)
    const time = state.clock.elapsedTime
    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index]
      seed.y -= seed.speed * delta * (weather === 'blizzard' ? 2.1 : 1)
      seed.x -= delta * (weather === 'blizzard' ? 3.8 : 0.42)
      if (seed.y < 0) seed.y += 11
      if (seed.x < -9) seed.x += 18
      positions[index * 3] = seed.x + Math.sin(time * 1.1 + index) * (weather === 'blizzard' ? 0.12 : 0.46)
      positions[index * 3 + 1] = seed.y
      positions[index * 3 + 2] = seed.z + Math.cos(time * 0.8 + index) * 0.25
    }
    const positionAttribute = points.current.geometry.getAttribute('position') as THREE.BufferAttribute
    positionAttribute.needsUpdate = true
  })

  if (weather === 'clear' || weather === 'fog') return null
  return (
    <points ref={points} position={[screenToWorld(x + 29), 0, 0]} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={weatherMaterial} color="#f4fbf8" size={weather === 'blizzard' ? 0.09 : 0.075} transparent opacity={0} sizeAttenuation />
    </points>
  )
}

function IcePlatform({ cliffX, rating }: { cliffX: number; rating: Rating | null }) {
  const left = -5.45
  const edge = screenToWorld(cliffX)
  const width = edge - left
  const center = left + width / 2
  return (
    <group>
      <mesh castShadow receiveShadow position={[center - 0.12, -0.38, 0.18]} scale={[width + 0.16, 1.3, 4.5]}>
        <boxGeometry args={[1, 1, 1]} />
        {material('#397f8d')}
      </mesh>
      <mesh castShadow receiveShadow position={[center - 0.04, 0.02, -0.04]} scale={[width + 0.08, 0.72, 4.36]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.ice)}
      </mesh>
      <mesh castShadow receiveShadow position={[center - 0.14, 0.41, 0]} scale={[Math.max(1, width - 0.28), 0.12, 4.25]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.snow)}
      </mesh>
      {[
        { from: 0.04, to: 0.3, color: '#e7f7f3' },
        { from: 0.3, to: 0.68, color: '#c9ebe7' },
        { from: 0.68, to: 0.94, color: '#d9f2ee' },
      ].map(zone => (
        <mesh key={zone.from} receiveShadow position={[left + width * ((zone.from + zone.to) / 2), 0.486, 0]} scale={[Math.max(0.8, width * (zone.to - zone.from) - 0.08), 0.026, 3.82]}>
          <boxGeometry args={[1, 1, 1]} />
          {material(zone.color)}
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, index) => {
        const ratio = 0.1 + index * 0.07
        return (
          <mesh key={`speed-mark-${index}`} position={[left + width * ratio, 0.512, -1.25 + (index % 4) * 0.8]} rotation={[0, -0.08, 0]} scale={[0.18 + ratio * 0.22, 0.018, 0.035]}>
            <boxGeometry args={[1, 1, 1]} />
            {material(index > 7 ? '#438b95' : '#68aeb3')}
          </mesh>
        )
      })}
      {[-1.72, -0.86, 0, 0.86, 1.72].map((z, index) => {
        const offsets = [0.08, 0.25, 0.02, 0.3, 0.12]
        return (
          <mesh key={`snow-cap-${z}`} receiveShadow position={[edge - 0.5 + offsets[index], 0.41, z]} scale={[0.76, 0.13, 0.8]}>
            <boxGeometry args={[1, 1, 1]} />
            {material(index % 2 ? '#f5fbf7' : C.snow)}
          </mesh>
        )
      })}
      <mesh position={[edge + 0.02, -0.2, 0]} scale={[0.12, 1.28, 4.28]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(rating === 'edge' ? C.gold : '#dff7f3', rating === 'edge' ? C.gold : undefined)}
      </mesh>
      <mesh receiveShadow position={[edge - 0.34, 0.485, 0]} scale={[0.62, 0.035, 4.2]}>
        <boxGeometry args={[1, 1, 1]} />
        {material('#c9efea')}
      </mesh>
      {[-1.86, -0.64, 0.72, 1.74].map((z, index) => (
        <mesh key={`edge-${z}`} castShadow position={[edge + 0.05 + (index % 2) * 0.06, -0.32 - (index % 3) * 0.08, z]} scale={[0.19, 1.16 - index * 0.07, 0.9]}>
          <boxGeometry args={[1, 1, 1]} />
          {material(index % 2 ? '#2f7482' : C.iceDark)}
        </mesh>
      ))}
      {[-0.42, -0.78].map((y, index) => (
        <mesh key={y} position={[center + 0.15, y, 2.28]} scale={[Math.max(1, width - 0.8), 0.075, 0.06]}>
          <boxGeometry args={[1, 1, 1]} />
          {material(index ? '#255f70' : '#6ab0b6')}
        </mesh>
      ))}
      {[-2.4, -1.15, 0.25, 1.45, 2.35].map((z, index) => (
        <mesh key={`icicle-${z}`} castShadow position={[edge + 0.08, -1.05 - (index % 2) * 0.16, z]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.12 + (index % 3) * 0.025, 0.65 + (index % 2) * 0.28, 6]} />
          {material(index % 2 ? '#72bcc1' : '#a9dcd8')}
        </mesh>
      ))}
      {[0.22, 0.52, 0.74].map((ratio, index) => (
        <mesh key={`crack-${ratio}`} position={[left + width * ratio, 0.485, -0.35 + index * 0.72]} rotation={[0, -0.28 + index * 0.2, 0]} scale={[0.72 + index * 0.16, 0.025, 0.055]}>
          <boxGeometry args={[1, 1, 1]} />
          {material('#4c929b')}
        </mesh>
      ))}
      {[-3.25, -1.95, 1.95, 3.1].map((z, index) => (
        <mesh key={`bank-${z}`} castShadow position={[left + 1.3 + index * Math.max(1.1, width / 4), 0.58, z * 0.55]} scale={[0.7, 0.22 + (index % 2) * 0.08, 0.48]}>
          <icosahedronGeometry args={[0.72, 0]} />
          {material(index % 2 ? '#dff3ee' : '#f5fbf7')}
        </mesh>
      ))}
      {[-2.25, -0.8, 1.15].map((z, i) => (
        <mesh key={z} castShadow position={[edge - 0.16 - i * 0.1, -0.48 - i * 0.08, z]} rotation={[0, i * 0.6, 0]} scale={[0.42, 0.42, 0.42]}>
          <coneGeometry args={[0.62, 1.2, 5]} />
          {material(i === 1 ? C.iceDark : C.ice)}
        </mesh>
      ))}
    </group>
  )
}

function EdgeCrystals({ cliffX, visible }: { cliffX: number; visible: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!group.current || !visible) return
    group.current.rotation.y = state.clock.elapsedTime * 1.6
    const pulse = 0.9 + Math.sin(state.clock.elapsedTime * 12) * 0.12
    group.current.scale.setScalar(pulse)
  })
  if (!visible) return null
  return (
    <group ref={group} position={[screenToWorld(cliffX) - 0.15, 0.75, 0]}>
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.55, 0.2 + (i % 3) * 0.22, Math.sin(angle) * 0.75]} rotation={[0, angle, Math.PI / 4]}>
            <octahedronGeometry args={[0.12 + (i % 2) * 0.045, 0]} />
            {material(i % 2 ? C.gold : '#fff4bd', C.gold)}
          </mesh>
        )
      })}
    </group>
  )
}

function OceanDetails({ cliffX }: { cliffX: number }) {
  const edge = screenToWorld(cliffX)
  const floes = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!floes.current) return
    floes.current.children.forEach((child, index) => {
      child.position.y = -1.25 + Math.sin(state.clock.elapsedTime * 1.1 + index) * 0.045
      child.rotation.y += 0.0015 * (index % 2 ? 1 : -1)
    })
  })
  return (
    <group ref={floes}>
      {[
        [edge + 1.4, -2.4, 0.72, 0.42],
        [edge + 2.25, 1.65, 0.95, 0.52],
        [edge + 3.35, -0.3, 0.58, 0.34],
        [edge + 4.1, 2.7, 0.82, 0.44],
      ].map(([px, pz, sx, sz], index) => (
        <mesh key={index} receiveShadow position={[px, -1.25, pz]} rotation={[0, index * 0.7, 0]} scale={[sx, 0.13, sz]}>
          <icosahedronGeometry args={[1, 0]} />
          {material(index % 2 ? '#77b7bd' : '#a9dcd8')}
        </mesh>
      ))}
      {[0.8, 1.65, 2.65].map((offset, index) => (
        <mesh key={`wave-${offset}`} position={[edge + offset, -1.16, -1.9 + index * 1.8]} rotation={[0, -0.18 + index * 0.12, 0]} scale={[0.9, 0.025, 0.08]}>
          <boxGeometry args={[1, 1, 1]} />
          {material('#7db9bf')}
        </mesh>
      ))}
    </group>
  )
}

function World({ x, cliffX, braking, phase, rating, characterId, velocity, weather }: { x: number; cliffX: number; braking: boolean; phase: GamePhase; rating: Rating | null; characterId: CharacterId; velocity: number; weather: WeatherKind }) {
  const runwayShadowCenter = (-5.45 + screenToWorld(cliffX)) / 2
  return (
    <>
      <fog attach="fog" args={['#10263b', 12, 28]} />
      <Atmosphere weather={weather} />
      <hemisphereLight args={['#ffffff', '#51636b', 0.55]} />
      <directionalLight
        castShadow
        color="#ffffff"
        intensity={3.05}
        position={[6.5, 16, 8]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      <directionalLight color="#dfe8ff" intensity={0.18} position={[-9, 5, -3]} />
      <directionalLight color="#fff0d8" intensity={0.28} position={[-5, 7, -10]} />
      <FollowCamera x={x} cliffX={cliffX} phase={phase} />

      <mesh receiveShadow position={[5, -1.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[64, 32]} />
        {material(C.water)}
      </mesh>

      <IcePlatform cliffX={cliffX} rating={rating} />
      {characterId === 'penguin'
        ? <LowPolyPenguin x={x} braking={braking} phase={phase} velocity={velocity} />
        : <AssetCharacter id={characterId} x={x} braking={braking} phase={phase} velocity={velocity} />}
      <SnowSpray x={x} active={braking && phase === 'playing'} />
      <EdgeCrystals cliffX={cliffX} visible={phase === 'result' && rating === 'edge'} />
      <OceanDetails cliffX={cliffX} />
      <WeatherFx key={weather} weather={weather} x={x} />

      {[-13, -9, 22, 27].map((position, i) => (
        <group key={position} position={[position, -0.7, -9 - (i % 2) * 1.8]}>
          <mesh scale={[1.55 + i * 0.18, 2.1 + (i % 2) * 0.75, 1.35]}>
            <coneGeometry args={[1, 2.8, 5]} />
            {material(i % 2 ? '#285469' : '#397184')}
          </mesh>
          <mesh position={[0, 1.22, 0]} scale={[0.55, 0.55, 0.55]}>
            <coneGeometry args={[1, 1.2, 5]} />
            {material('#a9dcd8')}
          </mesh>
        </group>
      ))}

      <ContactShadows position={[runwayShadowCenter, -0.78, 0]} opacity={0.38} scale={36} blur={2.4} far={6} color="#07151e" />
    </>
  )
}

export default function EdgeBrakeScene(props: { x: number; cliffX: number; braking: boolean; phase: GamePhase; rating: Rating | null; characterId: CharacterId; velocity: number; weather: WeatherKind }) {
  return (
    <Canvas
      className="eb-scene"
      orthographic
      camera={{ position: [-5.4, 6.8, 9.6], zoom: 64, near: 0.1, far: 90 }}
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ camera }) => camera.lookAt(screenToWorld(props.x + 29), 0.8, 0)}
    >
      <World {...props} />
    </Canvas>
  )
}
