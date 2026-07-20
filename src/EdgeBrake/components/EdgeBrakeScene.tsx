import { useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CHARACTER_BY_ID, CHARACTERS, nextRosterCharacter } from '../characters'
import type { CharacterId, GamePhase, Rating, WeatherKind } from '../types'

const C = {
  ink: '#17272d',
  cream: '#f5f0dd',
  orange: '#f3a83b',
  snow: '#eaf9f7',
  ice: '#5caeb7',
  iceDark: '#2f7482',
  teal: '#3fb6ac',
  gold: '#ffd166',
}

const screenToWorld = (px: number) => (px - 195) / 36

const DISTANT_EASTER_EGG_IDS: CharacterId[] = [
  'bear', 'cow', 'pig', 'fox',
  'ghost', 'zombie', 'werewolf', 'mummy', 'skeleton',
  'combatMech', 'minotaur',
]

useGLTF.preload(CHARACTERS[0].modelUrl)
DISTANT_EASTER_EGG_IDS.forEach(id => useGLTF.preload(CHARACTER_BY_ID[id].modelUrl))

function material(color: string, emissive?: string) {
  return <meshStandardMaterial color={color} flatShading roughness={0.88} metalness={0} emissive={emissive} emissiveIntensity={emissive ? 0.55 : 0} />
}

