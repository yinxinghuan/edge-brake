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
  const { camera: threeCamera } = useThree()
  const camera = threeCamera as THREE.OrthographicCamera
  const followXRef = useRef(0)
  const cameraPositionRef = useRef(new THREE.Vector3(-6.2, 13.2, 18.4))
  const lookXRef = useRef(2.1)
  const introStartRef = useRef(performance.now())
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    if (phase !== 'cover') return
    introStartRef.current = performance.now()
    followXRef.current = 0
    cameraPositionRef.current.set(-6.2, 13.2, 18.4)
    lookXRef.current = 2.1
  }, [phase])

  useFrame((_, delta) => {
    if (phase === 'cover') {
      const progress = reduceMotion ? 1 : Math.min((performance.now() - introStartRef.current) / 2800, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      cameraPositionRef.current.set(
        THREE.MathUtils.lerp(-6.2, -2.5, eased),
        THREE.MathUtils.lerp(13.2, 9.4, eased),
        THREE.MathUtils.lerp(18.4, 13.6, eased),
      )
      lookXRef.current = THREE.MathUtils.lerp(2.1, 0.35, eased)
      camera.zoom = THREE.MathUtils.lerp(29, 38, eased)
    } else {
      const penguinX = screenToWorld(x + 29)
      const resetting = phase === 'result'
      const danger = resetting ? 0 : THREE.MathUtils.clamp((x + 49 - 64) / Math.max(1, cliffX - 64), 0, 1)
      const tension = THREE.MathUtils.smoothstep(danger, 0.22, 0.96)
      const targetFollowX = resetting ? 0 : Math.max(0, penguinX + 1.62)
      followXRef.current = THREE.MathUtils.damp(followXRef.current, targetFollowX, 5.5, delta)
      cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, followXRef.current - 2.5 + tension * 1.2, 5.8, delta)
      cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, 9.4 - tension * 1.6, 5.8, delta)
      cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, 13.6 - tension * 2.8, 5.8, delta)
      lookXRef.current = THREE.MathUtils.damp(lookXRef.current, followXRef.current + 0.35 + tension * 0.8, 5.8, delta)
      camera.zoom = THREE.MathUtils.damp(camera.zoom, 38 + tension * 8, 5.8, delta)
    }

    camera.position.copy(cameraPositionRef.current)
    camera.lookAt(lookXRef.current, 0, 0)
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
    if (spec.kind === 'person') {
      const modelRoot = copy.children.find(child => child.type === 'Group') ?? copy
      modelRoot.updateMatrixWorld(true)
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
    }
    return { copy, pivots }
  }, [gltf.scene, spec.kind])
  const clone = prepared.copy
  const group = useRef<THREE.Group>(null)
  const fallStart = useRef<number | null>(null)
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
    if (phase === 'falling') fallStart.current = performance.now()
    if (phase === 'ready' || phase === 'playing') fallStart.current = null
  }, [phase])

  useFrame((state, delta) => {
    if (!group.current) return
    const targetX = screenToWorld(x + 29)
    const time = state.clock.elapsedTime
    const moving = phase === 'playing' && !braking
    const idle = phase === 'cover' || phase === 'ready' || phase === 'result'
    const stride = moving ? Math.sin(time * (5.5 + velocity * 0.035)) : 0
    const bounce = idle ? Math.abs(Math.sin(time * 3.25)) : moving ? Math.abs(stride) * 0.045 : 0
    const baseScale = spec.scale

    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 28, delta)
    if ((phase === 'falling' || phase === 'gameover') && fallStart.current !== null) {
      const elapsed = Math.min((performance.now() - fallStart.current) / 650, 1)
      group.current.position.y = 0.38 - elapsed * elapsed * 5.4
      group.current.rotation.z = THREE.MathUtils.lerp(0.08, -0.78, elapsed)
      group.current.rotation.x = THREE.MathUtils.lerp(0, 0.3, elapsed)
      group.current.scale.setScalar(baseScale * (1 - elapsed * 0.16))
    } else {
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, 0.38 + bounce * 0.08 - (braking ? 0.08 : 0), 18, delta)
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, braking ? 0.28 : moving ? -0.1 : 0, 15, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0, 15, delta)
      group.current.scale.set(baseScale, baseScale * (1 + bounce * 0.045 - (braking ? 0.08 : 0)), baseScale)
    }

    if (spec.kind === 'person' && rig.length >= 4) {
      const action = braking ? 1 : stride * 0.48
      rig[0].rotation.x = THREE.MathUtils.damp(rig[0].rotation.x, braking ? 0.7 : action, 18, delta)
      rig[1].rotation.x = THREE.MathUtils.damp(rig[1].rotation.x, braking ? -0.35 : -action, 18, delta)
      rig[2].rotation.x = THREE.MathUtils.damp(rig[2].rotation.x, braking ? -1.05 : -action * 1.2, 18, delta)
      rig[3].rotation.x = THREE.MathUtils.damp(rig[3].rotation.x, braking ? -0.8 : action * 1.2, 18, delta)
    }
  })

  return (
    <group ref={group} position={[screenToWorld(x + 29), 0.38, 0.12]} rotation={[0, spec.kind === 'person' ? Math.PI / 2 - 0.55 : -0.35, 0]}>
      <primitive object={clone} />
    </group>
  )
}

