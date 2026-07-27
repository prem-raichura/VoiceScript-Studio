import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

/* Radial 3D soundwave — instanced bars ripple outward like audio levels. */
function Bars() {
  const meshRef = useRef()
  const GRID = 16
  const SPACING = 0.52
  const COUNT = GRID * GRID

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const cLow = useMemo(() => new THREE.Color('#C9BEE8'), [])   // crest – light lavender
  const cHigh = useMemo(() => new THREE.Color('#5B4C92'), [])  // trough – deep purple

  const positions = useMemo(() => {
    const arr = []
    const half = (GRID - 1) / 2
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        arr.push([(x - half) * SPACING, (z - half) * SPACING])
      }
    }
    return arr
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < COUNT; i++) {
      const [px, pz] = positions[i]
      const d = Math.hypot(px, pz)
      const wave = Math.sin(t * 2.1 - d * 1.05) * 0.5 + 0.5      // 0..1
      const h = 0.25 + wave * 2.6
      dummy.position.set(px, h / 2, pz)
      dummy.scale.set(0.3, h, 0.3)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.copy(cHigh).lerp(cLow, wave)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.3} metalness={0.35} emissive="#2E2748" emissiveIntensity={0.25} />
    </instancedMesh>
  )
}

function Scene() {
  const group = useRef()
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.18
  })
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 9, 5]} intensity={1.3} castShadow />
      <pointLight position={[-5, 4, -3]} intensity={40} color="#A99BD4" />
      <pointLight position={[4, 2, 4]} intensity={20} color="#7E6FB3" />
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.5}>
        <group ref={group} rotation={[0.15, 0, 0]} position={[0, -0.6, 0]}>
          <Bars />
        </group>
      </Float>
    </>
  )
}

export default function HeroWave3D() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [7, 5.5, 7], fov: 38 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Scene />
    </Canvas>
  )
}