function FollowCamera({ x, cliffX, phase, charging, chargePower, rating }: { x: number; cliffX: number; phase: GamePhase; charging: boolean; chargePower: number; rating: Rating | null }) {
  const { camera: threeCamera, size } = useThree()
  const camera = threeCamera as THREE.OrthographicCamera
  const renderScale = Math.min(size.width / 390, size.height / 700)
  const cameraPositionRef = useRef(new THREE.Vector3(3.3, 6.8, 4.8))
  const lookXRef = useRef(screenToWorld(x + 29))
  const lookYRef = useRef(1.12)
  const fallStartRef = useRef<number | null>(null)
  const fallFromPositionRef = useRef(new THREE.Vector3())
  const fallFromLookXRef = useRef(0)
  const fallFromLookYRef = useRef(0)
  const fallFromZoomRef = useRef(64)
  const playingStartRef = useRef<number | null>(null)
  const playingFromPositionRef = useRef(new THREE.Vector3())
  const playingFromLookXRef = useRef(0)
  const playingFromLookYRef = useRef(0)
  const playingFromZoomRef = useRef(64)
  const overviewPositionRef = useRef(new THREE.Vector3())
  const successStartRef = useRef<number | null>(null)
  const successFromPositionRef = useRef(new THREE.Vector3())
  const successFromLookXRef = useRef(0)
  const successFromLookYRef = useRef(0)
  const successFromZoomRef = useRef(64)
  const earlyFailStartRef = useRef<number | null>(null)
  const earlyFailFromPositionRef = useRef(new THREE.Vector3())
  const earlyFailFromLookXRef = useRef(0)
  const earlyFailFromLookYRef = useRef(0)
  const earlyFailFromZoomRef = useRef(64)
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    if (phase !== 'cover') return
    const heroX = screenToWorld(x + 29)
    cameraPositionRef.current.set(heroX + 6.8, 6.8, 4.8)
    lookXRef.current = heroX + 0.12
    lookYRef.current = 1.12
  }, [phase, x])

  useEffect(() => {
    if (phase === 'falling') {
      fallStartRef.current = performance.now()
      fallFromPositionRef.current.copy(cameraPositionRef.current)
      fallFromLookXRef.current = lookXRef.current
      fallFromLookYRef.current = lookYRef.current
      fallFromZoomRef.current = camera.zoom
    }
    else if (phase !== 'gameover') fallStartRef.current = null
  }, [camera, phase])

  useEffect(() => {
    if (phase === 'earlyFail') {
      earlyFailStartRef.current = performance.now()
      earlyFailFromPositionRef.current.copy(cameraPositionRef.current)
      earlyFailFromLookXRef.current = lookXRef.current
      earlyFailFromLookYRef.current = lookYRef.current
      earlyFailFromZoomRef.current = camera.zoom
    } else if (phase !== 'result') {
      earlyFailStartRef.current = null
    }
  }, [camera, phase])

  useEffect(() => {
    if (phase === 'playing') {
      playingStartRef.current = performance.now()
      playingFromPositionRef.current.copy(cameraPositionRef.current)
      playingFromLookXRef.current = lookXRef.current
      playingFromLookYRef.current = lookYRef.current
      playingFromZoomRef.current = camera.zoom
    } else {
      playingStartRef.current = null
    }
  }, [camera, phase])

  useEffect(() => {
    if (phase === 'success') {
      successStartRef.current = performance.now()
      successFromPositionRef.current.copy(cameraPositionRef.current)
      successFromLookXRef.current = lookXRef.current
      successFromLookYRef.current = lookYRef.current
      successFromZoomRef.current = camera.zoom
    } else if (phase !== 'result') {
      successStartRef.current = null
    }
  }, [camera, phase])

  useFrame((state, delta) => {
    if (phase === 'cover') {
      const heroX = screenToWorld(x + 29)
      const drift = reduceMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.62) * 0.16
      cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, heroX + 6.8 + drift, 3.2, delta)
      cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, 6.8, 3.2, delta)
      cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, 4.8 - drift * 0.45, 3.2, delta)
      lookXRef.current = THREE.MathUtils.damp(lookXRef.current, heroX + 0.12, 4, delta)
      lookYRef.current = THREE.MathUtils.damp(lookYRef.current, 1.12, 4, delta)
      camera.zoom = THREE.MathUtils.damp(camera.zoom, 64 * renderScale, 4, delta)
    } else {
      const characterX = screenToWorld(x + 29)
      const danger = phase === 'playing' ? THREE.MathUtils.clamp((x + 49 - 40) / Math.max(1, cliffX - 40), 0, 1) : 0
      const tension = THREE.MathUtils.smoothstep(danger, 0.16, 0.88)
      const followBlend = THREE.MathUtils.smoothstep(tension, 0.12, 0.68)
      const startCharacterX = screenToWorld(40 + 29)
      const trackCenter = (startCharacterX + screenToWorld(cliffX)) / 2
      const remainingCenter = (characterX + screenToWorld(cliffX)) / 2
      const falling = phase === 'falling' || phase === 'gameover'
      const fallProgress = fallStartRef.current === null ? 0 : Math.min((performance.now() - fallStartRef.current) / 1250, 1)
      const playingAge = playingStartRef.current === null ? 0 : performance.now() - playingStartRef.current
      const successAge = successStartRef.current === null ? 0 : performance.now() - successStartRef.current
      const earlyFailAge = earlyFailStartRef.current === null ? 0 : performance.now() - earlyFailStartRef.current
      const successfulResult = rating !== null && rating !== 'early'
      const cameraResponse = falling ? 8.4 : 6.2

      if (phase === 'awaiting' || phase === 'charging') {
        const pressure = charging ? chargePower : 0
        cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, startCharacterX + 6.8 - pressure * 0.42, 8.5, delta)
        cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, 6.8 - pressure * 0.22, 8.5, delta)
        cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, 4.8 - pressure * 0.16, 8.5, delta)
        lookXRef.current = THREE.MathUtils.damp(lookXRef.current, startCharacterX + 0.12, 8.5, delta)
        lookYRef.current = THREE.MathUtils.damp(lookYRef.current, 1.12, 8.5, delta)
        camera.zoom = THREE.MathUtils.damp(camera.zoom, (64 + pressure * 6) * renderScale, 8.5, delta)
      } else if (phase === 'success' && successStartRef.current !== null) {
        const hold = reduceMotion ? 1 : THREE.MathUtils.clamp((successAge - 120) / 980, 0, 1)
        const eased = 1 - Math.pow(1 - hold, 3)
        const orbitLift = reduceMotion ? 0 : Math.sin(eased * Math.PI) * 0.38
        const heroPosition = new THREE.Vector3(characterX + 4.7, 4.25 + orbitLift, -4.6)
        cameraPositionRef.current.lerpVectors(successFromPositionRef.current, heroPosition, eased)
        lookXRef.current = THREE.MathUtils.lerp(successFromLookXRef.current, characterX + 0.08, eased)
        lookYRef.current = THREE.MathUtils.lerp(successFromLookYRef.current, 1.02, eased)
        camera.zoom = THREE.MathUtils.lerp(successFromZoomRef.current, (reduceMotion ? 70 : 78) * renderScale, eased)
      } else if (phase === 'result' && successfulResult) {
        cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, characterX + 4.95, 4.6, delta)
        cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, 4.4, 4.6, delta)
        cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, -4.15, 4.6, delta)
        lookXRef.current = THREE.MathUtils.damp(lookXRef.current, characterX + 0.08, 4.6, delta)
        lookYRef.current = THREE.MathUtils.damp(lookYRef.current, 1.02, 4.6, delta)
        camera.zoom = THREE.MathUtils.damp(camera.zoom, 74 * renderScale, 4.6, delta)
      } else if (phase === 'earlyFail' && earlyFailStartRef.current !== null) {
        const reveal = reduceMotion ? 1 : THREE.MathUtils.clamp((earlyFailAge - 110) / 930, 0, 1)
        const easedReveal = 1 - Math.pow(1 - reveal, 3)
        overviewPositionRef.current.set(remainingCenter - 4, 14.5, 21)
        cameraPositionRef.current.lerpVectors(earlyFailFromPositionRef.current, overviewPositionRef.current, easedReveal)
        lookXRef.current = THREE.MathUtils.lerp(earlyFailFromLookXRef.current, remainingCenter, easedReveal)
        lookYRef.current = THREE.MathUtils.lerp(earlyFailFromLookYRef.current, 0.05, easedReveal)
        camera.zoom = THREE.MathUtils.lerp(earlyFailFromZoomRef.current, 7.4 * renderScale, easedReveal)
      } else if (phase === 'result' && rating === 'early') {
        cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, remainingCenter - 4, 4.6, delta)
        cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, 14.5, 4.6, delta)
        cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, 21, 4.6, delta)
        lookXRef.current = THREE.MathUtils.damp(lookXRef.current, remainingCenter, 4.6, delta)
        lookYRef.current = THREE.MathUtils.damp(lookYRef.current, 0.05, 4.6, delta)
        camera.zoom = THREE.MathUtils.damp(camera.zoom, 7.4 * renderScale, 4.6, delta)
      } else if (phase === 'playing' && playingStartRef.current !== null && playingAge < 2100) {
        const launchHold = reduceMotion ? 0 : 280
        const pullback = reduceMotion ? 1 : THREE.MathUtils.clamp((playingAge - launchHold) / 920, 0, 1)
        const eased = 1 - Math.pow(1 - pullback, 3)
        const closePosition = playingFromPositionRef.current.clone()
        closePosition.x += characterX - startCharacterX
        const closeLookX = playingFromLookXRef.current + characterX - startCharacterX
        overviewPositionRef.current.set(trackCenter - 4, 14, 21)
        cameraPositionRef.current.lerpVectors(closePosition, overviewPositionRef.current, eased)
        lookXRef.current = THREE.MathUtils.lerp(closeLookX, trackCenter, eased)
        lookYRef.current = THREE.MathUtils.lerp(playingFromLookYRef.current, 0.05, eased)
        camera.zoom = THREE.MathUtils.lerp(playingFromZoomRef.current, 6.8 * renderScale, eased)
      } else if (falling) {
        const drop = THREE.MathUtils.clamp((fallProgress - 0.112) / 0.888, 0, 1)
        const easedDrop = 1 - Math.pow(1 - drop, 2)
        if (drop === 0) {
          cameraPositionRef.current.copy(fallFromPositionRef.current)
          lookXRef.current = fallFromLookXRef.current
          lookYRef.current = fallFromLookYRef.current
          camera.zoom = fallFromZoomRef.current
        } else {
          cameraPositionRef.current.x = THREE.MathUtils.lerp(fallFromPositionRef.current.x, characterX + 5.7, easedDrop)
          cameraPositionRef.current.y = THREE.MathUtils.lerp(fallFromPositionRef.current.y, 2.45, easedDrop)
          cameraPositionRef.current.z = THREE.MathUtils.lerp(fallFromPositionRef.current.z, 2.8, easedDrop)
          lookXRef.current = THREE.MathUtils.lerp(fallFromLookXRef.current, characterX + 0.08, easedDrop)
          lookYRef.current = THREE.MathUtils.lerp(fallFromLookYRef.current, -1.35, easedDrop)
          const failureZoom = drop < 0.26
            ? THREE.MathUtils.lerp(fallFromZoomRef.current, 84 * renderScale, drop / 0.26)
            : THREE.MathUtils.lerp(84 * renderScale, 62 * renderScale, (drop - 0.26) / 0.74)
          camera.zoom = failureZoom
        }
      } else {
        const targetCameraX = THREE.MathUtils.lerp(trackCenter - 4, characterX + 5.8, followBlend)
        const targetLookX = THREE.MathUtils.lerp(trackCenter, characterX, followBlend)
        cameraPositionRef.current.x = THREE.MathUtils.damp(cameraPositionRef.current.x, targetCameraX, cameraResponse, delta)
        const targetCameraY = THREE.MathUtils.lerp(14, 5.2, tension)
        const targetCameraZ = THREE.MathUtils.lerp(21, 3.6, tension)
        cameraPositionRef.current.y = THREE.MathUtils.damp(cameraPositionRef.current.y, targetCameraY, cameraResponse, delta)
        cameraPositionRef.current.z = THREE.MathUtils.damp(cameraPositionRef.current.z, targetCameraZ, cameraResponse, delta)
        lookXRef.current = THREE.MathUtils.damp(lookXRef.current, targetLookX, cameraResponse, delta)
        lookYRef.current = THREE.MathUtils.damp(lookYRef.current, THREE.MathUtils.lerp(0.05, 0.72, tension), cameraResponse, delta)
        const targetZoom = THREE.MathUtils.lerp(6.8, 68, tension)
        camera.zoom = THREE.MathUtils.damp(camera.zoom, targetZoom * renderScale, cameraResponse, delta)
      }
    }

    camera.position.copy(cameraPositionRef.current)
    camera.lookAt(lookXRef.current, lookYRef.current, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  })

  return null
}

