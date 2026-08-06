'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Full-viewport, fixed, pointer-events-none three.js scene:
 * a soft field of drifting particles plus two slowly counter-rotating
 * wireframe icosahedrons, tinted with the app's accent colors.
 * Purely decorative — sits behind all UI (z-index: 0, UI content uses
 * position: relative + z-index: 1, see globals.css/.container).
 */
export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.z = 9;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    // --- Particle field -----------------------------------------------
    const PARTICLE_COUNT = 700;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const accent = new THREE.Color('#6d6dff');
    const accent2 = new THREE.Color('#38d9c9');

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = 6 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi) - 4;

      const mixed = accent.clone().lerp(accent2, Math.random());
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Floating wireframe solids --------------------------------------
    const icoA = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.1, 1),
      new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.28 }),
    );
    icoA.position.set(-3.2, 1, -3);
    scene.add(icoA);

    const icoB = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.4, 1),
      new THREE.MeshBasicMaterial({ color: accent2, wireframe: true, transparent: true, opacity: 0.24 }),
    );
    icoB.position.set(3.4, -1.2, -2);
    scene.add(icoB);

    // --- Pointer parallax -------------------------------------------------
    const pointer = { x: 0, y: 0 };
    const targetRotation = { x: 0, y: 0 };
    function handlePointerMove(e: PointerEvent) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener('pointermove', handlePointerMove);

    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', handleResize);

    let frameId = 0;
    const clock = new THREE.Clock();

    function animate() {
      const t = clock.getElapsedTime();
      const speed = prefersReducedMotion ? 0.08 : 1;

      particles.rotation.y = t * 0.02 * speed;
      particles.rotation.x = t * 0.008 * speed;

      icoA.rotation.x = t * 0.09 * speed;
      icoA.rotation.y = t * 0.12 * speed;
      icoA.position.y = 1 + Math.sin(t * 0.4 * speed) * 0.25;

      icoB.rotation.x = -t * 0.07 * speed;
      icoB.rotation.y = -t * 0.1 * speed;
      icoB.position.y = -1.2 + Math.cos(t * 0.5 * speed) * 0.25;

      targetRotation.x += (pointer.y * 0.15 - targetRotation.x) * 0.03;
      targetRotation.y += (pointer.x * 0.15 - targetRotation.y) * 0.03;
      scene.rotation.x = targetRotation.x;
      scene.rotation.y = targetRotation.y;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      particleGeo.dispose();
      particleMat.dispose();
      icoA.geometry.dispose();
      (icoA.material as THREE.Material).dispose();
      icoB.geometry.dispose();
      (icoB.material as THREE.Material).dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
    }

