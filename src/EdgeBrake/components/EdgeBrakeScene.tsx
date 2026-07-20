import { ContactShadows } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GamePhase, Rating } from '../types'

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

function material(color: string, emissive?: string) {
  return <meshStandardMaterial color={color} flatShading roughness={0.88} metalness={0} emissive={emissive} emissiveIntensity={emissive ? 0.55 : 0} />
}

function FollowCamera({ x, phase }: { x: number; phase: GamePhase }) {
  const { camera: threeCamera } = useThree()
  const camera = threeCamera as THREE.OrthographicCamera
  const followXRef = useRef(0)
  const cameraPositionRef = useRef(new THREE.Vector3(-5.8, 12.5, 17.5))
  const lookXRef = useRef(1.8)
  const introStartRef = useRef(performance.now())
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    if (phase !== 'cover') return
    introStartRef.current = performance.now()
    followXRef.current = 0
    cameraPositionRef.current.set(-5.8, 12.5, 17.5)
    lookXRef.current = 1.8
  }, [phase])

  useFrame((_, delta) => {
    if (phase === 'cover') {
      const progress = reduceMotion ? 1 : Math.min((performance.now() - introStartRef.current) / 2600, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      cameraPositionRef.current.set(
        THREE.MathUtils.lerp(-5.8, -2.2, eased),
        THREE.MathUtils.lerp(12.5, 9, eased),
        THREE.MathUtils.lerp(17.5, 13, eased),
      )
      lookXRef.current = THREE.MathUtils.lerp(1.8, 0.4, eased)
      camera.zoom = THREE.MathUtils.lerp(32, 39, eased)
    } else {
      const penguinX = screenToWorld(x + 29)
      const targetFollowX = Math.max(0, penguinX + 1.45)
      followXRef.current = THREE.MathUtils.damp(followXRef.current, targetFollowX, 5.5, delta)
      cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, followXRef.current - 2.2, 6.5, delta)
      cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, 9, 6.5, delta)
      cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, 13, 6.5, delta)
      lookXRef.current = THREE.MathUtils.damp(lookXRef.current, followXRef.current + 0.4, 6.5, delta)
      camera.zoom = THREE.MathUtils.damp(camera.zoom, 39, 6.5, delta)
    }

    camera.position.copy(cameraPositionRef.current)
    camera.lookAt(lookXRef.current, 0, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  })

  return null
}

function LowPolyPenguin({ x, braking, phase }: { x: number; braking: boolean; phase: GamePhase }) {
  const group = useRef<THREE.Group>(null)
  const fallStart = useRef<number | null>(null)
  const falling = phase === 'falling' || phase === 'gameover'

  useEffect(() => {
    if (phase === 'falling') fallStart.current = performance.now()
    if (phase === 'ready' || phase === 'playing') fallStart.current = null
  }, [phase])

  useFrame((_, delta) => {
    if (!group.current) return
    const targetX = screenToWorld(x + 29)
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 28, delta)
    if (falling && fallStart.current !== null) {
      const elapsed = Math.min((performance.now() - fallStart.current) / 650, 1)
      group.current.position.y = 0.44 - elapsed * elapsed * 5.2
      group.current.rotation.z = THREE.MathUtils.lerp(0.08, -0.72, elapsed)
      group.current.rotation.x = THREE.MathUtils.lerp(0, 0.28, elapsed)
    } else {
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, braking ? 0.36 : 0.44, 18, delta)
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, braking ? 0.24 : -0.07, 18, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0, 18, delta)
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

function IcePlatform({ cliffX, rating }: { cliffX: number; rating: Rating | null }) {
  const left = -5.45
  const edge = screenToWorld(cliffX)
  const width = edge - left
  const center = left + width / 2
  return (
    <group>
      <mesh receiveShadow position={[center, -0.12, 0]} scale={[width, 0.78, 3.35]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.ice)}
      </mesh>
      <mesh receiveShadow position={[center, 0.31, 0]} scale={[width, 0.14, 3.38]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.snow)}
      </mesh>
      <mesh position={[edge + 0.02, 0.25, 0]} scale={[0.1, 0.32, 3.44]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(rating === 'edge' ? C.gold : '#dff7f3', rating === 'edge' ? C.gold : undefined)}
      </mesh>
      <mesh receiveShadow position={[edge - 0.34, 0.395, 0]} scale={[0.62, 0.035, 3.4]}>
        <boxGeometry args={[1, 1, 1]} />
        {material('#c9efea')}
      </mesh>
      <mesh castShadow position={[edge + 0.04, -0.38, 0]} scale={[0.16, 1.25, 3.42]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.iceDark)}
      </mesh>
      {[-2.25, -0.8, 1.15].map((z, i) => (
        <mesh key={z} castShadow position={[edge - 0.16 - i * 0.1, -0.38 - i * 0.08, z]} rotation={[0, i * 0.6, 0]} scale={[0.42, 0.42, 0.42]}>
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

function World({ x, cliffX, braking, phase, rating }: { x: number; cliffX: number; braking: boolean; phase: GamePhase; rating: Rating | null }) {
  return (
    <>
      <color attach="background" args={['#10263b']} />
      <fog attach="fog" args={['#10263b', 12, 28]} />
      <hemisphereLight args={['#ffffff', '#51636b', 0.55]} />
      <directionalLight castShadow color="#ffffff" intensity={3.05} position={[6.5, 16, 8]} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <directionalLight color="#dfe8ff" intensity={0.18} position={[-9, 5, -3]} />
      <directionalLight color="#fff0d8" intensity={0.28} position={[-5, 7, -10]} />
      <FollowCamera x={x} phase={phase} />

      <mesh receiveShadow position={[0, -1.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[38, 28]} />
        {material(C.water)}
      </mesh>

      <IcePlatform cliffX={cliffX} rating={rating} />
      <LowPolyPenguin x={x} braking={braking} phase={phase} />
      <SnowSpray x={x} active={braking && phase === 'playing'} />
      <EdgeCrystals cliffX={cliffX} visible={phase === 'result' && rating === 'edge'} />

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

export default function EdgeBrakeScene(props: { x: number; cliffX: number; braking: boolean; phase: GamePhase; rating: Rating | null }) {
  return (
    <Canvas
      className="eb-scene"
      orthographic
      camera={{ position: [-5.8, 12.5, 17.5], zoom: 32, near: 0.1, far: 80 }}
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ camera }) => camera.lookAt(1.8, 0, 0)}
    >
      <World {...props} />
    </Canvas>
  )
}