function AssetCharacter({ id, x, charging, chargePower, phase, velocity }: { id: CharacterId; x: number; charging: boolean; chargePower: number; phase: GamePhase; velocity: number }) {
  const spec = CHARACTER_BY_ID[id]
  const gltf = useGLTF(spec.modelUrl!)
  const prepared = useMemo(() => {
    const copy = gltf.scene.clone(true)
    const pivots: THREE.Object3D[] = []
    const modelRoot = copy.children.find(child => child.type === 'Group') ?? copy
    modelRoot.updateMatrixWorld(true)
    if (spec.motion === 'human' || spec.motion === 'mech') {
      const namedRig = ['rig_legL', 'rig_legR', 'rig_armL', 'rig_armR'].map(name => modelRoot.getObjectByName(name))
      if (namedRig.every((pivot): pivot is THREE.Object3D => Boolean(pivot))) {
        pivots.push(...namedRig)
        return { copy, pivots }
      }
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
        if (outside && meshCenter.y < bounds.min.y + size.y * 0.76) (meshCenter.x < center.x ? armL : armR).attach(mesh)
        else if (low && Math.abs(meshCenter.x - center.x) > size.x * 0.06) (meshCenter.x < center.x ? legL : legR).attach(mesh)
      }
      pivots.push(legL, legR, armL, armR)
    } else if (spec.motion === 'quadruped' || spec.motion === 'frog') {
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
    } else if (spec.motion === 'bird') {
      const bounds = new THREE.Box3().setFromObject(modelRoot)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const legL = new THREE.Group()
      const legR = new THREE.Group()
      const wingL = new THREE.Group()
      const wingR = new THREE.Group()
      legL.position.set(center.x, bounds.min.y + size.y * 0.26, center.z - size.z * 0.18)
      legR.position.set(center.x, bounds.min.y + size.y * 0.26, center.z + size.z * 0.18)
      wingL.position.set(center.x, bounds.min.y + size.y * 0.62, center.z - size.z * 0.38)
      wingR.position.set(center.x, bounds.min.y + size.y * 0.62, center.z + size.z * 0.38)
      modelRoot.add(legL, legR, wingL, wingR)
      modelRoot.updateMatrixWorld(true)
      const meshes = modelRoot.children.filter(child => child instanceof THREE.Mesh) as THREE.Mesh[]
      meshes.forEach(mesh => {
        const meshCenter = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
        const low = meshCenter.y < bounds.min.y + size.y * 0.34
        const outside = Math.abs(meshCenter.z - center.z) > size.z * 0.3
        if (low) (meshCenter.z < center.z ? legL : legR).attach(mesh)
        else if (outside && meshCenter.y < bounds.min.y + size.y * 0.78) (meshCenter.z < center.z ? wingL : wingR).attach(mesh)
      })
      pivots.push(legL, legR, wingL, wingR)
    }
    return { copy, pivots }
  }, [gltf.scene, spec.motion])
  const clone = prepared.copy
  const group = useRef<THREE.Group>(null)
  const pose = useRef<THREE.Group>(null)
  const fallStart = useRef<number | null>(null)
  const phaseStart = useRef(performance.now())
  const chargeStart = useRef<number | null>(null)
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
    if (phase === 'awaiting' || phase === 'charging' || phase === 'playing') fallStart.current = null
  }, [phase])

  useEffect(() => {
    chargeStart.current = charging ? performance.now() : null
  }, [charging])

  useFrame((state, delta) => {
    if (!group.current || !pose.current) return
    const targetX = screenToWorld(x + 29)
    const time = state.clock.elapsedTime
    const phaseAge = (performance.now() - phaseStart.current) / 1000
    const chargeAge = chargeStart.current === null ? 0 : (performance.now() - chargeStart.current) / 1000
    const moving = phase === 'playing' && !charging
    const idle = phase === 'cover' || phase === 'awaiting' || phase === 'result'
    const outcomePose = phase === 'success' || phase === 'earlyFail'
    const falling = phase === 'falling' || phase === 'gameover'
    const fallElapsed = falling && fallStart.current !== null
      ? Math.min((performance.now() - fallStart.current) / 1250, 1)
      : 0
    const airborne = THREE.MathUtils.clamp((fallElapsed - 0.08) / 0.92, 0, 1)
    const fallWave = Math.sin(airborne * Math.PI * 5)
    const motionRate = spec.motion === 'mech' ? 0.9 : spec.motion === 'bird' ? 1.28 : spec.motion === 'frog' ? 0.82 : 1
    const strideRaw = moving ? Math.sin(time * (4.9 + velocity * 0.009) * motionRate) : 0
    const stride = Math.sign(strideRaw) * Math.pow(Math.abs(strideRaw), 0.68)
    const breath = (Math.sin(time * Math.PI * 1.6) + 1) * 0.5
    const chargeCrouch = charging ? THREE.MathUtils.smoothstep(chargePower, 0, 1) : 0
    const launchStage = moving ? THREE.MathUtils.clamp(1 - phaseAge / 0.62, 0, 1) : 0
    const chargePunch = charging ? Math.min(chargeAge / 0.18, 1) : 0
    const bounce = spec.motion === 'hover'
      ? (idle ? Math.sin(time * 2.2) * 0.06 : moving ? Math.sin(time * 4.2) * 0.045 : 0)
      : idle ? breath * (spec.motion === 'mech' ? 0.018 : 0.035) : moving ? Math.abs(strideRaw) * (spec.motion === 'mech' ? 0.035 : 0.065) : 0
    const baseScale = spec.scale

    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 28, delta)
    if (falling && fallStart.current !== null) {
      group.current.visible = fallElapsed < 0.115
      group.current.position.y = 0.38 + Math.sin(Math.min(fallElapsed / 0.115, 1) * Math.PI) * 0.08
      group.current.rotation.z = 0
      group.current.rotation.x = 0
      group.current.rotation.y = spec.headingYaw
      group.current.scale.setScalar(baseScale)
    } else {
      group.current.visible = true
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, 0.38, 18, delta)
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, moving ? stride * 0.025 : 0, 15, delta)
      const movingLean = spec.motion === 'hover' ? -0.2 : spec.motion === 'mech' ? -0.09 : -0.14
      const chargeLean = spec.motion === 'hover' ? 0.24 : spec.motion === 'frog' ? 0.08 : 0.18
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, charging ? chargeLean * chargeCrouch : moving ? movingLean - launchStage * 0.12 : 0, 15, delta)
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, spec.headingYaw, 18, delta)
      group.current.scale.setScalar(baseScale)
    }

    const skateShift = moving ? stride * 0.07 : 0
    pose.current.position.y = THREE.MathUtils.damp(pose.current.position.y, bounce - chargeCrouch * 0.2 + launchStage * 0.08, 18, delta)
    pose.current.position.x = THREE.MathUtils.damp(pose.current.position.x, skateShift, 16, delta)
    const chargeTremor = charging && !outcomePose && chargePower >= 0.82 ? Math.sin(chargeAge * 30) * 0.035 : 0
    const chargeArmSwing = charging && !outcomePose ? Math.sin(Math.max(0, chargeAge - 0.08) * 9.2) * 0.09 * chargePunch : 0
    const chargeLegBalance = charging && !outcomePose ? Math.sin(Math.max(0, chargeAge - 0.08) * 11.4) * 0.05 * chargePunch : 0
    pose.current.rotation.z = THREE.MathUtils.damp(pose.current.rotation.z, falling ? fallWave * 0.12 : charging ? -0.08 * chargeCrouch + chargeTremor : moving ? stride * 0.055 : Math.sin(time * 2.2) * 0.018, 16, delta)
    pose.current.rotation.y = THREE.MathUtils.damp(pose.current.rotation.y, moving ? stride * 0.1 : idle ? Math.sin(time * 1.8) * 0.025 : 0, 14, delta)
    const squashWeight = spec.motion === 'mech' ? 0.35 : spec.motion === 'hover' ? 0.55 : spec.motion === 'frog' ? 1.25 : 1
    const verticalScale = 1 + breath * (idle ? 0.025 * squashWeight : 0) - chargeCrouch * 0.13 * squashWeight + launchStage * 0.04
    pose.current.scale.set(1 + chargeCrouch * 0.055 - launchStage * 0.025, verticalScale, 1)

    if (rig.length >= 4) {
      if (spec.motion === 'human' || spec.motion === 'mech') {
        const limbWeight = spec.motion === 'mech' ? 0.68 : 1
        const pushLeft = moving ? Math.max(0, stride) : 0
        const pushRight = moving ? Math.max(0, -stride) : 0
        const legAction = charging ? chargeCrouch * 0.52 : 0
        const armCounter = moving ? stride * (0.72 + launchStage * 0.48) : idle ? Math.sin(time * 1.8) * 0.1 : 0
        const armLeftOut = moving ? Math.max(0, armCounter) : 0
        const armRightOut = moving ? Math.max(0, -armCounter) : 0
        rig[0].rotation.x = THREE.MathUtils.damp(rig[0].rotation.x, falling ? 0.72 + fallWave * 0.5 : charging ? (legAction + chargeLegBalance) * limbWeight : (stride * (1.02 + launchStage * 0.3)) * limbWeight, 22, delta)
        rig[1].rotation.x = THREE.MathUtils.damp(rig[1].rotation.x, falling ? -0.72 - fallWave * 0.42 : charging ? (-legAction - chargeLegBalance) * limbWeight : (-stride * (1.02 + launchStage * 0.3)) * limbWeight, 22, delta)
        rig[2].rotation.x = THREE.MathUtils.damp(rig[2].rotation.x, falling ? -0.82 - fallWave * 0.62 : charging ? (1.16 + chargeArmSwing) * limbWeight : -armCounter * limbWeight, 22, delta)
        rig[3].rotation.x = THREE.MathUtils.damp(rig[3].rotation.x, falling ? 0.82 - fallWave * 0.55 : charging ? (1.16 - chargeArmSwing) * limbWeight : armCounter * limbWeight, 22, delta)
        rig[0].rotation.z = THREE.MathUtils.damp(rig[0].rotation.z, falling ? -0.58 - fallWave * 0.28 : charging ? -0.34 - chargeLegBalance : -0.18 - pushLeft * 0.54, 22, delta)
        rig[1].rotation.z = THREE.MathUtils.damp(rig[1].rotation.z, falling ? 0.58 - fallWave * 0.28 : charging ? 0.34 + chargeLegBalance : 0.18 + pushRight * 0.54, 22, delta)
        rig[2].rotation.z = THREE.MathUtils.damp(rig[2].rotation.z, falling ? -1.16 - fallWave * 0.34 : charging ? -0.62 - Math.abs(chargeArmSwing) * 0.18 : -0.48 - armLeftOut * 0.78, 22, delta)
        rig[3].rotation.z = THREE.MathUtils.damp(rig[3].rotation.z, falling ? 1.16 - fallWave * 0.34 : charging ? 0.62 + Math.abs(chargeArmSwing) * 0.18 : 0.48 + armRightOut * 0.78, 22, delta)
      } else if (spec.motion === 'bird') {
        const shortStep = moving ? stride * (0.82 + launchStage * 0.28) : charging ? chargeCrouch * 0.28 : 0
        const wingBalance = moving ? stride * 0.34 : idle ? Math.sin(time * 2.1) * 0.08 : 0
        rig[0].rotation.z = THREE.MathUtils.damp(rig[0].rotation.z, charging ? -0.68 - chargeTremor : shortStep, 24, delta)
        rig[1].rotation.z = THREE.MathUtils.damp(rig[1].rotation.z, charging ? 0.68 + chargeTremor : -shortStep, 24, delta)
        rig[2].rotation.x = THREE.MathUtils.damp(rig[2].rotation.x, charging ? -0.92 - chargeArmSwing : -0.25 - wingBalance, 22, delta)
        rig[3].rotation.x = THREE.MathUtils.damp(rig[3].rotation.x, charging ? 0.92 - chargeArmSwing : 0.25 + wingBalance, 22, delta)
      } else {
        const frogKick = spec.motion === 'frog' ? Math.max(0, stride) * 0.95 : stride * 0.72
        const diagonal = moving ? frogKick * (1 + launchStage * 0.3) : charging ? chargeCrouch * 0.38 : 0
        const chargePawWave = charging ? Math.sin(chargeAge * 12.1) * 0.16 : 0
        ;[0, 3].forEach(index => { rig[index].rotation.z = THREE.MathUtils.damp(rig[index].rotation.z, falling ? 0.74 + fallWave * 0.45 : charging ? 0.68 + chargePawWave : diagonal, 22, delta) })
        ;[1, 2].forEach(index => { rig[index].rotation.z = THREE.MathUtils.damp(rig[index].rotation.z, falling ? -0.74 + fallWave * 0.45 : charging ? -0.52 - chargePawWave : -diagonal, 22, delta) })
        rig.forEach((limb, index) => {
          const side = index % 2 === 0 ? -1 : 1
          limb.rotation.x = THREE.MathUtils.damp(limb.rotation.x, falling ? side * (0.68 + fallWave * 0.32) : charging ? side * (0.52 + chargeTremor) : side * Math.abs(diagonal) * 0.34, 20, delta)
        })
      }
    }
  })

  return (
    <group ref={group} position={[screenToWorld(x + 29), 0.38, 0.12]} rotation={[0, spec.headingYaw, 0]}>
      <group ref={pose}>
        <primitive object={clone} />
      </group>
    </group>
  )
}

