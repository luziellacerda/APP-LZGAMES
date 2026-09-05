/** Literal source, not Function.toString(): works in release Hermes bytecode too.
 * Shared by the local WebView and simulation tests. No eval on the native side.
 */
export const flightModelSource = `
"use strict";
/** Shared camera for stars, hull, nozzles and exhaust: forward is +Z. */
function flightLayout(width, height) {
    return {
        cx: width * 0.5, cy: height * 0.31,
        focal: Math.min(width * 0.8, height * 0.7),
        near: 460, far: 920, cruiseSpeed: 95,
    };
}
/** Frame-rate independent cinematic flight/exhaust, bounded particle pool.
 * Self-contained: the same function runs in the local WebView and tests.
 */
function createFlightSimulation(pilotRandom = Math.random) {
    const particles = [];
    let time = 0, depth = 510, x = -12, y = 122, bank = 0, emission = 0;
    let vx = 0, vy = 0, vz = 0, untilTurn = 0;
    let targetX = x, targetY = y, targetZ = depth;
    const maxParticles = 64;
    function chooseWaypoint() {
        // Alternate sides with random distance/height: no fixed sinusoidal loop.
        targetX = (x <= 0 ? 1 : -1) * (85 + pilotRandom() * 65);
        targetY = 70 + pilotRandom() * 180;
        targetZ = 500 + pilotRandom() * 140;
        untilTurn += 4 + pilotRandom() * 2.5;
    }
    function spring(position, velocity, target, stiffness, dt) {
        // Exact critically damped integration, no teleport or abrupt reversal.
        const offset = position - target;
        const impulse = velocity + stiffness * offset;
        const decay = Math.exp(-stiffness * dt);
        return [target + (offset + impulse * dt) * decay,
            (velocity - stiffness * impulse * dt) * decay];
    }
    function update(delta) {
        const dt = Math.max(0, Math.min(delta, 0.07));
        time += dt;
        if (dt > 0) {
            untilTurn -= dt;
            if (untilTurn <= 0) chooseWaypoint();
            [x, vx] = spring(x, vx, targetX, .72, dt);
            [y, vy] = spring(y, vy, targetY, .8, dt);
            [depth, vz] = spring(depth, vz, targetZ, .5, dt);
        }
        const targetBank = Math.max(-.2, Math.min(.2, -vx * .004));
        bank += (targetBank - bank) * (1 - Math.exp(-dt * 2));
        const alpha = 1;
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.age += dt;
            if (p.age >= p.life || p.z < 100) {
                particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            // Small advected eddies widen the plume; never alter the flight pilot.
            p.vx += Math.sin(p.spin + p.age * 6) * 9 * dt;
            p.vy += Math.cos(p.spin + p.age * 5) * 7 * dt;
            // Expanding ion vapor; no terrestrial gravity pulling smoke down.
            p.vx *= Math.exp(-dt * 0.18);
            p.vy *= Math.exp(-dt * 0.18);
        }
        emission += dt * 24;
        while (emission >= 1) {
            emission -= 1;
            for (const side of [-1, 1]) {
                if (particles.length >= maxParticles)
                    break;
                const px = side * 30;
                particles.push({
                    x: x + px * Math.cos(bank) - 3 * Math.sin(bank), y: y + px * Math.sin(bank) + 3 * Math.cos(bank),
                    z: depth - 54, vx: vx * .3 + (Math.random() - 0.5) * 15,
                    vy: vy * .3 + 6 + Math.random() * 8, vz: -105 - Math.random() * 35,
                    age: 0, life: 0.8 + Math.random() * 0.65, size: 3 + Math.random() * 3,
                    side: px, spin: Math.random() * Math.PI * 2, texture: Math.floor(Math.random() * 3),
                });
            }
        }
        return { time, x, y, z: depth, vx, vy, vz, bank, alpha, particles };
    }
    return { update, maxParticles };
}
`;