function LowPolyPenguin({ x, braking, phase, velocity }: { x: number; braking: boolean; phase: GamePhase; velocity: number }) {
  const group = useRef<THREE.Group>(null)
  const fallStart = useRef<number | null>(null)
  const falling = phase === 'falling' || phase === 'gameover'

  useEffect(() => {
    if (phase === 'falling') fallStart.current = performance.now()
    if (phase === 'ready' || phase === 'playing') fallStart.current = null
  }, [phase])

  useFrame((state, delta) => {
    if (!group.current) return
    const targetX = screenToWorld(x + 29)
    const idle = phase === 'cover' || phase === 'ready' || phase === 'result'
    const moving = phase === 'playing' && !braking
    const rhythm = Math.sin(state.clock.elapsedTime * (moving ? 5 + velocity * 0.03 : 3.2))
    const bounce = idle ? Math.abs(rhythm) * 0.07 : moving ? Math.abs(rhythm) * 0.045 : 0
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 28, delta)
    if (falling && fallStart.current !== null) {
      const elapsed = Math.min((performance.now() - fallStart.current) / 650, 1)
      group.current.position.y = 0.44 - elapsed * elapsed * 5.2
      group.current.rotation.z = THREE.MathUtils.lerp(0.08, -0.72, elapsed)
      group.current.rotation.x = THREE.MathUtils.lerp(0, 0.28, elapsed)
    } else {
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, (braking ? 0.36 : 0.44) + bounce, 18, delta)
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, braking ? 0.24 : -0.07, 18, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0, 18, delta)
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, moving ? rhythm * 0.045 : 0, 14, delta)
      group.current.scale.y = THREE.MathUtils.damp(group.current.scale.y, braking ? 0.92 : 1 + bounce * 0.3, 18, delta)
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
      <mesh castShadow position={[-0.1, 0.67, -0.55]} rotation={[0.1, 0, braking ? 0.85 : 0.28]} scale={[0.52, 0.18, 0.18]}>
        <coneGeometry args={[0.32, 0.9, 5]} />
        {material(C.ink)}
      </mesh>
      <mesh castShadow position={[-0.02, 0.63, 0.58]} rotation={[-0.1, 0, braking ? -0.85 : -0.28]} scale={[0.52, 0.18, 0.18]}>
        <coneGeometry args={[0.32, 0.9, 5]} />
        {material(C.ink)}
      </mesh>
      <mesh castShadow position={[-0.24, 0.05, 0.24]} scale={[0.5, 0.13, 0.28]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.orange)}
      </mesh>
      <mesh castShadow position={[0.34, 0.05, 0.24]} scale={[0.5, 0.13, 0.28]}>
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
      <mesh receiveShadow position={[center - 0.12, -0.38, 0.18]} scale={[width + 0.16, 1.3, 4.5]}>
        <boxGeometry args={[1, 1, 1]} />
        {material('#397f8d')}
      </mesh>
      <mesh receiveShadow position={[center - 0.04, 0.02, -0.04]} scale={[width + 0.08, 0.72, 4.36]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.ice)}
      </mesh>
      <mesh receiveShadow position={[center - 0.14, 0.41, 0]} scale={[Math.max(1, width - 0.28), 0.12, 4.25]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.snow)}
      </mesh>
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
  return (
    <>
      <fog attach="fog" args={['#10263b', 12, 28]} />
      <Atmosphere weather={weather} />
      <hemisphereLight args={['#ffffff', '#51636b', 0.55]} />
      <directionalLight castShadow color="#ffffff" intensity={3.05} position={[6.5, 16, 8]} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <directionalLight color="#dfe8ff" intensity={0.18} position={[-9, 5, -3]} />
      <directionalLight color="#fff0d8" intensity={0.28} position={[-5, 7, -10]} />
      <FollowCamera x={x} cliffX={cliffX} phase={phase} />

      <mesh receiveShadow position={[0, -1.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[38, 28]} />
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

      {[-8, -3.2, 3.8, 8].map((position, i) => (
        <group key={position} position={[position, -0.6, -7 - (i % 2) * 1.5]}>
          <mesh scale={[1.8 + i * 0.22, 2.4 + (i % 2), 1.5]}>
            <coneGeometry args={[1, 2.8, 5]} />
            {material(i % 2 ? '#285469' : '#397184')}
          </mesh>
          <mesh position={[0, 1.22, 0]} scale={[0.55, 0.55, 0.55]}>
            <coneGeometry args={[1, 1.2, 5]} />
            {material('#a9dcd8')}
          </mesh>
        </group>
      ))}

      <ContactShadows position={[0, -0.78, 0]} opacity={0.34} scale={18} blur={2.5} far={5} color="#07151e" />
    </>
  )
}

export default function EdgeBrakeScene(props: { x: number; cliffX: number; braking: boolean; phase: GamePhase; rating: Rating | null; characterId: CharacterId; velocity: number; weather: WeatherKind }) {
  return (
    <Canvas
      className="eb-scene"
      orthographic
      camera={{ position: [-6.2, 13.2, 18.4], zoom: 29, near: 0.1, far: 80 }}
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ camera }) => camera.lookAt(2.1, 0, 0)}
    >
      <World {...props} />
    </Canvas>
  )
}