export function LowPolyPenguin({ x, charging, phase, velocity }: { x: number; charging: boolean; phase: GamePhase; velocity: number }) {
  const group = useRef<THREE.Group>(null)
  const wingBack = useRef<THREE.Mesh>(null)
  const wingFront = useRef<THREE.Mesh>(null)
  const footBack = useRef<THREE.Mesh>(null)
  const footFront = useRef<THREE.Mesh>(null)
  const fallStart = useRef<number | null>(null)
  const phaseStart = useRef(performance.now())
  const chargeStart = useRef<number | null>(null)
  const falling = phase === 'falling' || phase === 'gameover'

  useEffect(() => {
    phaseStart.current = performance.now()
    if (phase === 'falling') fallStart.current = performance.now()
    if (phase === 'awaiting' || phase === 'charging' || phase === 'playing') fallStart.current = null
  }, [phase])

  useEffect(() => {
    chargeStart.current = charging ? performance.now() : null
  }, [charging])

  useFrame((state, delta) => {
    if (!group.current) return
    const targetX = screenToWorld(x + 29)
    const time = state.clock.elapsedTime
    const phaseAge = (performance.now() - phaseStart.current) / 1000
    const chargeAge = chargeStart.current === null ? 0 : (performance.now() - chargeStart.current) / 1000
    const idle = phase === 'cover' || phase === 'awaiting' || phase === 'result'
    const moving = phase === 'playing' && !charging
    const fallElapsed = falling && fallStart.current !== null
      ? Math.min((performance.now() - fallStart.current) / 1250, 1)
      : 0
    const airborne = THREE.MathUtils.clamp((fallElapsed - 0.08) / 0.92, 0, 1)
    const fallWave = Math.sin(airborne * Math.PI * 5)
    const rhythmRaw = Math.sin(time * (moving ? 4.9 + velocity * 0.009 : Math.PI * 1.6))
    const rhythm = Math.sign(rhythmRaw) * Math.pow(Math.abs(rhythmRaw), 0.68)
    const breath = (Math.sin(time * Math.PI * 1.6) + 1) * 0.5
    const readyAction = phase === 'charging' ? THREE.MathUtils.clamp((phaseAge - 0.08) / 0.44, 0, 1) : 0
    const readyCrouch = Math.sin(readyAction * Math.PI)
    const chargePunch = charging ? Math.min(chargeAge / 0.18, 1) : 0
    const bounce = idle ? breath * 0.055 : moving ? Math.abs(rhythmRaw) * 0.075 : 0
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 28, delta)
    if (falling && fallStart.current !== null) {
      group.current.visible = fallElapsed < 0.115
      group.current.position.y = 0.44 + Math.sin(Math.min(fallElapsed / 0.115, 1) * Math.PI) * 0.08
      group.current.rotation.z = 0
      group.current.rotation.x = 0
      group.current.rotation.y = 0
    } else {
      group.current.visible = true
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, 0.44 + bounce - readyCrouch * 0.11 - (charging ? 0.07 : 0), 18, delta)
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, charging ? 0.3 * chargePunch : moving ? -0.08 : -0.025 + Math.sin(time * 2.1) * 0.018, 18, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0, 18, delta)
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, moving ? rhythm * 0.075 : idle ? Math.sin(time * 1.7) * 0.035 : 0, 14, delta)
      group.current.scale.x = THREE.MathUtils.damp(group.current.scale.x, 1 + readyCrouch * 0.06, 18, delta)
      group.current.scale.y = THREE.MathUtils.damp(group.current.scale.y, charging ? 0.9 : 1 + breath * (idle ? 0.025 : 0) - readyCrouch * 0.11, 18, delta)
      group.current.scale.z = THREE.MathUtils.damp(group.current.scale.z, 1, 18, delta)
    }

    if (wingBack.current && wingFront.current && footBack.current && footFront.current) {
      const chargeTremor = charging && chargeAge > 0.18 ? Math.sin(chargeAge * 30) * 0.05 : 0
      const chargeWingSwing = charging ? Math.sin(Math.max(0, chargeAge - 0.08) * 12.1) * 0.28 * chargePunch : 0
      const wingSwing = moving ? rhythm * 0.68 : idle ? Math.sin(time * 1.9) * 0.12 : readyCrouch * 0.2
      wingBack.current.rotation.z = THREE.MathUtils.damp(wingBack.current.rotation.z, falling ? 1.28 + fallWave * 0.34 : charging ? 1.08 + chargeWingSwing + chargeTremor : 0.56 + wingSwing, 22, delta)
      wingFront.current.rotation.z = THREE.MathUtils.damp(wingFront.current.rotation.z, falling ? -1.28 + fallWave * 0.34 : charging ? -1.08 + chargeWingSwing - chargeTremor : -0.56 - wingSwing, 22, delta)
      footBack.current.position.x = THREE.MathUtils.damp(footBack.current.position.x, falling ? -0.58 - fallWave * 0.2 : -0.24 + (moving ? Math.max(0, rhythm) * -0.5 : charging ? -0.24 : 0), 22, delta)
      footFront.current.position.x = THREE.MathUtils.damp(footFront.current.position.x, falling ? 0.68 - fallWave * 0.2 : 0.34 + (moving ? Math.max(0, -rhythm) * -0.5 : charging ? 0.4 : 0), 22, delta)
      footBack.current.rotation.z = THREE.MathUtils.damp(footBack.current.rotation.z, falling ? -0.72 - fallWave * 0.42 : moving ? -Math.max(0, rhythm) * 0.62 : charging ? -0.52 - chargeTremor : 0, 22, delta)
      footFront.current.rotation.z = THREE.MathUtils.damp(footFront.current.rotation.z, falling ? 0.72 - fallWave * 0.42 : moving ? Math.max(0, -rhythm) * 0.62 : charging ? 0.58 + chargeTremor : 0, 22, delta)
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

function SnowSpray({ x, phase: gamePhase }: { x: number; phase: GamePhase }) {
  const group = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const launchStarted = useRef<number | null>(null)
  const seeds = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    x: -0.2 - (i % 3) * 0.2,
    y: 0.12 + (i % 4) * 0.13,
    z: -0.4 + (i % 5) * 0.2,
    scale: 0.06 + (i % 3) * 0.025,
  })), [])

  useEffect(() => {
    launchStarted.current = gamePhase === 'playing' ? performance.now() : null
  }, [gamePhase])

  useFrame((_, delta) => {
    if (!group.current || launchStarted.current === null) return
    const age = (performance.now() - launchStarted.current) / 1000
    group.current.visible = age < 0.5
    group.current.scale.setScalar(Math.max(0.2, 1 - age * 0.65))
    phase.current += delta * 4.5
    group.current.children.forEach((child, i) => {
      const p = (phase.current + i * 0.13) % 1
      child.position.x = -p * (0.65 + (i % 3) * 0.2)
      child.position.y = seeds[i].y + Math.sin(p * Math.PI) * 0.5
      child.scale.setScalar(seeds[i].scale * (1 - p * 0.45))
    })
  })

  return (
    <group ref={group} visible={false} position={[screenToWorld(x + 10), 0.36, 0.1]}>
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
    fog.far = THREE.MathUtils.damp(fog.far, weather === 'fog' ? 32 : weather === 'blizzard' ? 34 : 42, 2.4, delta)
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

function DistantEasterEgg({ x, cliffX, phase, weather }: { x: number; cliffX: number; phase: GamePhase; weather: WeatherKind }) {
  const { gl } = useThree()
  const [entityId, setEntityId] = useState<CharacterId>(DISTANT_EASTER_EGG_IDS[0])
  const root = useRef<THREE.Group>(null)
  const model = useRef<THREE.Group>(null)
  const playingStartedAt = useRef<number | null>(null)
  const previousId = useRef<CharacterId>(DISTANT_EASTER_EGG_IDS[0])
  const placement = useRef({ x: screenToWorld(1100), z: -16.4, mirror: 1 })
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const silhouetteMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#587583',
    flatShading: true,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.15)],
  }), [])
  const spec = CHARACTER_BY_ID[entityId]
  const gltf = useGLTF(spec.modelUrl)
  const prepared = useMemo(() => {
    const copy = gltf.scene.clone(true)
    copy.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(copy)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    copy.position.sub(center)
    copy.traverse(object => {
      if (object instanceof THREE.Mesh) {
        const meshBounds = new THREE.Box3().setFromObject(object)
        const meshSize = meshBounds.getSize(new THREE.Vector3())
        const helperName = object.name.toLowerCase()
        const flatHelper = meshSize.y < size.y * 0.08 && meshSize.x > size.x * 0.52 && meshSize.z > size.z * 0.52
        if (flatHelper || /shadow|ground|floor|plane/.test(helperName)) {
          object.visible = false
          return
        }
        object.castShadow = false
        object.receiveShadow = false
        object.material = silhouetteMaterial
      }
    })
    const targetHeight = spec.category === 'mechs' ? 34 : spec.category === 'animals' ? 28 : 31
    return { copy, targetHeight, scale: targetHeight / Math.max(0.1, size.y) }
  }, [gltf.scene, silhouetteMaterial, spec.category])

  useEffect(() => {
    if (phase !== 'playing') {
      playingStartedAt.current = null
      return
    }
    const candidates = DISTANT_EASTER_EGG_IDS.filter(id => id !== previousId.current)
    const next = candidates[Math.floor(Math.random() * candidates.length)]
    previousId.current = next
    placement.current = {
      x: screenToWorld(820 + Math.random() * 360),
      z: -15 - Math.random() * 3,
      mirror: Math.random() > 0.5 ? 1 : -1,
    }
    setEntityId(next)
    playingStartedAt.current = performance.now()
  }, [phase])

  useEffect(() => {
    gl.localClippingEnabled = true
    gl.domElement.dataset.distantEasterEgg = entityId
    return () => {
      gl.localClippingEnabled = false
      delete gl.domElement.dataset.distantEasterEgg
    }
  }, [entityId, gl])

  useEffect(() => () => {
    silhouetteMaterial.dispose()
  }, [silhouetteMaterial])

  useFrame((state, delta) => {
    if (!root.current || !model.current) return
    const progress = THREE.MathUtils.clamp((x - 40) / Math.max(1, cliffX - 40), 0, 1)
    const age = playingStartedAt.current === null ? 0 : performance.now() - playingStartedAt.current
    const reveal = phase === 'playing' ? THREE.MathUtils.smoothstep(age, 80, 600) : 0
    const retreat = 1 - THREE.MathUtils.smoothstep(progress, 0.24, 0.36)
    const weatherOpacity = weather === 'clear' ? 0.32 : weather === 'snow' ? 0.28 : weather === 'fog' ? 0.24 : 0.2
    const targetOpacity = reveal * retreat * weatherOpacity
    silhouetteMaterial.opacity = THREE.MathUtils.damp(silhouetteMaterial.opacity, targetOpacity, 3.1, delta)
    root.current.visible = silhouetteMaterial.opacity > 0.004

    const time = state.clock.elapsedTime
    const animal = spec.category === 'animals'
    const heavy = spec.category === 'mechs' || spec.category === 'mythic'
    const cycle = animal ? 5.8 : heavy ? 7.2 : 6.4
    const wave = reduceMotion ? 0 : Math.sin((time / cycle) * Math.PI * 2)
    root.current.position.x = placement.current.x + (reduceMotion ? 0 : Math.sin(time * 0.18) * 0.18)
    root.current.position.z = placement.current.z
    model.current.position.y = -1.38 - prepared.targetHeight * 0.1 + wave * (animal ? 0.12 : heavy ? 0.04 : 0.08)
    model.current.scale.setScalar(prepared.scale)
    model.current.scale.x *= placement.current.mirror
    model.current.rotation.y = animal ? 0.08 : 0.12
    model.current.rotation.x = heavy ? wave * 0.025 : 0
    model.current.rotation.z = !animal && !heavy ? wave * 0.03 : 0
  })

  return (
    <group ref={root} visible={false} position={[screenToWorld(1100), 0, -16.4]}>
      <group ref={model}>
        <primitive object={prepared.copy} />
      </group>
    </group>
  )
}

function IcePlatform({ cliffX, rating }: { cliffX: number; rating: Rating | null }) {
  const left = -5.45
  const edge = screenToWorld(cliffX)
  const width = edge - left
  const center = left + width / 2
  const deepRoots = [
    { from: 0.02, to: 0.18, depth: 94, zDepth: 4.18, color: '#347986' },
    { from: 0.29, to: 0.47, depth: 14, zDepth: 3.72, color: '#3d8591' },
    { from: 0.58, to: 0.73, depth: 102, zDepth: 4.08, color: '#327582' },
    { from: 0.81, to: 0.9, depth: 8, zDepth: 3.48, color: '#3a818d' },
  ]
  const hangingBlocks = [
    { from: 0.205, to: 0.245, depth: 4.8, zDepth: 2.6 },
    { from: 0.255, to: 0.278, depth: 2.9, zDepth: 3.25 },
    { from: 0.49, to: 0.54, depth: 5.6, zDepth: 2.82 },
    { from: 0.545, to: 0.572, depth: 3.4, zDepth: 3.5 },
    { from: 0.75, to: 0.792, depth: 4.2, zDepth: 2.48 },
    { from: 0.915, to: 0.948, depth: 3.1, zDepth: 3.08 },
  ]
  return (
    <group>
      <mesh receiveShadow position={[center - 0.12, -0.38, 0.18]} scale={[width + 0.16, 1.3, 4.5]}>
        <boxGeometry args={[1, 1, 1]} />
        {material('#397f8d')}
      </mesh>
      {deepRoots.map(root => {
        const rootWidth = Math.max(0.45, width * (root.to - root.from))
        const rootX = left + width * ((root.from + root.to) / 2)
        const rootTop = -0.96
        const rootCenterY = rootTop - root.depth / 2
        return (
          <mesh key={`deep-root-${root.from}`} receiveShadow position={[rootX, rootCenterY, 0.18]} scale={[rootWidth, root.depth, root.zDepth]}>
            <boxGeometry args={[1, 1, 1]} />
            {material(root.color)}
          </mesh>
        )
      })}
      {hangingBlocks.map((block, index) => {
        const blockWidth = Math.max(0.22, width * (block.to - block.from))
        const blockX = left + width * ((block.from + block.to) / 2)
        return (
        <mesh
          key={`hanging-block-${block.from}`}
          position={[blockX, -0.96 - block.depth / 2, 0.18 + (index % 2 ? -0.22 : 0.16)]}
          scale={[blockWidth, block.depth, block.zDepth]}
        >
          <boxGeometry args={[1, 1, 1]} />
          {material(index % 2 ? '#438b95' : '#347986')}
        </mesh>
        )
      })}
      <mesh receiveShadow position={[center - 0.04, 0.02, -0.04]} scale={[width + 0.08, 0.72, 4.36]}>
        <boxGeometry args={[1, 1, 1]} />
        {material(C.ice)}
      </mesh>
      <mesh receiveShadow position={[center - 0.14, 0.41, 0]} scale={[Math.max(1, width - 0.28), 0.12, 4.25]}>
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
      {Array.from({ length: 20 }, (_, index) => {
        const ratio = 0.06 + index * 0.046
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

function VictoryBurst({ x, rating }: { x: number; rating: Rating }) {
  const particles = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const startedAt = useRef(performance.now())
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const colors = rating === 'edge' ? [C.gold, '#fff4bd', '#ffffff'] : rating === 'great' ? ['#f5d98d', C.gold, '#eaf9f7'] : [C.teal, '#a9dcd8', '#ffffff']

  useFrame(() => {
    const elapsed = THREE.MathUtils.clamp((performance.now() - startedAt.current) / 1450, 0, 1)
    const burst = THREE.MathUtils.clamp((elapsed - 0.055) / 0.66, 0, 1)
    const eased = 1 - Math.pow(1 - burst, 3)
    const settle = elapsed > 0.72 ? 1 - (elapsed - 0.72) / 0.28 : 1
    if (particles.current) {
      particles.current.rotation.y = eased * (reduceMotion ? 0.3 : 1.2)
      particles.current.children.forEach((piece, index) => {
        const angle = (index / 20) * Math.PI * 2 + (index % 3) * 0.19
        const radius = (0.32 + (index % 5) * 0.12) * eased * (reduceMotion ? 0.75 : 1.45)
        const rise = (0.7 + (index % 4) * 0.18) * Math.sin(burst * Math.PI)
        piece.visible = elapsed >= 0.055 && settle > 0
        piece.position.set(Math.cos(angle) * radius, 0.86 + rise, Math.sin(angle) * radius * 0.75)
        piece.rotation.set(eased * (index % 3) * 0.9, angle + eased, eased * 2.4)
        piece.scale.setScalar(Math.max(0.01, settle) * (0.72 + (index % 3) * 0.16))
      })
    }
    if (ring.current) {
      const ringMaterial = ring.current.material as THREE.MeshBasicMaterial
      ring.current.visible = elapsed >= 0.04 && elapsed < 0.7
      ring.current.scale.setScalar(0.25 + eased * (reduceMotion ? 1.25 : 2.25))
      ringMaterial.opacity = Math.max(0, 0.72 - burst * 0.82)
    }
  })

  return (
    <group position={[screenToWorld(x + 29), 0.05, 0.12]}>
      <pointLight color={colors[0]} intensity={rating === 'edge' ? 5.5 : 3.5} distance={6} position={[0.2, 2.2, 0]} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.66, 0]}>
        <torusGeometry args={[0.72, 0.035, 6, 32]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <group ref={particles}>
        {Array.from({ length: 20 }, (_, index) => (
          <mesh key={index} castShadow>
            <octahedronGeometry args={[0.07 + (index % 4) * 0.018, 0]} />
            {material(colors[index % colors.length], colors[index % colors.length])}
          </mesh>
        ))}
      </group>
    </group>
  )
}

function EarlyFailureMeasure({ x, cliffX }: { x: number; cliffX: number }) {
  const group = useRef<THREE.Group>(null)
  const start = screenToWorld(x + 49) + 0.42
  const end = screenToWorld(cliffX) - 0.36
  const span = Math.max(0.8, end - start)
  const dashWidth = Math.min(0.72, span / 18)

  useFrame((state) => {
    if (!group.current) return
    group.current.position.y = 0.605 + Math.sin(state.clock.elapsedTime * 7.5) * 0.025
  })

  return (
    <group ref={group}>
      {Array.from({ length: 12 }, (_, index) => {
        const ratio = (index + 0.5) / 12
        return (
          <mesh key={index} position={[THREE.MathUtils.lerp(start, end, ratio), 0, 0]} scale={[dashWidth, 0.035, 0.075]}>
            <boxGeometry args={[1, 1, 1]} />
            {material('#f06449', '#f06449')}
          </mesh>
        )
      })}
      {[start, end].map((markerX, markerIndex) => (
        <group key={markerX} position={[markerX, 0.025, 0]}>
          <mesh rotation={[0, Math.PI / 4, 0]} scale={[0.055, 0.04, 0.56]}>
            <boxGeometry args={[1, 1, 1]} />
            {material(markerIndex === 0 ? '#f06449' : C.gold, markerIndex === 0 ? '#f06449' : C.gold)}
          </mesh>
          <mesh rotation={[0, -Math.PI / 4, 0]} scale={[0.055, 0.04, 0.56]}>
            <boxGeometry args={[1, 1, 1]} />
            {material(markerIndex === 0 ? '#f06449' : C.gold, markerIndex === 0 ? '#f06449' : C.gold)}
          </mesh>
        </group>
      ))}
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

const SHATTER_PALETTES = {
  people: ['#6f3e24', '#d79967', '#2f9f98', '#315477', '#f0cf9f'],
  archetypes: ['#263b44', '#d79967', '#d8534f', '#3f79a7', '#f0cf9f'],
  monsters: ['#293637', '#9cad87', '#775165', '#d7d4c5', '#4e7164'],
  office: ['#4a3023', '#c98b62', '#28465f', '#3f8f88', '#d6b87b'],
  villains: ['#1d2b30', '#41515a', '#6f553f', '#b78f55', '#d8d2c6'],
  mechs: ['#1b2428', '#3b464b', '#f3a83b', '#9b5a33', '#d5d9d6'],
  mythic: ['#6b422c', '#9b704d', '#3f8f88', '#e4d7bb', '#3b2922'],
  animals: ['#76513b', '#c96d35', '#f4d8af', '#4e9d62', '#eff6cf'],
} as const

const SHATTER_LAYOUT = [
  [-0.2, 1.62, -0.18, 0.28, 0], [0.2, 1.62, -0.18, 0.28, 1],
  [-0.2, 1.62, 0.18, 0.28, 4], [0.2, 1.62, 0.18, 0.28, 0],
  [-0.22, 1.12, -0.18, 0.34, 2], [0.22, 1.12, -0.18, 0.34, 2],
  [-0.22, 1.12, 0.18, 0.34, 2], [0.22, 1.12, 0.18, 0.34, 4],
  [0, 0.82, -0.52, 0.27, 3], [0, 0.82, 0.52, 0.27, 3],
  [-0.2, 0.42, -0.15, 0.3, 3], [0.2, 0.42, -0.15, 0.3, 3],
  [-0.2, 0.42, 0.15, 0.3, 3], [0.2, 0.42, 0.15, 0.3, 3],
] as const

function CharacterShatter({ x, characterId }: { x: number; characterId: CharacterId }) {
  const pieces = useRef<THREE.Mesh[]>([])
  const startedAt = useRef(performance.now())
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const palette = SHATTER_PALETTES[CHARACTER_BY_ID[characterId].category]

  useFrame(() => {
    const elapsed = THREE.MathUtils.clamp((performance.now() - startedAt.current) / 1250, 0, 1)
    const burst = THREE.MathUtils.clamp((elapsed - 0.105) / 0.895, 0, 1)
    const eased = burst * (2 - burst)
    pieces.current.forEach((piece, index) => {
      if (!piece) return
      const [baseX, baseY, baseZ] = SHATTER_LAYOUT[index]
      const sideX = ((index * 37) % 7 - 3) * 0.14
      const sideZ = ((index * 19) % 9 - 4) * 0.16
      const lift = 0.48 + ((index * 11) % 5) * 0.1
      piece.visible = elapsed >= 0.095
      piece.position.set(
        baseX + (0.28 + sideX) * eased,
        baseY + lift * eased - (reduceMotion ? 1.15 : 2.15) * burst * burst,
        baseZ + sideZ * eased,
      )
      const rotationScale = reduceMotion ? 0.22 : 1
      piece.rotation.set(
        eased * (0.6 + (index % 3) * 0.38) * rotationScale,
        eased * ((index % 2 ? -1 : 1) * (0.8 + (index % 4) * 0.26)) * rotationScale,
        eased * ((index % 3) - 1) * 0.72 * rotationScale,
      )
      const settleScale = elapsed > 0.86 ? 1 - (elapsed - 0.86) * 1.9 : 1
      piece.scale.setScalar(Math.max(0.7, settleScale))
    })
  })

  return (
    <group position={[screenToWorld(x + 29), 0.05, 0.12]}>
      {SHATTER_LAYOUT.map(([, , , size, colorIndex], index) => (
        <mesh
          key={index}
          ref={mesh => { if (mesh) pieces.current[index] = mesh }}
          castShadow
          visible={false}
        >
          <boxGeometry args={[size, size, size]} />
          {material(palette[colorIndex])}
        </mesh>
      ))}
    </group>
  )
}

function World({ x, cliffX, charging, chargePower, phase, rating, characterId, velocity, weather }: { x: number; cliffX: number; charging: boolean; chargePower: number; phase: GamePhase; rating: Rating | null; characterId: CharacterId; velocity: number; weather: WeatherKind }) {
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
      <FollowCamera x={x} cliffX={cliffX} phase={phase} charging={charging} chargePower={chargePower} rating={rating} />

      <DistantEasterEgg x={x} cliffX={cliffX} phase={phase} weather={weather} />
      <IcePlatform cliffX={cliffX} rating={rating} />
      <AssetCharacter id={characterId} x={x} charging={charging} chargePower={chargePower} phase={phase} velocity={velocity} />
      {(phase === 'falling' || phase === 'gameover') && <CharacterShatter x={x} characterId={characterId} />}
      <SnowSpray x={x} phase={phase} />
      {phase === 'success' && rating && rating !== 'early' && <VictoryBurst x={x} rating={rating} />}
      {(phase === 'earlyFail' || (phase === 'result' && rating === 'early')) && <EarlyFailureMeasure x={x} cliffX={cliffX} />}
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

    </>
  )
}

export default function EdgeBrakeScene(props: { x: number; cliffX: number; charging: boolean; chargePower: number; phase: GamePhase; rating: Rating | null; characterId: CharacterId; preloadCharacterId?: CharacterId; velocity: number; weather: WeatherKind }) {
  useEffect(() => {
    useGLTF.preload(CHARACTER_BY_ID[props.preloadCharacterId ?? nextRosterCharacter(props.characterId).id].modelUrl)
  }, [props.characterId, props.preloadCharacterId])

  return (
    <Canvas
      className="eb-scene"
      orthographic
      camera={{ position: [3.3, 6.8, 4.8], zoom: 64, near: 0.1, far: 90 }}
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ camera }) => camera.lookAt(screenToWorld(props.x + 29), 0.8, 0)}
    >
      <World {...props} />
    </Canvas>
  )
}
